package exports

import (
	"image"
	"image/color"
	"testing"
)

func TestComposePreservesUncoveredPixelsAndAlpha(t *testing.T) {
	bg := image.NewNRGBA(image.Rect(0, 0, 3, 3))
	for y := range 3 {
		for x := range 3 {
			bg.SetNRGBA(x, y, color.NRGBA{20, 120, 200, 128})
		}
	}
	bg.SetNRGBA(0, 0, color.NRGBA{40, 90, 130, 0})
	text := image.NewNRGBA(bg.Bounds())
	text.SetNRGBA(1, 1, color.NRGBA{200, 10, 40, 255})
	out, e := Compose(bg, text)
	if e != nil {
		t.Fatal(e)
	}
	for y := range 3 {
		for x := range 3 {
			got := color.NRGBAModel.Convert(out.At(x, y))
			if x == 1 && y == 1 {
				if got != (color.NRGBA{200, 10, 40, 255}) {
					t.Fatal("opaque text not applied")
				}
			} else if got != bg.NRGBAAt(x, y) {
				t.Fatalf("background pixel changed at %d,%d: %v", x, y, got)
			}
		}
	}
	if out.Bounds() != bg.Bounds() {
		t.Fatal("output resized")
	}
}
func TestComposeRejectsDifferentSizes(t *testing.T) {
	if _, e := Compose(image.NewNRGBA(image.Rect(0, 0, 3, 3)), image.NewNRGBA(image.Rect(0, 0, 2, 2))); e == nil {
		t.Fatal("mismatched layers accepted")
	}
}
