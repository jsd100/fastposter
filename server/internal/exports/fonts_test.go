package exports

import (
	"encoding/json"
	"fastposter/server/internal/document"
	"fastposter/server/internal/fontfile"
	"golang.org/x/image/font/gofont/goregular"
	"os"
	"testing"
)

func TestExportCheckDefersWeightToReferencedBytes(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/documents/valid-mixed.json")
	if e != nil {
		t.Fatal(e)
	}
	var d document.Document
	json.Unmarshal(raw, &d)
	d.TextBlocks[0].Content.Content[0].Content[0].Marks = []document.Mark{{Type: "bold"}}
	if e = validateFontFaces(d); e != nil {
		t.Fatalf("cheap check rejected potentially variable bold: %v", e)
	}
	if e = fontfile.CheckDocument(d, func(document.FontRef) ([]byte, error) { return goregular.TTF, nil }); e == nil {
		t.Fatal("static font accepted as bold")
	}
}

func TestContinuousWeightCheapCheckUsesFamilyReference(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/documents/valid-mixed.json")
	if e != nil {
		t.Fatal(e)
	}
	var d document.Document
	json.Unmarshal(raw, &d)
	d.TextBlocks[0].Content.Content[0].Content[0].Marks = []document.Mark{{
		Type: "textStyle",
		Attrs: map[string]any{
			"fontId":     "font-1",
			"fontWeight": float64(250),
		},
	}}
	if e = validateFontFaces(d); e != nil {
		t.Fatalf("cheap check rejected a continuous weight from the same family: %v", e)
	}
	d.Fonts[0].AssetID = "unrelated-font"
	if e = validateFontFaces(d); e == nil {
		t.Fatal("missing reference accepted for a continuous weight")
	}
}
