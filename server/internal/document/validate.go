package document

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"unicode/utf8"
)

var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,128}$`)
var versionPattern = regexp.MustCompile(`^\d+$`)
var colorPattern = regexp.MustCompile(`^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$`)

func Parse(raw []byte) (Document, error) {
	var d Document
	if len(raw) > 2<<20 {
		return d, errors.New("document exceeds 2 MiB")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if e := dec.Decode(&d); e != nil {
		return d, errors.New("invalid document JSON")
	}
	if e := dec.Decode(new(any)); e != io.EOF {
		return d, errors.New("trailing JSON")
	}
	return d, Validate(d)
}
func bounded(v, lo, hi float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= lo && v <= hi
}
func Validate(d Document) error {
	bad := func(s string) error { return fmt.Errorf("invalid document: %s", s) }
	if d.SchemaVersion != 1 {
		return bad("unsupported version")
	}
	w, h := d.Canvas.Width, d.Canvas.Height
	if w < 1 || h < 1 || w > 8192 || h > 8192 || int64(w)*int64(h) > 40000000 {
		return bad("canvas limits")
	}
	if !idPattern.MatchString(d.Background.AssetID) || !versionPattern.MatchString(d.Background.Version) {
		return bad("background reference")
	}
	if len(d.Fonts) > 100 || len(d.TextBlocks) > 100 {
		return bad("resource count")
	}
	fonts := map[string]bool{}
	for _, f := range d.Fonts {
		if !idPattern.MatchString(f.AssetID) || !versionPattern.MatchString(f.Version) || f.Family == "" || utf8.RuneCountInString(f.Family) > 128 || f.Weight < 100 || f.Weight > 900 || (f.Style != "normal" && f.Style != "italic") || fonts[f.AssetID] {
			return bad("font reference")
		}
		fonts[f.AssetID] = true
	}
	blocks := map[string]bool{}
	for _, b := range d.TextBlocks {
		if !idPattern.MatchString(b.ID) || blocks[b.ID] || !bounded(b.X, 0, float64(w)) || !bounded(b.Y, 0, float64(h)-0.000001) || !bounded(b.Width, 0.000001, float64(w)) || b.X+b.Width > float64(w) || b.ZIndex < 0 || b.ZIndex > 100000 {
			return bad("block geometry")
		}
		blocks[b.ID] = true
		st := b.DefaultStyle
		if !fonts[st.FontID] || !bounded(st.FontSize, 0.000001, 4096) || !colorPattern.MatchString(st.Color) || st.FontWeight < 100 || st.FontWeight > 900 {
			return bad("default text style")
		}
		p := b.ParagraphStyle
		if (p.Align != "left" && p.Align != "center" && p.Align != "right") || !bounded(p.LineHeight, .5, 5) || !bounded(p.LetterSpacing, -100, 1000) {
			return bad("paragraph style")
		}
		e := b.Effects
		if !bounded(e.Opacity, 0, 1) || !bounded(e.Padding, 0, 4096) || e.Padding*2 >= b.Width || !colorPattern.MatchString(e.BackgroundColor) || !colorPattern.MatchString(e.StrokeColor) || !colorPattern.MatchString(e.ShadowColor) || !bounded(e.StrokeWidth, 0, 100) || !bounded(e.ShadowBlur, 0, 500) || !bounded(e.ShadowX, -8192, 8192) || !bounded(e.ShadowY, -8192, 8192) {
			return bad("effects")
		}
		count, err := validateNode(b.Content, "doc", fonts)
		if err != nil || count > 10000 {
			return bad("rich text or character limit")
		}
	}
	return nil
}
func validateNode(n Node, expected string, fonts map[string]bool) (int, error) {
	fail := errors.New("invalid rich text")
	if n.Type != expected {
		return 0, fail
	}
	if expected == "doc" || expected == "paragraph" {
		if n.Text != "" || len(n.Marks) > 0 {
			return 0, fail
		}
		count := 0
		for _, c := range n.Content {
			want := "text"
			if expected == "doc" {
				want = "paragraph"
			} else if c.Type == "hardBreak" {
				want = "hardBreak"
			}
			v, e := validateNode(c, want, fonts)
			if e != nil {
				return 0, e
			}
			count += v
		}
		return count, nil
	}
	if len(n.Content) > 0 {
		return 0, fail
	}
	if expected == "hardBreak" {
		if n.Text != "" || len(n.Marks) > 0 {
			return 0, fail
		}
		return 1, nil
	}
	if n.Text == "" {
		return 0, fail
	}
	for _, m := range n.Marks {
		switch m.Type {
		case "bold", "italic", "underline", "strike":
			if len(m.Attrs) > 0 {
				return 0, fail
			}
		case "textStyle":
			for k, v := range m.Attrs {
				switch k {
				case "fontId":
					s, ok := v.(string)
					if !ok || !fonts[s] {
						return 0, fail
					}
				case "color":
					s, ok := v.(string)
					if !ok || !colorPattern.MatchString(s) {
						return 0, fail
					}
				case "fontSize":
					f, ok := v.(float64)
					if !ok || !bounded(f, 0.000001, 4096) {
						return 0, fail
					}
				case "fontWeight":
					f, ok := v.(float64)
					if !ok || !bounded(f, 100, 900) || f != math.Trunc(f) {
						return 0, fail
					}
				default:
					return 0, fail
				}
			}
		default:
			return 0, fail
		}
	}
	return utf8.RuneCountInString(n.Text), nil
}
