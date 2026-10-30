package fontfile

import (
	"fastposter/server/internal/document"
	"golang.org/x/image/font/gofont/goregular"
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
