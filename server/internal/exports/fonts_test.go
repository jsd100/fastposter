package exports

import (
	"encoding/json"
	"fastposter/server/internal/document"
	"os"
	"strings"
	"testing"
)

func TestMissingWeightIsNotSynthesized(t *testing.T) {
	raw, e := os.ReadFile("../../../tests/fixtures/documents/valid-mixed.json")
	if e != nil {
		t.Fatal(e)
	}
	var d document.Document
	json.Unmarshal(raw, &d)
	d.TextBlocks[0].Content.Content[0].Content[0].Marks = []document.Mark{{Type: "bold"}}
	if e = validateFontFaces(d); e == nil || !strings.Contains(e.Error(), "font weight unavailable") {
		t.Fatalf("missing weight accepted: %v", e)
	}
}
