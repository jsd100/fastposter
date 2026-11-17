package fontfile

import (
	"errors"
	"fastposter/server/internal/document"
	"golang.org/x/image/font/gofont/goregular"
	"os"
	"testing"
)

func TestFontMissingWeightNotSynthesized(t *testing.T) {
	if _, e := Parse(goregular.TTF, 700, "normal"); e == nil {
		t.Fatal("static normal font accepted as bold")
	}
}
func TestDocumentMissingGlyphIsExplicit(t *testing.T) {
	face, e := Parse(goregular.TTF, 400, "normal")
	if e != nil {
		t.Fatal(e)
	}
	d := document.Document{Fonts: []document.FontRef{{AssetID: "latin", Version: "1", Family: "Latin", Weight: 400, Style: "normal"}}, TextBlocks: []document.TextBlock{{DefaultStyle: document.InlineStyle{FontID: "latin", FontWeight: 400}, Content: document.Node{Type: "doc", Content: []document.Node{{Type: "paragraph", Content: []document.Node{{Type: "text", Text: "风景"}}}}}}}}
	if e = CheckDocument(d, func(ref document.FontRef) ([]byte, error) { return face.Data, nil }); e == nil {
		t.Fatal("Chinese silently fell back for Latin font")
	}
}

func TestVariableWeightUsesReferencedVersion(t *testing.T) {
	variable, e := os.ReadFile("../../../assets/fonts/NotoSansSC-VF.ttf")
	if e != nil {
		t.Fatal(e)
	}
	static := goregular.TTF
	damaged := []byte("not a font")

	type scenario struct {
		name       string
		version    string
		v1, v2     []byte
		text       string
		style      string
		selection  bool
		wantAccept bool
	}
	cases := []scenario{
		{name: "default weight from nominal 400 ref", version: "1", v1: variable, text: "风景", style: "normal", wantAccept: true},
		{name: "selection weight from nominal 400 ref", version: "1", v1: variable, text: "风景", style: "normal", selection: true, wantAccept: true},
		{name: "static file cannot cover 250", version: "1", v1: static, text: "Poster", style: "normal", wantAccept: false},
		{name: "file without italic cannot cover italic", version: "1", v1: variable, text: "Poster", style: "italic", wantAccept: false},
		{name: "damaged file is rejected", version: "1", v1: damaged, text: "Poster", style: "normal", wantAccept: false},
		{name: "same asset version 2 supplies the coverage", version: "2", v1: static, v2: variable, text: "风景", style: "normal", wantAccept: true},
		{name: "same asset stale version lacks the coverage", version: "1", v1: static, v2: variable, text: "Poster", style: "normal", wantAccept: false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			paragraph := document.Node{Type: "paragraph", Content: []document.Node{{Type: "text", Text: tt.text}}}
			marks := []document.Mark{}
			if tt.selection {
				marks = append(marks, document.Mark{
					Type:  "textStyle",
					Attrs: map[string]any{"fontId": "face", "fontWeight": 250},
				})
			}
			if tt.style == "italic" {
				marks = append(marks, document.Mark{Type: "italic"})
			}
			paragraph.Content[0].Marks = marks
			doc := document.Document{
				Fonts: []document.FontRef{{AssetID: "face", Version: tt.version, Family: "Noto Sans SC", Weight: 400, Style: "normal"}},
				TextBlocks: []document.TextBlock{{
					DefaultStyle: document.InlineStyle{FontID: "face", FontWeight: 250},
					Content:      document.Node{Type: "doc", Content: []document.Node{paragraph}},
				}},
			}
			load := func(ref document.FontRef) ([]byte, error) {
				if ref.AssetID != "face" {
					return nil, errors.New("unexpected asset")
				}
				switch ref.Version {
				case "1":
					return tt.v1, nil
				case "2":
					return tt.v2, nil
				default:
					return nil, errors.New("unexpected version")
				}
			}
			err := CheckDocument(doc, load)
			if tt.wantAccept && err != nil {
				t.Fatalf("variable reference rejected: %v", err)
			}
			if !tt.wantAccept && err == nil {
				t.Fatal("unsupported or unauthorized face accepted")
			}
		})
	}
}
