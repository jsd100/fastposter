package assets

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"unicode"
)

type AssetVersion struct {
	ID, Version, OwnerID, Kind, Name, MIME    string
	Width, Height                             int
	OriginalKey, NormalizedKey, PreviewKey    storage.Key
	OriginalSize, NormalizedSize, PreviewSize int64
	OriginalSHA256, NormalizedSHA256          string
	Metadata                                  json.RawMessage
}
type Service struct {
	DB         *sql.DB
	Store      storage.FileStore
	Normalizer *Normalizer
	TempRoot   string
	slots      chan struct{}
}

func NewService(db *sql.DB, store storage.FileStore, normalizer *Normalizer, tempRoot string) *Service {
	return &Service{DB: db, Store: store, Normalizer: normalizer, TempRoot: tempRoot, slots: make(chan struct{}, 1)}
}
func storageError(e error) error {
	if errors.Is(e, syscall.ENOSPC) {
		return domain.E("STORAGE_FULL", "存储空间不足，请联系管理员")
	}
	return e
}
func safeName(name, format string) (string, error) {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	if name == "" || name == "." {
		name = "background"
	}
	if len([]rune(name)) > 200 {
		return "", domain.E("INVALID_INPUT", "文件名过长")
	}
	extension := strings.ToLower(filepath.Ext(name))
	want := "." + format
	if format == "jpeg" {
		want = ".jpg"
	}
	if extension == "" {
		return name + want, nil
	}
	if extension != want && !(format == "jpeg" && extension == ".jpeg") {
		return "", domain.E("INVALID_INPUT", "文件扩展名与真实图片格式不一致")
	}
	return name, nil
}
func (s *Service) putPath(ctx context.Context, key storage.Key, path string) (storage.FileInfo, error) {
	r, e := os.Open(path)
	if e != nil {
		return storage.FileInfo{}, e
	}
	defer r.Close()
	return s.Store.Put(ctx, key, r)
}
func (s *Service) Upload(ctx context.Context, p auth.Principal, name string, src io.Reader) (AssetVersion, error) {
	var asset AssetVersion
	if e := auth.RequireUsable(p); e != nil {
		return asset, e
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	case <-ctx.Done():
		return asset, ctx.Err()
	}
	original, e := s.Store.Put(ctx, storage.NewKey("originals"), io.LimitReader(src, MaxImageBytes+1))
	if e != nil {
		return asset, storageError(e)
	}
	if original.Size > MaxImageBytes {
		s.Store.Delete(ctx, original.Key)
		return asset, domain.E("PAYLOAD_TOO_LARGE", "图片文件不能超过 40 MiB")
	}
	if e = os.MkdirAll(s.TempRoot, 0700); e != nil {
		return asset, storageError(e)
	}
	work, e := os.MkdirTemp(s.TempRoot, "normalize-")
	if e != nil {
		return asset, storageError(e)
	}
	defer os.RemoveAll(work)
	input := filepath.Join(work, "source")
	source, e := s.Store.Open(ctx, original.Key)
	if e != nil {
		return asset, e
	}
	f, e := os.OpenFile(input, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		source.Close()
		return asset, e
	}
	_, copyErr := io.Copy(f, source)
	source.Close()
	closeErr := f.Close()
	if copyErr != nil {
		return asset, storageError(copyErr)
	}
	if closeErr != nil {
		return asset, storageError(closeErr)
	}
	metadata, e := Probe(ctx, input)
	if e != nil {
		return asset, e
	}
	name, e = safeName(name, metadata.Format)
	if e != nil {
		return asset, e
	}
	normalized, e := s.Normalizer.Normalize(ctx, input, filepath.Join(work, "normalized.png"))
	if e != nil {
		return asset, e
	}
	full, e := s.putPath(ctx, storage.NewKey("normalized"), normalized.Path)
	if e != nil {
		return asset, storageError(e)
	}
	preview, e := s.putPath(ctx, storage.NewKey("previews"), normalized.PreviewPath)
	if e != nil {
		return asset, storageError(e)
	}
	metaJSON, e := json.Marshal(map[string]any{"format": metadata.Format, "bitDepth": metadata.BitDepth, "hasICC": metadata.HasICC, "normalizerVersion": "srgb-rgba8-v1"})
	if e != nil {
		return asset, e
	}
	asset = AssetVersion{ID: domain.ID(), Version: "1", OwnerID: p.UserID, Kind: "image", Name: name, MIME: "image/png", Width: normalized.Width, Height: normalized.Height, OriginalKey: original.Key, NormalizedKey: full.Key, PreviewKey: preview.Key, OriginalSize: original.Size, NormalizedSize: full.Size, PreviewSize: preview.Size, OriginalSHA256: original.SHA256, NormalizedSHA256: full.SHA256, Metadata: metaJSON}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return AssetVersion{}, e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, "INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,?,?)", asset.ID, p.UserID, asset.Kind, asset.Name); e != nil {
		return AssetVersion{}, e
	}
	if e = insertVersion(ctx, tx, asset); e != nil {
		return AssetVersion{}, e
	}
	if e = tx.Commit(); e != nil {
		return AssetVersion{}, e
	}
	return asset, nil
}
func insertVersion(ctx context.Context, tx *sql.Tx, a AssetVersion) error {
	_, e := tx.ExecContext(ctx, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", a.ID, a.Version, string(a.OriginalKey), string(a.NormalizedKey), string(a.PreviewKey), a.MIME, a.Width, a.Height, a.OriginalSize, a.NormalizedSize, a.PreviewSize, a.OriginalSHA256, a.NormalizedSHA256, []byte(a.Metadata))
	return e
}
func (s *Service) get(ctx context.Context, id, version string) (AssetVersion, error) {
	var a AssetVersion
	var owner sql.NullString
	var raw []byte
	if len(id) > 128 {
		return a, domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	var versionNumber uint64
	var e error
	if version == "" {
		e = s.DB.QueryRowContext(ctx, "SELECT current_version FROM assets WHERE id=?", id).Scan(&versionNumber)
	} else {
		versionNumber, e = strconv.ParseUint(version, 10, 64)
	}
	if e != nil || versionNumber == 0 {
		return a, domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	e = s.DB.QueryRowContext(ctx, "SELECT a.id,a.owner_id,a.kind,a.name,v.mime,v.width,v.height,v.original_key,v.normalized_key,v.preview_key,v.original_size,v.normalized_size,v.preview_size,v.original_sha256,v.normalized_sha256,v.metadata FROM assets a JOIN asset_versions v ON v.asset_id=a.id WHERE a.id=? AND v.version=?", id, versionNumber).Scan(&a.ID, &owner, &a.Kind, &a.Name, &a.MIME, &a.Width, &a.Height, &a.OriginalKey, &a.NormalizedKey, &a.PreviewKey, &a.OriginalSize, &a.NormalizedSize, &a.PreviewSize, &a.OriginalSHA256, &a.NormalizedSHA256, &raw)
	if errors.Is(e, sql.ErrNoRows) {
		return a, domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	if e != nil {
		return a, e
	}
	a.OwnerID = owner.String
	a.Version = strconv.FormatUint(versionNumber, 10)
	a.Metadata = raw
	return a, nil
}
func (s *Service) authorize(ctx context.Context, p auth.Principal, a AssetVersion) (bool, error) {
	if e := auth.RequireUsable(p); e != nil {
		return false, e
	}
	if a.OwnerID == p.UserID {
		return true, nil
	}
	var allowed int
	e := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM resources r JOIN resource_versions v ON v.resource_id=r.id AND v.version=r.current_version WHERE r.deleted_at IS NULL AND v.asset_id=? AND v.asset_version=? AND (r.published=1 OR ?='admin')", a.ID, a.Version, p.Role).Scan(&allowed)
	if e != nil {
		return false, e
	}
	if allowed > 0 {
		return true, nil
	}
	e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM asset_refs ref JOIN resources r ON ((ref.owner_kind='resource-version' AND ref.owner_id=CONCAT(r.id,':',r.current_version) AND r.published=1) OR (ref.owner_kind='resource' AND ref.owner_id=r.id AND ?='admin')) WHERE r.deleted_at IS NULL AND ref.asset_id=? AND ref.asset_version=?", p.Role, a.ID, a.Version).Scan(&allowed)
	if e != nil {
		return false, e
	}
	if allowed > 0 {
		return true, nil
	}
	e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM asset_refs ref JOIN projects p ON ref.owner_kind IN ('project','project-history') AND ref.owner_id=p.id WHERE p.owner_id=? AND p.deleted_at IS NULL AND ref.asset_id=? AND ref.asset_version=?", p.UserID, a.ID, a.Version).Scan(&allowed)
	return allowed > 0, e
}
func (s *Service) GetVersion(ctx context.Context, p auth.Principal, id, version string) (AssetVersion, error) {
	a, e := s.get(ctx, id, version)
	if e != nil {
		return a, e
	}
	ok, e := s.authorize(ctx, p, a)
	if e != nil {
		return AssetVersion{}, e
	}
	if !ok {
		return AssetVersion{}, domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	return a, nil
}
func (s *Service) Get(ctx context.Context, p auth.Principal, id string) (AssetVersion, error) {
	a, e := s.get(ctx, id, "")
	if e != nil {
		return a, e
	}
	ok, e := s.authorize(ctx, p, a)
	if e != nil {
		return AssetVersion{}, e
	}
	if !ok {
		return AssetVersion{}, domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	return a, nil
}
func (s *Service) AuthorizeRead(ctx context.Context, p auth.Principal, id, version string) (storage.Key, error) {
	a, e := s.get(ctx, id, version)
	if e != nil {
		return "", e
	}
	ok, e := s.authorize(ctx, p, a)
	if e != nil {
		return "", e
	}
	if !ok {
		return "", domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	return a.NormalizedKey, nil
}
func (s *Service) Read(ctx context.Context, p auth.Principal, id, version, variant string) (storage.Key, string, string, error) {
	a, e := s.get(ctx, id, version)
	if e != nil {
		return "", "", "", e
	}
	ok, e := s.authorize(ctx, p, a)
	if e != nil {
		return "", "", "", e
	}
	if !ok {
		return "", "", "", domain.E("NOT_FOUND", "素材不存在或无权访问")
	}
	switch variant {
	case "", "normalized":
		name := a.Name
		if a.Kind == "image" {
			name = strings.TrimSuffix(name, filepath.Ext(name)) + ".png"
		}
		return a.NormalizedKey, a.MIME, name, nil
	case "preview":
		if a.PreviewKey == "" {
			return a.NormalizedKey, a.MIME, a.Name, nil
		}
		return a.PreviewKey, "image/png", "preview.png", nil
	case "original":
		if a.OwnerID != p.UserID {
			return "", "", "", domain.E("NOT_FOUND", "素材不存在或无权访问")
		}
		mime := "application/octet-stream"
		var meta struct {
			Format string `json:"format"`
		}
		json.Unmarshal(a.Metadata, &meta)
		if meta.Format == "jpeg" {
			mime = "image/jpeg"
		} else if meta.Format == "png" {
			mime = "image/png"
		} else if meta.Format == "webp" {
			mime = "image/webp"
		}
		return a.OriginalKey, mime, a.Name, nil
	default:
		return "", "", "", domain.E("INVALID_INPUT", "未知图片版本类型")
	}
}
