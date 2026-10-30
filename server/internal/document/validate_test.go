package document

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
)

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	b, e := os.ReadFile("../../../tests/fixtures/documents/" + name + ".json")
	if e != nil {
		t.Fatal(e)
	}
	return b
}
func TestSharedDocumentFixtures(t *testing.T) {
	for _, name := range []string{"valid-mixed", "overflow-width", "unknown-mark"} {
		d, e := Parse(fixture(t, name))
		if name == "valid-mixed" {
			if e != nil {
				t.Fatal(e)
			}
			out, _ := json.Marshal(d)
			if !strings.Contains(string(out), "#c86445") {
				t.Fatal("inline mark lost")
			}
		} else if e == nil {
			t.Errorf("%s accepted", name)
		}
	}
}
func TestDocumentLimits(t *testing.T) {
	var raw map[string]any
	json.Unmarshal(fixture(t, "valid-mixed"), &raw)
	for _, canvas := range []map[string]any{{"width": 8193, "height": 100}, {"width": 8192, "height": 8192}} {
		raw["canvas"] = canvas
		b, _ := json.Marshal(raw)
		if _, e := Parse(b); e == nil {
			t.Fatal("oversized canvas accepted")
		}
	}
	if _, e := Parse([]byte(strings.Repeat(" ", 2*1024*1024+1))); e == nil {
		t.Fatal("oversized payload accepted")
	}
}

func TestDocumentRejectsBlockAndCharacterLimits(t *testing.T) {
	d, e := Parse(fixture(t, "valid-mixed"))
	if e != nil {
		t.Fatal(e)
	}
	b := d.TextBlocks[0]
	d.TextBlocks = nil
	for i := range 101 {
		copy := b
		copy.ID = fmt.Sprintf("b%d", i)
		d.TextBlocks = append(d.TextBlocks, copy)
	}
	if Validate(d) == nil {
		t.Fatal("101 blocks accepted")
	}
	d.TextBlocks = []TextBlock{b}
	d.TextBlocks[0].Content = Node{Type: "doc", Content: []Node{{Type: "paragraph", Content: []Node{{Type: "text", Text: strings.Repeat("文", 10001)}}}}}
	if Validate(d) == nil {
		t.Fatal("10001 characters accepted")
	}
	d.TextBlocks = []TextBlock{b}
	d.TextBlocks[0].DefaultStyle.FontID = "missing"
	if Validate(d) == nil {
		t.Fatal("dangling font accepted")
	}
}
