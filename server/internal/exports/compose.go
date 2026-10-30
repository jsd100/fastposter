package exports

import (
	"errors"
	"image"
	"image/draw"
)

func Compose(background image.Image, text image.Image) (image.Image, error) {
	if background == nil || text == nil || background.Bounds() != text.Bounds() {
		return nil, errors.New("background and text must have identical bounds")
	}
	out := image.NewNRGBA(background.Bounds())
	draw.Draw(out, out.Bounds(), background, background.Bounds().Min, draw.Src)
	// Do not composite fully transparent overlay pixels: draw.Over otherwise
	// normalizes hidden RGB in alpha-zero background pixels and violates the
	// unchanged-background guarantee.
	for y := out.Bounds().Min.Y; y < out.Bounds().Max.Y; y++ {
		for x := out.Bounds().Min.X; x < out.Bounds().Max.X; x++ {
			if _, _, _, a := text.At(x, y).RGBA(); a != 0 {
				draw.Draw(out, image.Rect(x, y, x+1, y+1), text, image.Pt(x, y), draw.Over)
			}
		}
	}
	return out, nil
}
