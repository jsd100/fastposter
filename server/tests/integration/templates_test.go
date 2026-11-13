package integration_test

import (
	"bytes"
	"context"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/templates"
	"os"
	"path/filepath"
	"testing"
)

func TestTemplateApplyCreatesIndependentPrivateProject(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	for _, item := range []struct{ id, path string }{{"bg-1", "tests/fixtures/images/editor.png"}, {"font-1", "assets/fonts/NotoSansSC-VF.ttf"}} {
		file, e := os.Open(filepath.Join(repoRoot(t), item.path))
		if e != nil {
			t.Fatal(e)
		}
		info, e := p.Store.Put(ctx, storage.NewKey("real-template"), file)
		file.Close()
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec("UPDATE asset_versions SET original_key=?,normalized_key=?,preview_key=?,original_sha256=?,normalized_sha256=?,original_size=?,normalized_size=? WHERE asset_id=?", string(info.Key), string(info.Key), string(info.Key), info.SHA256, info.SHA256, info.Size, info.Size, item.id); e != nil {
			t.Fatal(e)
		}
	}
	admin := auth.Principal{UserID: "u1", Role: "admin"}
	root := repoRoot(t)
	images := assets.NewService(db, p.Store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	c := catalog.NewService(db, p.Store, images)
	s := templates.NewService(db, p.Store, p, images, c, t.TempDir())
	resource, e := s.Save(ctx, admin, catalog.ResourceInput{Kind: "template", Title: "模板", Document: string(mustJSON(doc)), Published: true})
	if e != nil {
		t.Fatal(e)
	}
	user := auth.Principal{UserID: "u2", Role: "user"}
	a, e := s.Apply(ctx, user, resource.ID, resource.Version)
	if e != nil {
		t.Fatal(e)
	}
	b, e := s.Apply(ctx, user, resource.ID, resource.Version)
	if e != nil || a.ID == b.ID || a.OwnerID != "u2" {
		t.Fatal("not independent", e)
	}
	if _, e = s.Save(ctx, admin, catalog.ResourceInput{ID: resource.ID, Kind: "template", Title: "模板", Document: string(mustJSON(doc)), Published: false, ExpectedVersion: resource.Version}); e != nil {
		t.Fatal(e)
	}
	if _, e = p.ResolveSnapshot(ctx, user, a.ID, "1"); e != nil {
		t.Fatal("unpublication broke applied project", e)
	}
	if _, e = s.ExportResource(ctx, user, resource.ID, ""); e == nil {
		t.Fatal("regular user exported admin template")
	}
	current, e := c.Get(ctx, admin, resource.ID, true)
	if e != nil {
		t.Fatal(e)
	}
	key, e := s.ExportResource(ctx, admin, resource.ID, current.Version)
	if e != nil {
		t.Fatal(e)
	}
	pack, e := p.Store.Open(ctx, key)
	if e != nil {
		t.Fatal(e)
	}
	defer pack.Close()
	imported, e := s.Import(ctx, admin, pack)
	if e != nil || imported.OwnerID != "u1" || imported.Document.Background.AssetID == doc.Background.AssetID || len(imported.Document.TextBlocks) != len(doc.TextBlocks) {
		t.Fatal("admin package roundtrip failed", e)
	}
}
func TestTemplateMissingFontListsDependencies(t *testing.T) {
	p, db, _ := projectService(t)
	images := assets.NewService(db, p.Store, nil, t.TempDir())
	c := catalog.NewService(db, p.Store, images)
	s := templates.NewService(db, p.Store, p, images, c, t.TempDir())
	_, e := s.ResolveFonts(context.Background(), projectOwner(), []templates.Font{{AssetID: "missing-font", Version: "1", Family: "Missing Family", Weight: 400, Style: "normal", SHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}})
	if e == nil || !bytes.Contains([]byte(e.Error()), []byte("Missing Family")) {
		t.Fatal("missing font not listed", e)
	}
}
func TestTemplateArchiveRoundtripRetainsPrivateMixedStyles(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	root := repoRoot(t)
	for _, item := range []struct{ id, path string }{{"bg-1", "tests/fixtures/images/editor.png"}, {"font-1", "assets/fonts/NotoSansSC-VF.ttf"}} {
		file, e := os.Open(filepath.Join(root, item.path))
		if e != nil {
			t.Fatal(e)
		}
		info, e := p.Store.Put(ctx, storage.NewKey("template-roundtrip"), file)
		file.Close()
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec("UPDATE asset_versions SET original_key=?,normalized_key=?,preview_key=?,original_sha256=?,normalized_sha256=?,original_size=?,normalized_size=? WHERE asset_id=?", string(info.Key), string(info.Key), string(info.Key), info.SHA256, info.SHA256, info.Size, info.Size, item.id); e != nil {
			t.Fatal(e)
		}
	}
	images := assets.NewService(db, p.Store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	c := catalog.NewService(db, p.Store, images)
	s := templates.NewService(db, p.Store, p, images, c, t.TempDir())
	a, e := p.Create(ctx, projectOwner(), "可携带作品", doc)
	if e != nil {
		t.Fatal(e)
	}
	key, e := s.Export(ctx, projectOwner(), a.ID)
	if e != nil {
		t.Fatal(e)
	}
	reader, e := p.Store.Open(ctx, key)
	if e != nil {
		t.Fatal(e)
	}
	defer reader.Close()
	b, e := s.Import(ctx, projectOwner(), reader)
	if e != nil {
		t.Fatal(e)
	}
	if a.ID == b.ID || a.Document.Background.AssetID == b.Document.Background.AssetID || string(mustJSON(a.Document.TextBlocks)) != string(mustJSON(b.Document.TextBlocks)) {
		t.Fatal("template import did not preserve independent mixed-text document")
	}
}
