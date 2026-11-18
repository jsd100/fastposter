package document

import (
	"encoding/json"
	"errors"
	"testing"
)

func writeFixtureDoc(t *testing.T, name string) Document {
	t.Helper()
	d, e := Parse(fixture(t, name))
	if e != nil {
		t.Fatal(e)
	}
	return d
}

func solidV2(t *testing.T) Document {
	t.Helper()
	d := writeFixtureDoc(t, "valid-mixed")
	d.SchemaVersion = 2
	return d
}

func TestWritePolicyGradientGate(t *testing.T) {
	v1Solid := writeFixtureDoc(t, "valid-mixed")
	v2Gradient := writeFixtureDoc(t, "gradient-v2")
	v2Solid := solidV2(t)

	cases := []struct {
		name    string
		enabled bool
		current int
		in      Document
		want    error
	}{
		{"v1 solid writes stay available", false, 0, v1Solid, nil},
		{"v2 gradient writes are closed by default", false, 0, v2Gradient, ErrGradientWritesDisabled},
		{"v2 gradient writes open when enabled", true, 0, v2Gradient, nil},
		{"solid-only v2 save stays available while closed", false, 2, v2Solid, nil},
		{"stale v2 gradient payload stays closed", false, 2, v2Gradient, ErrGradientWritesDisabled},
		{"v1 to v2 upgrade needs the gate", false, 1, v2Gradient, ErrGradientWritesDisabled},
		{"v1 to v2 upgrade allowed when open", true, 1, v2Gradient, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := (WritePolicy{GradientWrites: tc.enabled}).CheckWrite(tc.current, tc.in)
			if !errors.Is(got, tc.want) {
				t.Fatalf("CheckWrite() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestWritePolicyBlocksDowngradeEvenWhenOpen(t *testing.T) {
	v1Solid := writeFixtureDoc(t, "valid-mixed")
	for _, enabled := range []bool{false, true} {
		got := (WritePolicy{GradientWrites: enabled}).CheckWrite(2, v1Solid)
		if !errors.Is(got, ErrSchemaDowngrade) {
			t.Fatalf("enabled=%v: CheckWrite() = %v, want downgrade error", enabled, got)
		}
	}
}

func TestWritePolicyKeepsStructuralValidation(t *testing.T) {
	d := writeFixtureDoc(t, "valid-mixed")
	d.Canvas.Width = 8193
	if e := (WritePolicy{GradientWrites: true}).CheckWrite(0, d); e == nil {
		t.Fatal("invalid document accepted by write policy")
	}
}

func TestGradientDetectionCoversInlineMarks(t *testing.T) {
	// A gradient mark on an inline node must be detected even when no block
	// default style carries one.
	d := writeFixtureDoc(t, "valid-mixed")
	raw, e := json.Marshal(d)
	if e != nil {
		t.Fatal(e)
	}
	var wire map[string]any
	if e = json.Unmarshal(raw, &wire); e != nil {
		t.Fatal(e)
	}
	blocks := wire["textBlocks"].([]any)
	first := blocks[0].(map[string]any)
	first["defaultStyle"].(map[string]any)["color"] = "#284632"
	content := first["content"].(map[string]any)
	paragraph := content["content"].([]any)[0].(map[string]any)
	paragraph["content"].([]any)[0].(map[string]any)["marks"] = []any{map[string]any{
		"type": "textStyle",
		"attrs": map[string]any{"color": map[string]any{
			"type": "linear", "rangeId": "range-1", "angle": 90.0,
			"stops": []any{
				map[string]any{"color": "#FFB75E", "offset": 0.0},
				map[string]any{"color": "#ED8F03", "offset": 100.0},
			},
		}},
	}}
	wire["schemaVersion"] = 2
	encoded, _ := json.Marshal(wire)
	parsed, e := Parse(encoded)
	if e != nil {
		t.Fatal(e)
	}
	if !containsGradient(parsed) {
		t.Fatal("inline gradient mark not detected")
	}
	if e = (WritePolicy{}).CheckWrite(0, parsed); !errors.Is(e, ErrGradientWritesDisabled) {
		t.Fatalf("inline gradient not gated: %v", e)
	}
}
