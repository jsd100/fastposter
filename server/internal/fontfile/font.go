package fontfile

import (
	"bytes"
	"encoding/binary"
	"fastposter/server/internal/domain"
	"fmt"
	"github.com/andybalholm/brotli"
	fontconvert "github.com/tdewolff/font"
	"golang.org/x/image/font/sfnt"
	"io"
	"unicode"
)

const MaxUploadBytes = 20 << 20
const MaxDecodedBytes = 30 << 20

func invalid() error { return domain.E("INVALID_FONT", "字体文件损坏或格式不受支持") }

type Face struct {
	Data   []byte
	Font   *sfnt.Font
	Weight int
	Style  string
}

func base128(b []byte, pos *int) (uint32, error) {
	var value uint32
	for i := 0; i < 5; i++ {
		if *pos >= len(b) {
			return 0, invalid()
		}
		v := b[*pos]
		*pos++
		if (i == 0 && v == 0x80) || value&0xfe000000 != 0 {
			return 0, invalid()
		}
		value = value<<7 | uint32(v&127)
		if v&128 == 0 {
			return value, nil
		}
	}
	return 0, invalid()
}
func preflightWOFF2(b []byte) error {
	if len(b) < 48 || binary.BigEndian.Uint32(b[8:12]) != uint32(len(b)) || binary.BigEndian.Uint32(b[16:20]) > MaxDecodedBytes {
		return invalid()
	}
	count := int(binary.BigEndian.Uint16(b[12:14]))
	if count < 1 || count > 128 {
		return invalid()
	}
	pos := 48
	var total uint64
	for range count {
		if pos >= len(b) {
			return invalid()
		}
		flags := b[pos]
		pos++
		index, version := flags&63, flags>>6
		tag := ""
		if index == 63 {
			if pos+4 > len(b) {
				return invalid()
			}
			tag = string(b[pos : pos+4])
			pos += 4
		} else {
			switch index {
			case 3:
				tag = "hmtx"
			case 10:
				tag = "glyf"
			case 11:
				tag = "loca"
			}
		}
		original, e := base128(b, &pos)
		if e != nil {
			return e
		}
		length := original
		if ((tag == "glyf" || tag == "loca") && version == 0) || (tag == "hmtx" && version == 1) {
			length, e = base128(b, &pos)
			if e != nil {
				return e
			}
		}
		if original > MaxDecodedBytes {
			return invalid()
		}
		total += uint64(length)
		if total > MaxDecodedBytes {
			return invalid()
		}
	}
	compressed := int(binary.BigEndian.Uint32(b[20:24]))
	if compressed < 1 || compressed > len(b)-pos {
		return invalid()
	}
	reader := brotli.NewReader(bytes.NewReader(b[pos : pos+compressed]))
	n, e := io.Copy(io.Discard, io.LimitReader(reader, MaxDecodedBytes+1))
	if e != nil || uint64(n) != total {
		return invalid()
	}
	return nil
}
func Parse(b []byte, weight int, style string) (*Face, error) {
	return parse(b, weight, style, MaxUploadBytes)
}
func ParseNormalized(b []byte, weight int, style string) (*Face, error) {
	return parse(b, weight, style, MaxDecodedBytes)
}
func parse(b []byte, weight int, style string, maxBytes int) (face *Face, err error) {
	defer func() {
		if recover() != nil {
			face = nil
			err = invalid()
		}
	}()
	if len(b) > maxBytes {
		return nil, domain.E("PAYLOAD_TOO_LARGE", "字体文件不能超过 20 MiB")
	}
	if len(b) < 12 || weight < 100 || weight > 900 || (style != "normal" && style != "italic") {
		return nil, invalid()
	}
	if string(b[:4]) == "wOF2" {
		if e := preflightWOFF2(b); e != nil {
			return nil, e
		}
		converted, e := fontconvert.ToSFNT(b)
		if e != nil {
			return nil, invalid()
		}
		b = converted
	} else if string(b[:4]) != "OTTO" && binary.BigEndian.Uint32(b[:4]) != 0x00010000 {
		return nil, invalid()
	}
	if len(b) > MaxDecodedBytes {
		return nil, invalid()
	}
	count := int(binary.BigEndian.Uint16(b[4:6]))
	if count < 1 || count > 128 || 12+16*count > len(b) {
		return nil, invalid()
	}
	tables := map[string][]byte{}
	for i := range count {
		record := b[12+16*i : 12+16*(i+1)]
		offset, length := uint64(binary.BigEndian.Uint32(record[8:12])), uint64(binary.BigEndian.Uint32(record[12:16]))
		if offset+length > uint64(len(b)) {
			return nil, invalid()
		}
		tag := string(record[:4])
		if _, exists := tables[tag]; exists {
			return nil, invalid()
		}
		tables[tag] = b[offset : offset+length]
	}
	os2 := tables["OS/2"]
	if len(os2) < 64 {
		return nil, invalid()
	}
	actualWeight := int(binary.BigEndian.Uint16(os2[4:6]))
	italic := binary.BigEndian.Uint16(os2[62:64])&1 != 0
	weightMatches := weight == actualWeight
	styleMatches := (style == "italic") == italic
	if fvar := tables["fvar"]; len(fvar) >= 16 {
		offset, count, size := int(binary.BigEndian.Uint16(fvar[4:6])), int(binary.BigEndian.Uint16(fvar[8:10])), int(binary.BigEndian.Uint16(fvar[10:12]))
		if count > 16 || size < 20 || offset+count*size > len(fvar) {
			return nil, invalid()
		}
		for i := range count {
			axis := fvar[offset+i*size : offset+i*size+20]
			min, max := float64(int32(binary.BigEndian.Uint32(axis[4:8])))/65536, float64(int32(binary.BigEndian.Uint32(axis[12:16])))/65536
			switch string(axis[:4]) {
			case "wght":
				weightMatches = float64(weight) >= min && float64(weight) <= max
			case "ital":
				want := 0.0
				if style == "italic" {
					want = 1
				}
				styleMatches = want >= min && want <= max
			case "slnt":
				if style == "italic" && (min < 0 || max > 0) {
					styleMatches = true
				}
			}
		}
	}
	if !weightMatches || !styleMatches {
		return nil, domain.E("MISSING_FONT", "文件未提供所声明的字重或斜体样式，不能使用合成字形")
	}
	parsed, e := sfnt.Parse(b)
	if e != nil {
		return nil, invalid()
	}
	return &Face{Data: b, Font: parsed, Weight: weight, Style: style}, nil
}
func (f *Face) CheckText(text string) error {
	var buffer sfnt.Buffer
	missing := []rune{}
	seen := map[rune]bool{}
	for _, r := range text {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			continue
		}
		glyph, e := f.Font.GlyphIndex(&buffer, r)
		if e != nil {
			return invalid()
		}
		if glyph == 0 && !seen[r] {
			seen[r] = true
			missing = append(missing, r)
			if len(missing) == 12 {
				break
			}
		}
	}
	if len(missing) > 0 {
		return domain.E("MISSING_GLYPH", fmt.Sprintf("所选字体缺少字形：%s，请更换字体", string(missing)))
	}
	return nil
}
