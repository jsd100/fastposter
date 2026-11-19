package integration_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fastposter/server/internal/document"
	"fastposter/server/internal/exports"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRenderMixedChineseFonts(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual Chrome rendering")
	}
	r, doc := renderFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	layer, report, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}})
	if e != nil {
		t.Fatal(e)
	}
	if layer.Bounds().Dx() != 1200 || layer.Bounds().Dy() != 1600 || report.Overflow || len(report.Blocks) != 1 || report.Blocks[0].Height <= 0 {
		t.Fatalf("invalid layout: %+v", report)
	}
	if _, _, _, a := layer.At(0, 0).RGBA(); a != 0 {
		t.Fatal("text layer background is opaque")
	}
	seenBase, seenAccent := false, false
	for y := 120; y < 500; y++ {
		for x := 80; x < 680; x++ {
			pixel := color.NRGBAModel.Convert(layer.At(x, y)).(color.NRGBA)
			if pixel.A == 255 && pixel.R == 35 && pixel.G == 76 && pixel.B == 60 {
				seenBase = true
			}
			if pixel.A == 255 && pixel.R == 200 && pixel.G == 100 && pixel.B == 69 {
				seenAccent = true
			}
		}
	}
	if !seenBase || !seenAccent {
		t.Fatal("mixed text colors were not rendered")
	}
	f, e := os.Create(filepath.Join(t.TempDir(), "text.png"))
	if e != nil {
		t.Fatal(e)
	}
	defer f.Close()
	if e = png.Encode(f, layer); e != nil {
		t.Fatal(e)
	}
}

func TestRenderCapacity(t *testing.T) {
	if os.Getenv("FASTPOSTER_CAPACITY_TEST") != "1" {
		t.Skip("set FASTPOSTER_CAPACITY_TEST=1 for upper-bound output tests")
	}
	for _, size := range []document.Canvas{{Width: 8192, Height: 4800}, {Width: 4800, Height: 8192}} {
		t.Run(fmt.Sprintf("%dx%d", size.Width, size.Height), func(t *testing.T) {
			r, doc := renderFixture(t)
			doc.Canvas = size
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			start := time.Now()
			img, _, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}})
			if e != nil {
				t.Fatal(e)
			}
			if img.Bounds().Dx() != size.Width || img.Bounds().Dy() != size.Height {
				t.Fatal("capacity image resized")
			}
			background := image.NewNRGBA(img.Bounds())
			background.SetNRGBA(size.Width-1, size.Height-1, color.NRGBA{R: 40, G: 80, B: 120, A: 255})
			composed, err := exports.Compose(background, img)
			if err != nil {
				t.Fatal(err)
			}
			var encoded bytes.Buffer
			if err = png.Encode(&encoded, composed); err != nil {
				t.Fatal(err)
			}
			metadata, err := png.DecodeConfig(bytes.NewReader(encoded.Bytes()))
			if err != nil || metadata.Width != size.Width || metadata.Height != size.Height {
				t.Fatal("final PNG dimensions changed")
			}
			if color.NRGBAModel.Convert(composed.At(size.Width-1, size.Height-1)) != (color.NRGBA{R: 40, G: 80, B: 120, A: 255}) {
				t.Fatal("uncovered background pixel changed")
			}
			t.Logf("original dimensions verified in %s", time.Since(start))
		})
	}
}
func TestRenderEmptyAndRepeatable(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("render test disabled")
	}
	r, doc := renderFixture(t)
	doc.Canvas = document.Canvas{Width: 800, Height: 600}
	fonts := []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	var digest [32]byte
	for i := range 2 {
		img, _, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: fonts})
		if e != nil {
			t.Fatal(e)
		}
		var encoded bytes.Buffer
		png.Encode(&encoded, img)
		hash := sha256.Sum256(encoded.Bytes())
		if i == 1 && hash != digest {
			t.Fatal("fixed-version rendering not deterministic")
		}
		digest = hash
	}
	doc.TextBlocks = []document.TextBlock{}
	img, _, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: fonts})
	if e != nil {
		t.Fatal(e)
	}
	for y := range 600 {
		for x := range 800 {
			if _, _, _, a := img.At(x, y).RGBA(); a != 0 {
				t.Fatal("empty text layer must be transparent")
			}
		}
	}
}
func TestRender4000x6000(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("render test disabled")
	}
	r, doc := renderFixture(t)
	doc.Canvas = document.Canvas{Width: 4000, Height: 6000}
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	img, _, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}})
	if e != nil {
		t.Fatal(e)
	}
	if img.Bounds().Dx() != 4000 || img.Bounds().Dy() != 6000 {
		t.Fatal("output dimensions changed")
	}
}
func TestRenderMissingFontFails(t *testing.T) {
	r, doc := renderFixture(t)
	_, _, e := r.RenderText(context.Background(), exports.RenderSnapshot{Document: doc})
	if e == nil {
		t.Fatal("missing font silently substituted")
	}
}

