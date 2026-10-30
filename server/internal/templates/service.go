package templates

import (
	"archive/zip"
	"context"
	"database/sql"
	"encoding/json"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Service struct {
	DB       *sql.DB
	Store    storage.FileStore
	Projects *projects.Service
	Assets   *assets.Service
	Catalog  *catalog.Service
	TempRoot string
	slots    chan struct{}
}

func NewService(db *sql.DB, store storage.FileStore, p *projects.Service, a *assets.Service, c *catalog.Service, temp string) *Service {
	s := &Service{DB: db, Store: store, Projects: p, Assets: a, Catalog: c, TempRoot: temp, slots: make(chan struct{}, 1)}
	c.TemplateValidator = func(ctx context.Context, actor auth.Principal, d document.Document) ([]document.AssetRef, error) {
		snapshot, e := p.ValidateDocument(ctx, actor, d)
		if e != nil {
			return nil, e
		}
		raw, e := json.Marshal(d)
		if e != nil {
			return nil, e
		}
		if e = c.CheckFonts(ctx, actor, string(raw)); e != nil {
			return nil, e
		}
		refs := []document.AssetRef{{AssetID: snapshot.Background.AssetID, Version: snapshot.Background.Version}}
		for _, font := range snapshot.Fonts {
			refs = append(refs, document.AssetRef{AssetID: font.AssetID, Version: font.Version})
		}
		return refs, nil
	}
	return s
}
func (s *Service) Save(ctx context.Context, p auth.Principal, input catalog.ResourceInput) (catalog.Resource, error) {
	if input.Kind != "template" {
		return catalog.Resource{}, domain.E("INVALID_INPUT", "模板类型无效")
	}
	return s.Catalog.Save(ctx, p, input)
}
func (s *Service) ResolveFonts(ctx context.Context, p auth.Principal, deps []Font) (map[string]document.FontRef, error) {
	out := map[string]document.FontRef{}
	missing := []string{}
	for _, f := range deps {
		asset, e := s.Assets.GetVersion(ctx, p, f.AssetID, f.Version)
		if e != nil || !strings.EqualFold(asset.NormalizedSHA256, f.SHA256) {
			var id, version string
			e = s.DB.QueryRowContext(ctx, "SELECT a.id,v.version FROM resources r JOIN resource_versions rv ON rv.resource_id=r.id AND rv.version=r.current_version JOIN assets a ON a.id=rv.asset_id JOIN asset_versions v ON v.asset_id=a.id AND v.version=rv.asset_version WHERE r.kind='font' AND r.published=1 AND r.deleted_at IS NULL AND v.normalized_sha256=? AND JSON_UNQUOTE(JSON_EXTRACT(v.metadata,'$.family'))=? AND JSON_EXTRACT(v.metadata,'$.weight')=? AND JSON_UNQUOTE(JSON_EXTRACT(v.metadata,'$.style'))=? LIMIT 1", strings.ToLower(f.SHA256), f.Family, f.Weight, f.Style).Scan(&id, &version)
			if e == nil {
				asset, e = s.Assets.GetVersion(ctx, p, id, version)
			}
		}
		if e != nil || asset.Kind != "font" || !strings.EqualFold(asset.NormalizedSHA256, f.SHA256) {
			missing = append(missing, f.Family+" "+f.Style)
			continue
		}
		var metadata struct {
			Family, Style string
			Weight        int
		}
		if json.Unmarshal(asset.Metadata, &metadata) != nil || metadata.Family != f.Family || metadata.Weight != f.Weight || metadata.Style != f.Style {
			missing = append(missing, f.Family+" "+f.Style)
			continue
		}
		out[f.AssetID] = document.FontRef{AssetID: asset.ID, Version: asset.Version, Family: metadata.Family, Weight: metadata.Weight, Style: metadata.Style}
	}
	if len(missing) > 0 {
		return nil, domain.E("MISSING_FONT", "模板需要尚未安装或无权使用的字体："+strings.Join(missing, "、"))
	}
	return out, nil
}
func remapFonts(d document.Document, fonts map[string]document.FontRef) document.Document {
	for i, old := range d.Fonts {
		d.Fonts[i] = fonts[old.AssetID]
	}
	var walk func(*document.Node)
	walk = func(n *document.Node) {
		for i := range n.Marks {
			if id, ok := n.Marks[i].Attrs["fontId"].(string); ok {
				n.Marks[i].Attrs["fontId"] = fonts[id].AssetID
			}
		}
		for i := range n.Content {
			walk(&n.Content[i])
		}
	}
	for i := range d.TextBlocks {
		d.TextBlocks[i].DefaultStyle.FontID = fonts[d.TextBlocks[i].DefaultStyle.FontID].AssetID
		walk(&d.TextBlocks[i].Content)
	}
	return d
}
func (s *Service) importDocument(ctx context.Context, p auth.Principal, src io.Reader) (document.Document, string, error) {
	if e := auth.RequireUsable(p); e != nil {
		return document.Document{}, "", e
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	case <-ctx.Done():
		return document.Document{}, "", ctx.Err()
	}
	if e := os.MkdirAll(s.TempRoot, 0700); e != nil {
		return document.Document{}, "", e
	}
	dir, e := os.MkdirTemp(s.TempRoot, "template-import-")
	if e != nil {
		return document.Document{}, "", e
	}
	defer os.RemoveAll(dir)
	archive, e := ReadArchive(ctx, src, dir)
	if e != nil {
		return document.Document{}, "", e
	}
	fonts, e := s.ResolveFonts(ctx, p, archive.Manifest.Fonts)
	if e != nil {
		return document.Document{}, "", e
	}
	image, e := os.Open(archive.BackgroundPath)
	if e != nil {
		return document.Document{}, "", e
	}
	background, e := s.Assets.Upload(ctx, p, "template-background.png", image)
	image.Close()
	if e != nil {
		return document.Document{}, "", e
	}
	d := remapFonts(archive.Document, fonts)
	d.Background = document.AssetRef{AssetID: background.ID, Version: background.Version}
	return d, archive.Manifest.Title, nil
}
func (s *Service) Import(ctx context.Context, p auth.Principal, src io.Reader) (projects.Project, error) {
	d, title, e := s.importDocument(ctx, p, src)
	if e != nil {
		return projects.Project{}, e
	}
	return s.Projects.Create(ctx, p, title, d)
}
func (s *Service) ImportResource(ctx context.Context, p auth.Principal, src io.Reader) (catalog.Resource, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return catalog.Resource{}, e
	}
	d, title, e := s.importDocument(ctx, p, src)
	if e != nil {
		return catalog.Resource{}, e
	}
	raw, e := json.Marshal(d)
	if e != nil {
		return catalog.Resource{}, e
	}
	return s.Save(ctx, p, catalog.ResourceInput{Kind: "template", Title: title, Document: string(raw), Published: false})
}
func (s *Service) Apply(ctx context.Context, p auth.Principal, id, version string) (projects.Project, error) {
	r, e := s.Catalog.Get(ctx, p, id, false)
	if e != nil {
		return projects.Project{}, e
	}
	if r.Kind != "template" || r.Version != version {
		return projects.Project{}, domain.E("NOT_FOUND", "模板已更新或下架，请重新选择")
	}
	d, e := document.Parse([]byte(r.Document))
	if e != nil {
		return projects.Project{}, invalid("模板文档已损坏")
	}
	return s.Projects.Create(ctx, p, r.Title, d)
}
func (s *Service) writePackage(ctx context.Context, title string, d document.Document, background assets.AssetVersion, fonts []projects.SnapshotFont) (storage.Key, error) {
	if background.NormalizedSize > assets.MaxImageBytes {
		return "", domain.E("PAYLOAD_TOO_LARGE", "模板包的标准 PNG 背景超过 40 MiB，请使用较小背景；原尺寸 PNG 导出仍可用")
	}
	m := Manifest{Format: "fastposter", Version: 1, Title: title, DocumentPath: "document.json", Assets: []Asset{{AssetID: background.ID, Version: background.Version, Path: "assets/background.png", SHA256: background.NormalizedSHA256}}, Fonts: []Font{}}
	for _, f := range fonts {
		m.Fonts = append(m.Fonts, Font{AssetID: f.AssetID, Version: f.Version, Family: f.Family, Weight: f.Weight, Style: f.Style, SHA256: f.SHA256})
	}
	manifest, e := json.Marshal(m)
	if e != nil {
		return "", e
	}
	doc, e := json.Marshal(d)
	if e != nil {
		return "", e
	}
	if e = os.MkdirAll(s.TempRoot, 0700); e != nil {
		return "", e
	}
	dir, e := os.MkdirTemp(s.TempRoot, "template-export-")
	if e != nil {
		return "", e
	}
	defer os.RemoveAll(dir)
	file, e := os.OpenFile(filepath.Join(dir, "template.zip"), os.O_CREATE|os.O_EXCL|os.O_RDWR, 0600)
	if e != nil {
		return "", e
	}
	defer file.Close()
	z := zip.NewWriter(file)
	for _, entry := range []struct {
		name string
		body []byte
	}{{"manifest.json", manifest}, {"document.json", doc}} {
		w, e := z.Create(entry.name)
		if e != nil {
			return "", e
		}
		if _, e = w.Write(entry.body); e != nil {
			return "", e
		}
	}
	writer, e := z.Create("assets/background.png")
	if e != nil {
		return "", e
	}
	source, e := s.Store.Open(ctx, background.NormalizedKey)
	if e != nil {
		return "", e
	}
	_, e = io.Copy(writer, io.LimitReader(source, assets.MaxImageBytes+1))
	source.Close()
	if e != nil {
		return "", e
	}
	if e = z.Close(); e != nil {
		return "", e
	}
	stat, e := file.Stat()
	if e != nil {
		return "", e
	}
	if stat.Size() > MaxCompressed {
		return "", domain.E("PAYLOAD_TOO_LARGE", "模板包不能超过 80 MiB")
	}
	if _, e = file.Seek(0, 0); e != nil {
		return "", e
	}
	stored, e := s.Store.Put(ctx, storage.NewKey("template-packages"), file)
	return stored.Key, e
}
func (s *Service) Export(ctx context.Context, p auth.Principal, id string) (storage.Key, error) {
	a, e := s.Projects.Get(ctx, p, id)
	if e != nil {
		return "", e
	}
	snapshot, e := s.Projects.ResolveSnapshot(ctx, p, id, a.Revision)
	if e != nil {
		return "", e
	}
	background, e := s.Assets.GetVersion(ctx, p, a.Document.Background.AssetID, a.Document.Background.Version)
	if e != nil {
		return "", e
	}
	return s.writePackage(ctx, a.Title, a.Document, background, snapshot.Fonts)
}
func (s *Service) ExportResource(ctx context.Context, p auth.Principal, id, version string) (storage.Key, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return "", e
	}
	r, e := s.Catalog.Get(ctx, p, id, true)
	if e != nil {
		return "", e
	}
	if r.Kind != "template" || (version != "" && version != r.Version) {
		return "", domain.E("NOT_FOUND", "模板已更新或不存在")
	}
	d, e := document.Parse([]byte(r.Document))
	if e != nil {
		return "", invalid("模板文档已损坏")
	}
	snapshot, e := s.Projects.ValidateDocument(ctx, p, d)
	if e != nil {
		return "", e
	}
	background, e := s.Assets.GetVersion(ctx, p, d.Background.AssetID, d.Background.Version)
	if e != nil {
		return "", e
	}
	return s.writePackage(ctx, r.Title, d, background, snapshot.Fonts)
}
