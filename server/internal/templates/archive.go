package templates

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"
)

func invalid(message string) error { return domain.E("INVALID_TEMPLATE", message) }
func strictJSON(raw []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if e := decoder.Decode(out); e != nil {
		return invalid("模板清单 JSON 无效或包含未知字段")
	}
	if e := decoder.Decode(new(any)); e != io.EOF {
		return invalid("模板清单包含额外数据")
	}
	return nil
}
func validHash(raw string) bool { b, e := hex.DecodeString(raw); return e == nil && len(b) == 32 }
func ReadArchive(ctx context.Context, src io.Reader, dir string) (Archive, error) {
	var out Archive
	if e := os.MkdirAll(dir, 0700); e != nil {
		return out, e
	}
	archivePath := filepath.Join(dir, "package.zip")
	f, e := os.OpenFile(archivePath, os.O_CREATE|os.O_EXCL|os.O_RDWR, 0600)
	if e != nil {
		return out, e
	}
	defer f.Close()
	size, e := io.Copy(f, io.LimitReader(src, MaxCompressed+1))
	if e != nil {
		return out, e
	}
	if size > MaxCompressed {
		return out, domain.E("PAYLOAD_TOO_LARGE", "模板包不能超过 80 MiB")
	}
	z, e := zip.NewReader(f, size)
	if e != nil {
		return out, invalid("模板包不是有效 ZIP")
	}
	if len(z.File) > MaxFiles {
		return out, domain.E("PAYLOAD_TOO_LARGE", "模板包最多包含 20 个文件")
	}
	files := map[string]*zip.File{}
	var expanded uint64
	for _, entry := range z.File {
		if e = ctx.Err(); e != nil {
			return out, e
		}
		name := entry.Name
		if name == "" || path.IsAbs(name) || path.Clean(name) != name || strings.Contains(name, "\\") || strings.HasPrefix(name, "../") || entry.Mode()&os.ModeType != 0 || entry.Flags&1 != 0 {
			return out, invalid("模板包包含非法路径、链接或加密文件")
		}
		if _, exists := files[name]; exists {
			return out, invalid("模板包包含重复路径")
		}
		if entry.UncompressedSize64 > uint64(MaxExpanded) || expanded > uint64(MaxExpanded)-entry.UncompressedSize64 {
			return out, domain.E("PAYLOAD_TOO_LARGE", "模板解压大小不能超过 120 MiB")
		}
		expanded += entry.UncompressedSize64
		files[name] = entry
	}
	read := func(name string, limit int64) ([]byte, error) {
		file := files[name]
		if file == nil {
			return nil, invalid("模板包缺少必要文件")
		}
		if file.UncompressedSize64 > uint64(limit) {
			return nil, domain.E("PAYLOAD_TOO_LARGE", "模板文件超出大小限制")
		}
		r, e := file.Open()
		if e != nil {
			return nil, invalid("无法读取模板文件")
		}
		defer r.Close()
		b, e := io.ReadAll(io.LimitReader(r, limit+1))
		if e != nil || int64(len(b)) > limit {
			return nil, invalid("模板文件损坏或超出限制")
		}
		return b, nil
	}
	raw, e := read("manifest.json", 64<<10)
	if e != nil {
		return out, e
	}
	if e = strictJSON(raw, &out.Manifest); e != nil {
		return out, e
	}
	m := out.Manifest
	if m.Format != "fastposter" || m.Version != 1 || m.DocumentPath != "document.json" || len(m.Assets) != 1 || len(m.Fonts) > 100 || strings.TrimSpace(m.Title) == "" || utf8.RuneCountInString(m.Title) > 120 || strings.ContainsFunc(m.Title, unicode.IsControl) {
		return out, invalid("模板格式、版本或名称不受支持")
	}
	if m.Assets[0].Path != "assets/background.png" || !validHash(m.Assets[0].SHA256) {
		return out, invalid("背景路径或散列无效")
	}
	if len(files) != 3 {
		return out, invalid("模板包包含非约定文件，不能嵌入字体、脚本或其他压缩包")
	}
	for name := range files {
		if name != "manifest.json" && name != "document.json" && name != "assets/background.png" {
			return out, invalid("模板包包含多余文件")
		}
	}
	raw, e = read("document.json", 2<<20)
	if e != nil {
		return out, e
	}
	out.Document, e = document.Parse(raw)
	if e != nil {
		return out, invalid("模板文档无效或包含不支持的内容")
	}
	d := out.Document
	if d.Background.AssetID != m.Assets[0].AssetID || d.Background.Version != m.Assets[0].Version || len(m.Fonts) != len(d.Fonts) {
		return out, invalid("模板引用与清单不一致")
	}
	fontIDs := map[string]bool{}
	for _, font := range m.Fonts {
		if fontIDs[font.AssetID] || !validHash(font.SHA256) {
			return out, invalid("字体依赖无效")
		}
		fontIDs[font.AssetID] = true
		found := false
		for _, ref := range d.Fonts {
			if ref.AssetID == font.AssetID && ref.Version == font.Version && ref.Family == font.Family && ref.Weight == font.Weight && ref.Style == font.Style {
				found = true
			}
		}
		if !found {
			return out, invalid("字体依赖与正文不一致")
		}
	}
	background, e := read("assets/background.png", assets.MaxImageBytes)
	if e != nil {
		return out, e
	}
	sum := sha256.Sum256(background)
	if hex.EncodeToString(sum[:]) != strings.ToLower(m.Assets[0].SHA256) {
		return out, invalid("背景文件校验失败")
	}
	out.BackgroundPath = filepath.Join(dir, "background.png")
	if e = os.WriteFile(out.BackgroundPath, background, 0600); e != nil {
		return out, e
	}
	meta, e := assets.Probe(ctx, out.BackgroundPath)
	if e != nil {
		return out, e
	}
	if meta.Format != "png" || meta.Width != d.Canvas.Width || meta.Height != d.Canvas.Height {
		return out, invalid("背景格式或原图尺寸与文档不一致")
	}
	return out, nil
}
