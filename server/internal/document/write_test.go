package document

import (
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

func TestCheckWrite(t *testing.T) {
	v1Solid := writeFixtureDoc(t, "valid-mixed")
	v2Gradient := writeFixtureDoc(t, "gradient-v2")
	v2Solid := v1Solid
	v2Solid.SchemaVersion = 2

	cases := []struct {
		name    string
		current int
		in      Document
		want    error
	}{
		{"create v1 solid", 0, v1Solid, nil},
		{"create v2 gradient", 0, v2Gradient, nil},
		{"create v2 solid", 0, v2Solid, nil},
		{"upgrade to v2 gradient", 1, v2Gradient, nil},
		{"save v2 gradient", 2, v2Gradient, nil},
		{"save v2 solid", 2, v2Solid, nil},
		{"reject downgrade to v1", 2, v1Solid, ErrSchemaDowngrade},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CheckWrite(tc.current, tc.in); !errors.Is(got, tc.want) {
				t.Fatalf("CheckWrite() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCheckWriteKeepsStructuralValidation(t *testing.T) {
	d := writeFixtureDoc(t, "gradient-v2")
	d.Canvas.Width = 8193
	if e := CheckWrite(0, d); e == nil {
		t.Fatal("invalid document accepted")
	}
}
