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

func TestGradientFixtures(t *testing.T) {
	dir := "../../../tests/fixtures/documents/"
	read := func(name string) []byte {
		b, e := os.ReadFile(dir + name)
		if e != nil {
			t.Fatal(e)
		}
		return b
	}
	if _, e := Parse(read("gradient-v2.json")); e != nil {
		t.Fatal("valid v2 gradient rejected", e)
	}
	if _, e := Parse(read("valid-mixed.json")); e != nil {
		t.Fatal("plain v1 rejected", e)
	}
	for _, name := range []string{
		"gradient-in-v1.json",
		"gradient-conflicting-range.json",
		"gradient-nine-stops.json",
		"gradient-offset-out-of-range.json",
		"gradient-unknown-key.json",
	} {
		if _, e := Parse(read(name)); e == nil {
			t.Fatalf("invalid fixture accepted: %s", name)
		}
	}
	// v2 keeps accepting a solid-only document unchanged.
	var solid map[string]any
	if e := json.Unmarshal(fixture(t, "valid-mixed"), &solid); e != nil {
		t.Fatal(e)
	}
	solid["schemaVersion"] = 2
	solidRaw, _ := json.Marshal(solid)
	if _, e := Parse(solidRaw); e != nil {
		t.Fatal("v2 solid document rejected", e)
	}
	// Gradients survive Parse -> Marshal -> Parse with their wire shape intact.
	parsed, e := Parse(read("gradient-v2.json"))
	if e != nil {
		t.Fatal(e)
	}
	roundTrip, e := json.Marshal(parsed)
	if e != nil {
		t.Fatal(e)
	}
	again, e := Parse(roundTrip)
	if e != nil {
		t.Fatal("gradient lost on re-serialization", e)
	}
	if again.TextBlocks[0].DefaultStyle.Color.Gradient == nil ||
		again.TextBlocks[0].DefaultStyle.Color.Gradient.Linear == nil {
		t.Fatal("default gradient lost on round trip")
	}
	normalized, e := Parse(read("gradient-angle-normalize.json"))
	if e != nil {
		t.Fatal(e)
	}
	angle := normalized.TextBlocks[0].DefaultStyle.Color.Gradient.Linear.Angle
	if angle != 45 {
		t.Fatalf("angle not normalized: %v", angle)
	}
}

func withGradientColors(t *testing.T, defaultColor, inlineColor string) []byte {
	t.Helper()
	var wire struct {
		SchemaVersion int              `json:"schemaVersion"`
		Canvas        json.RawMessage  `json:"canvas"`
		Background    json.RawMessage  `json:"background"`
		Fonts         json.RawMessage  `json:"fonts"`
		TextBlocks    []map[string]any `json:"textBlocks"`
	}
	if e := json.Unmarshal(fixture(t, "gradient-v2"), &wire); e != nil {
		t.Fatal(e)
	}
	wire.TextBlocks = wire.TextBlocks[:1]
	block := wire.TextBlocks[0]
	block["defaultStyle"].(map[string]any)["color"] = json.RawMessage(defaultColor)
	block["content"] = json.RawMessage(fmt.Sprintf(`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"字","marks":[{"type":"textStyle","attrs":{"color":%s}}]}]}]}`, inlineColor))
	raw, e := json.Marshal(wire)
	if e != nil {
		t.Fatal(e)
	}
	return raw
}

func TestGradientRejectsIncorrectKeysAndMissingNumbers(t *testing.T) {
	for _, color := range []string{
		`{"TYPE":"linear","rangeId":"a","angle":0,"stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`,
		`{"type":"linear","rangeId":"a","stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`,
		`{"type":"linear","rangeId":"a","angle":null,"stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`,
		`{"type":"radial","rangeId":"a","centerY":50,"stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`,
		`{"type":"radial","rangeId":"a","centerX":50,"centerY":null,"stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`,
		`{"type":"linear","rangeId":"a","angle":0,"stops":[{"color":"#111111","OFFSET":0},{"color":"#222222","offset":100}]}`,
		`{"type":"linear","rangeId":"a","angle":0,"stops":[{"color":"#111111"},{"color":"#222222","offset":100}]}`,
		`{"type":"linear","rangeId":"a","angle":0,"stops":[{"color":"#111111","offset":null},{"color":"#222222","offset":100}]}`,
	} {
		for _, raw := range [][]byte{
			withGradientColors(t, color, `"#111111"`),
			withGradientColors(t, `"#111111"`, color),
		} {
			if _, e := Parse(raw); e == nil {
				t.Errorf("invalid gradient accepted: %s", color)
			}
		}
	}
}

func TestEquivalentGradientRangesCanonicalizeAnglesAndStops(t *testing.T) {
	defaultColor := `{"type":"linear","rangeId":"a","angle":0.1,"stops":[{"color":"#111111","offset":60},{"color":"#222222","offset":40},{"color":"#333333","offset":100}]}`
	inlineColor := `{"type":"linear","rangeId":"a","angle":360.1,"stops":[{"color":"#111111","offset":60},{"color":"#222222","offset":60},{"color":"#333333","offset":100}]}`
	d, e := Parse(withGradientColors(t, defaultColor, inlineColor))
	if e != nil {
		t.Fatal(e)
	}
	color := d.TextBlocks[0].DefaultStyle.Color.Gradient.Linear
	if color.Angle != 0.10000000000002274 || color.Stops[1].Offset != 60 {
		t.Fatalf("unexpected normalization: %+v", color)
	}
	raw, e := json.Marshal(d)
	if e != nil {
		t.Fatal(e)
	}
	if strings.Count(string(raw), `"angle":0.10000000000002274`) != 2 {
		t.Fatalf("inline gradient was not normalized: %s", raw)
	}
}

func TestEquivalentGradientRangesAcceptSignedZero(t *testing.T) {
	color := `{"type":"radial","rangeId":"a","centerX":0,"centerY":0,"stops":[{"color":"#111111","offset":0},{"color":"#222222","offset":100}]}`
	negativeZero := strings.ReplaceAll(strings.ReplaceAll(color, `"offset":0`, `"offset":-0`), `"centerX":0`, `"centerX":-0`)
	if _, e := Parse(withGradientColors(t, color, negativeZero)); e != nil {
		t.Fatal(e)
	}
}
