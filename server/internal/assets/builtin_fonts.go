package assets

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

type Font struct {
	document.FontRef
	URL string
}

func (s *Service) ListFonts(ctx context.Context, p auth.Principal) ([]Font, error) {
	if e := auth.RequireUsable(p); e != nil {
		return nil, e
	}
	rows, e := s.DB.QueryContext(ctx, "SELECT a.id,v.version,v.metadata FROM resources r JOIN resource_versions rv ON rv.resource_id=r.id AND rv.version=r.current_version JOIN assets a ON a.id=rv.asset_id JOIN asset_versions v ON v.asset_id=a.id AND v.version=rv.asset_version WHERE r.kind='font' AND r.published=1 AND r.deleted_at IS NULL ORDER BY r.sort_order,r.title,r.id LIMIT 100")
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Font{}
	for rows.Next() {
		var f Font
		var rev uint64
		var raw []byte
		if e = rows.Scan(&f.AssetID, &rev, &raw); e != nil {
			return nil, e
		}
		var meta struct {
			Family string `json:"family"`
			Weight int    `json:"weight"`
			Style  string `json:"style"`
		}
		if e = json.Unmarshal(raw, &meta); e != nil {
			return nil, e
		}
		f.Version = strconv.FormatUint(rev, 10)
		f.Family = meta.Family
		f.Weight = meta.Weight
		f.Style = meta.Style
		f.URL = fmt.Sprintf("/api/v1/assets/%s/versions/%s", f.AssetID, f.Version)
		out = append(out, f)
	}
	return out, rows.Err()
}
func (s *Service) BootstrapFonts(ctx context.Context, root string) error {
	// A dedicated connection owns the advisory lock for the full bootstrap.
	conn, e := s.DB.Conn(ctx)
	if e != nil {
		return e
	}
	defer conn.Close()
	var dbName string
	if e = conn.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&dbName); e != nil {
		return e
	}
	lockName := "fastposter-fonts:" + dbName
	var locked int
	if e = conn.QueryRowContext(ctx, "SELECT GET_LOCK(?,10)", lockName).Scan(&locked); e != nil || locked != 1 {
		return domain.E("NOT_READY", "字体初始化正忙，请重试")
	}
	defer conn.ExecContext(context.WithoutCancel(ctx), "SELECT RELEASE_LOCK(?)", lockName)
	if _, e = conn.ExecContext(ctx, "INSERT IGNORE INTO users(id,username,username_normalized,password_hash,disabled) VALUES('system','FastPoster System','system:fastposter','!no-login!',1)"); e != nil {
		return e
	}
	var manifest struct {
		Files map[string]string `json:"files"`
	}
	raw, e := os.ReadFile(filepath.Join(root, "assets/fonts/manifest.json"))
	if e != nil {
		return e
	}
	if e = json.Unmarshal(raw, &manifest); e != nil {
		return e
	}
	for _, face := range []struct {
		ID, Family, File string
		Weight           int
	}{{"builtin-noto-sc-400", "Noto Sans SC", "NotoSansSC-VF.ttf", 400}, {"builtin-noto-sc-700", "Noto Sans SC", "NotoSansSC-VF.ttf", 700}, {"builtin-inter-400", "Inter", "Inter-VF.ttf", 400}, {"builtin-inter-700", "Inter", "Inter-VF.ttf", 700}} {
		var count int
		if e = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM assets WHERE id=?", face.ID).Scan(&count); e != nil {
			return e
		}
		if count > 0 {
			continue
		}
		data, e := os.ReadFile(filepath.Join(root, "assets/fonts", face.File))
		if e != nil {
			return e
		}
		sum := sha256.Sum256(data)
		if hex.EncodeToString(sum[:]) != manifest.Files[face.File] {
			return domain.E("MISSING_FONT", "内置字体文件校验失败")
		}
		file, e := os.Open(filepath.Join(root, "assets/fonts", face.File))
		if e != nil {
			return e
		}
		info, e := s.Store.Put(ctx, storage.NewKey("fonts"), file)
		file.Close()
		if e != nil {
			return e
		}
		meta, e := json.Marshal(map[string]any{"family": face.Family, "weight": face.Weight, "style": "normal", "license": "SIL Open Font License 1.1", "builtin": true})
		if e != nil {
			return e
		}
		a := AssetVersion{ID: face.ID, Version: "1", Kind: "font", Name: face.File, MIME: "font/ttf", OriginalKey: info.Key, NormalizedKey: info.Key, OriginalSize: info.Size, NormalizedSize: info.Size, OriginalSHA256: info.SHA256, NormalizedSHA256: info.SHA256, Metadata: meta}
		tx, e := conn.BeginTx(ctx, nil)
		if e != nil {
			return e
		}
		if _, e = tx.ExecContext(ctx, "INSERT INTO assets(id,kind,name) VALUES(?,'font',?)", a.ID, a.Name); e == nil {
			e = insertVersion(ctx, tx, a)
		}
		if e == nil {
			_, e = tx.ExecContext(ctx, "INSERT INTO resources(id,kind,title,published,created_by,sort_order) VALUES(?,'font',?,1,'system',?)", a.ID, face.Family+" "+strconv.Itoa(face.Weight), face.Weight)
		}
		if e == nil {
			_, e = tx.ExecContext(ctx, "INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,metadata) VALUES(?,1,?,1,?)", a.ID, a.ID, meta)
		}
		if e != nil {
			tx.Rollback()
			return e
		}
		if e = tx.Commit(); e != nil {
			return e
		}
	}
	if _, e = conn.ExecContext(ctx, "INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) SELECT 'resource',resource_id,asset_id,asset_version FROM resource_versions WHERE asset_id IS NOT NULL AND asset_version IS NOT NULL"); e != nil {
		return e
	}

	return nil
}
