package projects

import (
	"context"
	"database/sql"
	"encoding/json"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
)

type SnapshotFile struct {
	AssetID string      `json:"assetId"`
	Version string      `json:"version"`
	Key     storage.Key `json:"key"`
	SHA256  string      `json:"sha256"`
}
type SnapshotFont struct {
	document.FontRef
	Key    storage.Key `json:"key"`
	SHA256 string      `json:"sha256"`
}
type RenderSnapshot struct {
	Document        document.Document `json:"document"`
	Background      SnapshotFile      `json:"background"`
	Fonts           []SnapshotFont    `json:"fonts"`
	RendererVersion string            `json:"rendererVersion"`
}

func (s *Service) resolveRefs(ctx context.Context, tx *sql.Tx, p auth.Principal, d document.Document) (RenderSnapshot, error) {
	out := RenderSnapshot{Document: d, Fonts: []SnapshotFont{}, RendererVersion: "poster-renderer-v1"}
	refs := []document.AssetRef{d.Background}
	for _, f := range d.Fonts {
		refs = append(refs, document.AssetRef{AssetID: f.AssetID, Version: f.Version})
	}
	for i, ref := range refs {
		if _, e := parseRevision(ref.Version); e != nil {
			return out, domain.E("INVALID_INPUT", "素材版本无效")
		}
		var owner sql.NullString
		var kind, key, hash string
		var w, h int
		var meta []byte
		e := tx.QueryRowContext(ctx, "SELECT a.owner_id,a.kind,v.normalized_key,v.normalized_sha256,v.width,v.height,v.metadata FROM assets a JOIN asset_versions v ON v.asset_id=a.id WHERE a.id=? AND v.version=? FOR SHARE", ref.AssetID, ref.Version).Scan(&owner, &kind, &key, &hash, &w, &h, &meta)
		if e == sql.ErrNoRows {
			return out, domain.E("NOT_FOUND", "引用素材不存在或无权使用")
		}
		if e != nil {
			return out, e
		}
		if owner.String != p.UserID {
			var allowed int
			e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resources r JOIN resource_versions v ON v.resource_id=r.id AND v.version=r.current_version WHERE r.deleted_at IS NULL AND r.published=1 AND v.asset_id=? AND v.asset_version=?", ref.AssetID, ref.Version).Scan(&allowed)
			if e != nil {
				return out, e
			}
			if allowed == 0 {
				e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM asset_refs ref JOIN projects p ON ref.owner_id=p.id WHERE ref.owner_kind IN ('project','project-history') AND p.owner_id=? AND p.deleted_at IS NULL AND ref.asset_id=? AND ref.asset_version=?", p.UserID, ref.AssetID, ref.Version).Scan(&allowed)
				if e != nil {
					return out, e
				}
			}
			if allowed == 0 {
				return out, domain.E("NOT_FOUND", "引用素材不存在或无权使用")
			}
		}
		file, e := s.Store.Open(ctx, storage.Key(key))
		if e != nil {
			return out, domain.E("NOT_FOUND", "引用素材文件缺失，请联系管理员")
		}
		file.Close()
		if i == 0 {
			if kind != "image" || w != d.Canvas.Width || h != d.Canvas.Height {
				return out, domain.E("INVALID_INPUT", "画布必须保持背景图原始像素尺寸")
			}
			out.Background = SnapshotFile{AssetID: ref.AssetID, Version: ref.Version, Key: storage.Key(key), SHA256: hash}
		} else {
			f := d.Fonts[i-1]
			var metadata struct {
				Family string `json:"family"`
				Weight int    `json:"weight"`
				Style  string `json:"style"`
			}
			if kind != "font" || json.Unmarshal(meta, &metadata) != nil || f.Family != metadata.Family || f.Weight != metadata.Weight || f.Style != metadata.Style {
				return out, domain.E("MISSING_FONT", "字体版本与文档声明不符，请重新选择字体")
			}
			out.Fonts = append(out.Fonts, SnapshotFont{FontRef: f, Key: storage.Key(key), SHA256: hash})
		}
	}
	return out, nil
}
func (s *Service) writeRevision(ctx context.Context, tx *sql.Tx, id string, revision uint64, raw []byte, d document.Document) error {
	if _, e := tx.ExecContext(ctx, "INSERT INTO project_revisions(project_id,revision,document) VALUES(?,?,?)", id, revision, raw); e != nil {
		return e
	}
	if _, e := tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind='project' AND owner_id=?", id); e != nil {
		return e
	}
	refs := []document.AssetRef{d.Background}
	for _, f := range d.Fonts {
		refs = append(refs, document.AssetRef{AssetID: f.AssetID, Version: f.Version})
	}
	for _, ref := range refs {
		for _, kind := range []string{"project", "project-history"} {
			if _, e := tx.ExecContext(ctx, "INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES(?,?,?,?)", kind, id, ref.AssetID, ref.Version); e != nil {
				return e
			}
		}
	}
	return nil
}
func (s *Service) ResolveSnapshot(ctx context.Context, p auth.Principal, id, revision string) (RenderSnapshot, error) {
	if e := auth.RequireUsable(p); e != nil {
		return RenderSnapshot{}, e
	}
	rev, e := parseRevision(revision)
	if e != nil {
		return RenderSnapshot{}, e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return RenderSnapshot{}, e
	}
	defer tx.Rollback()
	if _, e = scanProject(tx.QueryRowContext(ctx, "SELECT "+columns+" FROM projects WHERE id=? AND owner_id=? AND deleted_at IS NULL FOR SHARE", id, p.UserID)); e != nil {
		return RenderSnapshot{}, e
	}
	var raw []byte
	e = tx.QueryRowContext(ctx, "SELECT document FROM project_revisions WHERE project_id=? AND revision=?", id, rev).Scan(&raw)
	if e == sql.ErrNoRows {
		return RenderSnapshot{}, missing()
	}
	if e != nil {
		return RenderSnapshot{}, e
	}
	doc, e := document.Parse(raw)
	if e != nil {
		return RenderSnapshot{}, e
	}
	out, e := s.resolveRefs(ctx, tx, p, doc)
	if e != nil {
		return RenderSnapshot{}, e
	}
	if e = tx.Commit(); e != nil {
		return RenderSnapshot{}, e
	}
	return out, nil
}
