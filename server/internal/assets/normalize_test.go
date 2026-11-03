package assets

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math/rand/v2"
	"os"
	"path/filepath"
	"testing"
)

func fixture(name string) string { return filepath.Join("../../../tests/fixtures/images", name) }
func normalizer(t *testing.T) *Normalizer {
	t.Helper()
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	return &Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}
}

func TestNormalizedLosslessOutputCanExceedUploadSize(t *testing.T) {
	if os.Getenv("FASTPOSTER_IMAGE_CAPACITY_TEST") != "1" {
		t.Skip("set FASTPOSTER_IMAGE_CAPACITY_TEST=1 for large JPEG to PNG regression")
	}
	img := image.NewNRGBA(image.Rect(0, 0, 4096, 4096))
	random := rand.New(rand.NewPCG(1, 2))
	for i := 0; i < len(img.Pix); i += 4 {
		value := random.Uint64()
		img.Pix[i] = byte(value)
		img.Pix[i+1] = byte(value >> 8)
		img.Pix[i+2] = byte(value >> 16)
		img.Pix[i+3] = 255
	}
	dir := t.TempDir()
	source := filepath.Join(dir, "input.jpg")
	f, e := os.Create(source)
	if e != nil {
		t.Fatal(e)
	}
	e = jpeg.Encode(f, img, &jpeg.Options{Quality: 85})
	f.Close()
	if e != nil {
		t.Fatal(e)
	}
	st, _ := os.Stat(source)
	if st.Size() > 40*1024*1024 {
		t.Fatal("test JPEG exceeds upload limit")
	}
	out, e := normalizer(t).Normalize(context.Background(), source, filepath.Join(dir, "output.png"))
	if e != nil {
		t.Fatal(e)
	}
	st, e = os.Stat(out.Path)
	if e != nil || st.Size() <= 40*1024*1024 || out.Width != 4096 || out.Height != 4096 {
		t.Fatalf("expected full lossless output larger than upload budget; bytes %d", st.Size())
	}
}
func TestStaticFormatsAndEXIF(t *testing.T) {
	ctx := context.Background()
	for _, test := range []struct {
		name string
		w, h int
	}{{"rgba.png", 4, 3}, {"rgb.jpg", 4, 3}, {"static.webp", 4, 3}, {"oriented.jpg", 3, 4}, {"icc.png", 4, 3}} {
		t.Run(test.name, func(t *testing.T) {
			out, e := normalizer(t).Normalize(ctx, fixture(test.name), filepath.Join(t.TempDir(), "normalized.png"))
			if e != nil {
				t.Fatal(e)
			}
			if out.Width != test.w || out.Height != test.h {
				t.Fatalf("normalized dimensions %dx%d", out.Width, out.Height)
			}
			f, e := os.Open(out.Path)
			if e != nil {
				t.Fatal(e)
			}
			img, e := png.Decode(f)
			f.Close()
			if e != nil {
				t.Fatal(e)
			}
			if test.name == "rgba.png" || test.name == "icc.png" {
				if pixel := color.NRGBAModel.Convert(img.At(0, 0)); pixel != (color.NRGBA{R: 10, G: 20, B: 30, A: 255}) {
					t.Fatalf("unexpected color conversion %v", pixel)
				}
			}
			metadata, e := Probe(ctx, out.Path)
			if e != nil || metadata.BitDepth != 8 || metadata.HasICC {
				t.Fatal("output is not standardized 8-bit PNG")
			}
		})
	}
}
func TestRejectAnimatedAndHighBitDepth(t *testing.T) {
	for _, name := range []string{"animated.png", "animated.webp", "sixteen.png", "cmyk.jpg"} {
		if _, e := os.Stat(fixture(name)); e != nil {
			t.Fatal(e)
		}
		if _, e := Probe(context.Background(), fixture(name)); e == nil {
			t.Errorf("unsupported image accepted: %s", name)
		}
	}
}
func TestLimitsBeforeDecode(t *testing.T) {
	file := filepath.Join(t.TempDir(), "huge.png")
	f, e := os.Create(file)
	if e != nil {
		t.Fatal(e)
	}
	f.Truncate(40*1024*1024 + 1)
	f.Close()
	if _, e = Probe(context.Background(), file); e == nil {
		t.Fatal("oversized bytes accepted")
	}
	base, e := os.ReadFile(fixture("rgba.png"))
	if e != nil {
		t.Fatal(e)
	}
	for _, size := range [][2]uint32{{8193, 1}, {8192, 8192}} {
		b := append([]byte{}, base...)
		binary.BigEndian.PutUint32(b[16:20], size[0])
		binary.BigEndian.PutUint32(b[20:24], size[1])
		binary.BigEndian.PutUint32(b[29:33], crc32.ChecksumIEEE(b[12:29]))
		os.WriteFile(file, b, 0600)
		if _, e = Probe(context.Background(), file); e == nil {
			t.Fatal("oversized pixel dimensions accepted")
		}
	}
}
func TestCorruptAndMislabeledInput(t *testing.T) {
	bad := filepath.Join(t.TempDir(), "pretend.png")
	os.WriteFile(bad, []byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), 0600)
	if _, e := Probe(context.Background(), bad); e == nil {
		t.Fatal("extension trusted instead of file content")
	}
	b, _ := os.ReadFile(fixture("rgba.png"))
	b[len(b)/2] ^= 0xff
	os.WriteFile(bad, b, 0600)
	if _, e := Probe(context.Background(), bad); e == nil {
		t.Fatal("corrupt PNG accepted")
	}
	valid, _ := os.ReadFile(fixture("rgba.png"))
	misnamed := filepath.Join(t.TempDir(), "valid-jpeg-name.jpg")
	os.WriteFile(misnamed, valid, 0600)
	metadata, e := Probe(context.Background(), misnamed)
	if e != nil || metadata.Format != "png" || metadata.Width != 4 || metadata.Height != 3 {
		t.Fatalf("valid PNG with .jpg name rejected: %+v, %v", metadata, e)
	}
}

