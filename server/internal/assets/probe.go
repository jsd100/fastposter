package assets

import (
	"bytes"
	"context"
	"encoding/binary"
	"fastposter/server/internal/domain"
	_ "golang.org/x/image/webp"
	"hash/crc32"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
)

const MaxImageBytes int64 = 40 * 1024 * 1024

type ImageMetadata struct {
	Width, Height, BitDepth int
	Format                  string
	HasICC                  bool
	Size                    int64
}

func imageError(message string) error { return domain.E("INVALID_IMAGE", message) }
func imageLimit() error {
	return domain.E("IMAGE_LIMIT", "图片须满足单边不超过 8192 像素且总像素不超过 4000 万")
}
func checkDimensions(w, h int) error {
	if w < 1 || h < 1 || w > 8192 || h > 8192 || int64(w)*int64(h) > 40000000 {
		return imageLimit()
	}
	return nil
}
func Probe(ctx context.Context, path string) (ImageMetadata, error) {
	return probeFile(ctx, path, MaxImageBytes)
}
func probeFile(ctx context.Context, path string, maxBytes int64) (ImageMetadata, error) {
	var m ImageMetadata
	if e := ctx.Err(); e != nil {
		return m, e
	}
	f, e := os.Open(path)
	if e != nil {
		return m, e
	}
	defer f.Close()
	st, e := f.Stat()
	if e != nil || !st.Mode().IsRegular() {
		return m, imageError("图片文件不可读取")
	}
	if st.Size() > maxBytes {
		return m, domain.E("PAYLOAD_TOO_LARGE", "图片文件不能超过 40 MiB")
	}
	b, e := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if e != nil {
		return m, e
	}
	m.Size = int64(len(b))
	if m.Size > maxBytes {
		return m, domain.E("PAYLOAD_TOO_LARGE", "图片文件不能超过 40 MiB")
	}
	m.BitDepth = 8
	switch {
	case len(b) >= 33 && bytes.Equal(b[:8], []byte("\x89PNG\r\n\x1a\n")):
		m.Format = "png"
		m.Width = int(binary.BigEndian.Uint32(b[16:20]))
		m.Height = int(binary.BigEndian.Uint32(b[20:24]))
		m.BitDepth = int(b[24])
		if e = checkDimensions(m.Width, m.Height); e != nil {
			return m, e
		}
		if m.BitDepth > 8 {
			return m, domain.E("UNSUPPORTED_IMAGE", "首版仅支持不超过 8 位的静态图片")
		}
		ended := false
		for pos := 8; pos < len(b); {
			if len(b)-pos < 12 {
				return m, imageError("PNG 文件不完整")
			}
			length := int(binary.BigEndian.Uint32(b[pos : pos+4]))
			if length < 0 || length > len(b)-pos-12 {
				return m, imageError("PNG 数据长度不正确")
			}
			name := string(b[pos+4 : pos+8])
			payload := b[pos+4 : pos+8+length]
			if crc32.ChecksumIEEE(payload) != binary.BigEndian.Uint32(b[pos+8+length:pos+12+length]) {
				return m, imageError("PNG 校验失败")
			}
			if name == "acTL" {
				return m, domain.E("UNSUPPORTED_IMAGE", "首版不支持动图")
			}
			if name == "iCCP" {
				m.HasICC = true
			}
			pos += length + 12
			if name == "IEND" {
				if pos != len(b) {
					return m, imageError("PNG 末尾包含额外数据")
				}
				ended = true
				break
			}
		}
		if !ended {
			return m, imageError("PNG 缺少结束标记")
		}
	case len(b) >= 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff:
		m.Format = "jpeg"
		// ImageMagick may silently recover a truncated scan. Require the
		// end-of-image marker before allowing it to normalize an upload.
		if len(b) < 4 || b[len(b)-2] != 0xff || b[len(b)-1] != 0xd9 {
			return m, imageError("JPEG 文件不完整或末尾包含额外数据")
		}
		m.HasICC = bytes.Contains(b, []byte("ICC_PROFILE\x00"))
	case len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP":
		m.Format = "webp"
		if int64(binary.LittleEndian.Uint32(b[4:8]))+8 != int64(len(b)) {
			return m, imageError("WebP 容器长度不正确")
		}
		for pos := 12; pos < len(b); {
			if len(b)-pos < 8 {
				return m, imageError("WebP 文件不完整")
			}
			name := string(b[pos : pos+4])
			length := int(binary.LittleEndian.Uint32(b[pos+4 : pos+8]))
			if length < 0 || length > len(b)-pos-8 {
				return m, imageError("WebP 数据长度不正确")
			}
			if name == "ANIM" || name == "ANMF" || (name == "VP8X" && length > 0 && b[pos+8]&2 != 0) {
				return m, domain.E("UNSUPPORTED_IMAGE", "首版不支持动图")
			}
			if name == "ICCP" {
				m.HasICC = true
			}
			pos += 8 + length + (length % 2)
		}
	default:
		return m, domain.E("UNSUPPORTED_IMAGE", "仅支持静态 JPG、PNG、WebP 图片")
	}
	cfg, format, e := image.DecodeConfig(bytes.NewReader(b))
	if e != nil || format != m.Format {
		return m, imageError("图片文件损坏或编码不受支持")
	}
	if _, cmyk := cfg.ColorModel.Convert(color.RGBA{}).(color.CMYK); cmyk {
		return m, domain.E("UNSUPPORTED_IMAGE", "首版不支持 CMYK 图片")
	}
	m.Width, m.Height = cfg.Width, cfg.Height
	if e = checkDimensions(m.Width, m.Height); e != nil {
		return m, e
	}
	return m, nil
}