func TestRenderFractionalBlockAtRightEdge(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("render test disabled")
	}
	r, doc := renderFixture(t)
	doc.TextBlocks[0].X = .25
	doc.TextBlocks[0].Width = 1199.75
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	_, report, e := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}})
	if e != nil {
		t.Fatal(e)
	}
	if report.Overflow || report.Blocks[0].Width != 1199.75 {
		t.Fatalf("fractional width changed: %+v", report)
	}
}
func repoRoot(t *testing.T) string {
	t.Helper()
	p, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	return p
}

// chromePath follows the CHROME_PATH convention used by internal/config and
// playwright.config.ts. When unset, behaviour is unchanged on macOS.
func chromePath() string {
	if p := strings.TrimSpace(os.Getenv("CHROME_PATH")); p != "" {
		return p
	}
	return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
}

func renderFixture(t *testing.T) (*exports.Renderer, document.Document) {
	t.Helper()
	root := repoRoot(t)
	b, e := os.ReadFile(filepath.Join(root, "tests/fixtures/documents/valid-mixed.json"))
	if e != nil {
		t.Fatal(e)
	}
	var doc document.Document
	if e = json.Unmarshal(b, &doc); e != nil {
		t.Fatal(e)
	}
	return &exports.Renderer{ChromePath: chromePath(), RendererDir: filepath.Join(root, "apps/renderer/dist")}, doc
}

func TestRenderGradientWrapPreservesFillOverShadow(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual Chrome rendering")
	}
	r, doc := renderFixture(t)
	doc.SchemaVersion = 2
	doc.Canvas = document.Canvas{Width: 750, Height: 650}
	block := &doc.TextBlocks[0]
	block.X, block.Y, block.Width = 80, 120, 420
	block.DefaultStyle.FontSize = 72
	block.DefaultStyle.Color = document.TextColor{Gradient: &document.Gradient{
		Linear: &document.LinearGradient{Type: "linear", RangeID: "wrap", Angle: 0, Stops: []document.GradientStop{
			{Color: "#ff0000", Offset: 0}, {Color: "#0000ff", Offset: 100},
		}},
	}}
	block.Effects.BackgroundColor = "#00000000"
	block.Effects.StrokeWidth = 0
	block.Effects.ShadowColor = "#00000000"
	block.Content = document.Node{Type: "doc", Content: []document.Node{{Type: "paragraph", Content: []document.Node{
		{Type: "text", Text: "海报渐变测试世界你好可换行"},
		{Type: "text", Text: "独立纯绿", Marks: []document.Mark{{Type: "textStyle", Attrs: map[string]any{"color": "#00ff00"}}}},
	}}}}
	fonts := []exports.ResolvedFont{{AssetID: "font-1", Version: "1", Path: filepath.Join(repoRoot(t), "assets/fonts/NotoSansSC-VF.ttf"), Weight: 400, Style: "normal"}}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	render := func() (image.Image, exports.LayoutReport) {
		t.Helper()
		layer, report, err := r.RenderText(ctx, exports.RenderSnapshot{Document: doc, Fonts: fonts})
		if err != nil {
			t.Fatal(err)
		}
		return layer, report
	}
	clean, layout := render()
	block.Effects.ShadowColor = "#000000ff"
	block.Effects.ShadowX, block.Effects.ShadowY = 4, 4
	withShadow, shadowLayout := render()
	if shadowLayout.Blocks[0] != layout.Blocks[0] {
		t.Fatalf("paint changed the text box: %+v -> %+v", layout, shadowLayout)
	}
	var blueUpper, redLower, green, fill, intact, outsideShadow int
	for y := int(block.Y); y < doc.Canvas.Height; y++ {
		for x := int(block.X); x < int(block.X+block.Width); x++ {
			plain := color.NRGBAModel.Convert(clean.At(x, y)).(color.NRGBA)
			shadowed := color.NRGBAModel.Convert(withShadow.At(x, y)).(color.NRGBA)
			if plain.A == 255 && plain.G == 0 && (plain.R > 0 || plain.B > 0) {
				fill++
				if plain == shadowed {
					intact++
				}
				if y < int(block.Y)+90 && plain.B > plain.R {
					blueUpper++
				}
				if y > int(block.Y)+110 && plain.R > plain.B {
					redLower++
				}
			}
			if plain == (color.NRGBA{G: 255, A: 255}) {
				green++
			}
			if plain.A == 0 && shadowed == (color.NRGBA{A: 255}) {
				outsideShadow++
			}
		}
	}
	if blueUpper < 100 || redLower < 100 || green < 100 || fill == 0 || intact*100 < fill*95 || outsideShadow < 100 {
		t.Fatalf("unexpected paint: upper blue=%d lower red=%d green=%d intact fill=%d/%d shadow outside=%d", blueUpper, redLower, green, intact, fill, outsideShadow)
	}
}