func TestNormalizeAtPixelAndSideLimits(t *testing.T) {
	if os.Getenv("FASTPOSTER_IMAGE_CAPACITY_TEST") != "1" {
		t.Skip("set FASTPOSTER_IMAGE_CAPACITY_TEST=1 for normalization capacity")
	}
	for _, size := range [][2]int{{8000, 5000}, {8192, 4882}, {4882, 8192}} {
		t.Run(fmt.Sprintf("%dx%d", size[0], size[1]), func(t *testing.T) {
			dir := t.TempDir()
			src := filepath.Join(dir, "in.png")
			f, e := os.Create(src)
			if e != nil {
				t.Fatal(e)
			}
			img := image.NewNRGBA(image.Rect(0, 0, size[0], size[1]))
			for i := 3; i < len(img.Pix); i += 4 {
				img.Pix[i] = 255
			}
			e = png.Encode(f, img)
			f.Close()
			if e != nil {
				t.Fatal(e)
			}
			out, e := normalizer(t).Normalize(context.Background(), src, filepath.Join(dir, "out.png"))
			if e != nil {
				t.Fatal(e)
			}
			if out.Width != size[0] || out.Height != size[1] {
				t.Fatal("normalization changed original dimensions")
			}
			file, e := os.Open(out.PreviewPath)
			if e != nil {
				t.Fatal(e)
			}
			cfg, e := png.DecodeConfig(file)
			file.Close()
			if e != nil || cfg.Width > 2048 || cfg.Height > 2048 {
				t.Fatal("invalid preview size", e)
			}
		})
	}
}
func TestCorruptJPEGRejectedByNormalizer(t *testing.T) {
	raw, e := os.ReadFile(fixture("rgb.jpg"))
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "bad.jpg")
	if e = os.WriteFile(path, raw[:len(raw)-8], 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = normalizer(t).Normalize(context.Background(), path, path+".png"); e == nil {
		t.Fatal("truncated JPEG accepted")
	}
}
