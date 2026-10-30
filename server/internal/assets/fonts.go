package assets

import (
	"bytes"
	"context"
	"encoding/json"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/fontfile"
	"fastposter/server/internal/storage"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"
)

func (s *Service) UploadFont(ctx context.Context, p auth.Principal, name, family string, weight int, style, license string, src io.Reader) (AssetVersion, error) {
	var asset AssetVersion
	if e := auth.RequireAdmin(p); e != nil {
		return asset, e
	}
	family = strings.TrimSpace(family)
	if family == "" || utf8.RuneCountInString(family) > 128 || strings.ContainsFunc(family, unicode.IsControl) || len(license) > 4000 {
		return asset, domain.E("INVALID_INPUT", "请检查字体家族名称与授权说明")
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	case <-ctx.Done():
		return asset, ctx.Err()
	}
	data, e := io.ReadAll(io.LimitReader(src, fontfile.MaxUploadBytes+1))
	if e != nil {
		return asset, e
	}
	face, e := fontfile.Parse(data, weight, style)
	if e != nil {
		return asset, e
	}
	format := "ttf"
	if string(data[:4]) == "OTTO" {
		format = "otf"
	} else if string(data[:4]) == "wOF2" {
		format = "woff2"
	}
	name, e = safeName(name, format)
	if e != nil {
		return asset, e
	}
	mime := "font/ttf"
	if string(face.Data[:4]) == "OTTO" {
		mime = "font/otf"
	}
	original, e := s.Store.Put(ctx, storage.NewKey("font-originals"), bytes.NewReader(data))
	if e != nil {
		return asset, storageError(e)
	}
	normalized := original
	if !bytes.Equal(data, face.Data) {
		normalized, e = s.Store.Put(ctx, storage.NewKey("fonts"), bytes.NewReader(face.Data))
		if e != nil {
			return asset, storageError(e)
		}
	}
	metadata, e := json.Marshal(map[string]any{"family": family, "weight": weight, "style": style, "license": license, "format": format})
	if e != nil {
		return asset, e
	}
	asset = AssetVersion{ID: domain.ID(), Version: "1", OwnerID: p.UserID, Kind: "font", Name: name, MIME: mime, OriginalKey: original.Key, NormalizedKey: normalized.Key, OriginalSize: original.Size, NormalizedSize: normalized.Size, OriginalSHA256: original.SHA256, NormalizedSHA256: normalized.SHA256, Metadata: metadata}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return AssetVersion{}, e
	}
	defer tx.Rollback()
	if _, e = tx.ExecContext(ctx, "INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,'font',?)", asset.ID, p.UserID, name); e != nil {
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
