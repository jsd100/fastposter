package assets

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Font struct {
	document.FontRef
	URL string
}

func (s *Service) builtinFaces() []builtinFace {
	s.builtinMu.RLock()
	defer s.builtinMu.RUnlock()
	return append([]builtinFace(nil), s.builtin...)
}
func (s *Service) setBuiltinFaces(faces []builtinFace) {
	s.builtinMu.Lock()
	defer s.builtinMu.Unlock()
	s.builtin = append([]builtinFace(nil), faces...)
}
func fontPlaceholders(n int) string {
	if n < 1 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", n), ",")
}
func scanFonts(rows *sql.Rows) ([]Font, error) {
	defer rows.Close()
	out := []Font{}
	for rows.Next() {
		var f Font
		var rev uint64
		var raw []byte
		if e := rows.Scan(&f.AssetID, &rev, &raw); e != nil {
			return nil, e
		}
		var meta struct {
			Family string `json:"family"`
			Weight int    `json:"weight"`
			Style  string `json:"style"`
		}
		if e := json.Unmarshal(raw, &meta); e != nil {
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
func (s *Service) ListFonts(ctx context.Context, p auth.Principal) ([]Font, error) {
	if e := auth.RequireUsable(p); e != nil {
		return nil, e
	}
	const query = "SELECT a.id,v.version,v.metadata FROM resources r JOIN resource_versions rv ON rv.resource_id=r.id AND rv.version=r.current_version JOIN assets a ON a.id=rv.asset_id JOIN asset_versions v ON v.asset_id=a.id AND v.version=rv.asset_version WHERE r.kind='font' AND r.published=1 AND r.deleted_at IS NULL"
	builtin := s.builtinFaces()
	ids := make([]any, len(builtin))
	for i, face := range builtin {
		ids[i] = face.ID
	}
	out := []Font{}
	if len(ids) > 0 {
		rows, e := s.DB.QueryContext(ctx, query+" AND a.id IN ("+fontPlaceholders(len(ids))+")", ids...)
		if e != nil {
			return nil, e
		}
		found, e := scanFonts(rows)
		if e != nil {
			return nil, e
		}
		byID := map[string]Font{}
		for _, f := range found {
			byID[f.AssetID] = f
		}
		for _, face := range builtin {
			if f, ok := byID[face.ID]; ok {
				out = append(out, f)
			}
		}
	}
	remaining := 100 - len(out)
	if remaining > 0 {
		sqlQuery := query + " ORDER BY r.sort_order,r.title,r.id LIMIT ?"
		args := []any{remaining}
		if len(ids) > 0 {
			sqlQuery = query + " AND a.id NOT IN (" + fontPlaceholders(len(ids)) + ") ORDER BY r.sort_order,r.title,r.id LIMIT ?"
			args = append(ids, remaining)
		}
		rows, e := s.DB.QueryContext(ctx, sqlQuery, args...)
		if e != nil {
			return nil, e
		}
		rest, e := scanFonts(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, rest...)
	}
	return out, nil
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
	manifest, e := loadBuiltinManifest(root)
	if e != nil {
		return e
	}
	sourcesByHash := make(map[string]string, len(manifest.Files))
	for name, hash := range manifest.Files {
		sourcesByHash[strings.ToLower(hash)] = filepath.Join(root, "assets/fonts", name)
	}
	s.setBuiltinFaces(manifest.Faces)
	if _, e = conn.ExecContext(ctx, "INSERT IGNORE INTO users(id,username,username_normalized,password_hash,disabled) VALUES('system','FastPoster System','system:fastposter','!no-login!',1)"); e != nil {
		return e
	}
	for _, face := range manifest.Faces {
		var count int
		if e = conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM assets WHERE id=?", face.ID).Scan(&count); e != nil {
			return e
		}
		if count > 0 {
			if e = s.restoreBuiltinFontFiles(ctx, conn, face.ID, sourcesByHash); e != nil {
				return fmt.Errorf("builtin font %s: %w", face.ID, e)
			}
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
		meta, e := json.Marshal(map[string]any{"family": face.Family, "weight": face.Weight, "style": face.Style, "license": "SIL Open Font License 1.1", "builtin": true})
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

// Restore only exact bytes at existing immutable keys; never create a new version
// or change publication state merely because the runtime data directory was lost.
func (s *Service) restoreBuiltinFontFiles(ctx context.Context, conn *sql.Conn, assetID string, sourcesByHash map[string]string) error {
	rows, e := conn.QueryContext(ctx, "SELECT original_key,original_sha256,original_size,normalized_key,normalized_sha256,normalized_size FROM asset_versions WHERE asset_id=? ORDER BY version", assetID)
	if e != nil {
		return e
	}
	type storedFile struct {
		key  storage.Key
		hash string
		size int64
	}
	files := map[storage.Key]storedFile{}
	for rows.Next() {
		var original, normalized storedFile
		if e = rows.Scan(&original.key, &original.hash, &original.size, &normalized.key, &normalized.hash, &normalized.size); e != nil {
			rows.Close()
			return e
		}
		for _, file := range []storedFile{original, normalized} {
			file.hash = strings.ToLower(file.hash)
			if file.key == "" {
				rows.Close()
				return domain.E("MISSING_FONT", "内置字体缺少文件引用，请从备份恢复")
			}
			if previous, ok := files[file.key]; ok && previous != file {
				rows.Close()
				return domain.E("MISSING_FONT", "内置字体文件引用的校验信息不一致")
			}
			files[file.key] = file
		}
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	if len(files) == 0 {
		return domain.E("MISSING_FONT", "内置字体缺少版本记录，请从备份恢复")
	}
	for _, file := range files {
		info, statError := s.Store.Stat(ctx, file.key)
		if statError != nil {
			if !errors.Is(statError, os.ErrNotExist) {
				return statError
			}
			source, ok := sourcesByHash[file.hash]
			if !ok {
				return domain.E("MISSING_FONT", "内置字体文件缺失，仓库中没有该版本的原始文件，请从备份恢复")
			}
			data, readError := os.ReadFile(source)
			if readError != nil {
				return readError
			}
			sum := sha256.Sum256(data)
			if int64(len(data)) != file.size || hex.EncodeToString(sum[:]) != file.hash {
				return domain.E("MISSING_FONT", "内置字体源文件与已保存版本不一致，无法自动恢复")
			}
			info, e = s.Store.Put(ctx, file.key, bytes.NewReader(data))
			if errors.Is(e, os.ErrExist) {
				info, e = s.Store.Stat(ctx, file.key)
			}
			if e != nil {
				return storageError(e)
			}
		}
		if info.Size != file.size || !strings.EqualFold(info.SHA256, file.hash) {
			return domain.E("MISSING_FONT", "内置字体运行文件校验失败，未覆盖现有文件，请从备份恢复")
		}
	}
	return nil
}
