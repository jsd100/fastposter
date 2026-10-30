package fontfile

import (
	"encoding/binary"
	fontconvert "github.com/tdewolff/font"
	"os"
	"testing"
)

func TestFontActualWeightAndGlyphCoverage(t *testing.T) {
	b, e := os.ReadFile("../../../assets/fonts/Inter-VF.ttf")
	if e != nil {
		t.Fatal(e)
	}
	face, e := Parse(b, 400, "normal")
	if e != nil {
		t.Fatal(e)
	}
	if e = face.CheckText("Poster 2026"); e != nil {
		t.Fatal(e)
	}
	if e = face.CheckText("风景"); e == nil {
		t.Fatal("missing Chinese glyph silently accepted")
	}
	if _, e = Parse(b, 400, "italic"); e == nil {
		t.Fatal("normal face claimed as italic")
	}
}
func TestFontRejectsDecompressionBombAndFakeContainer(t *testing.T) {
	b := make([]byte, 48)
	copy(b, "wOF2")
	binary.BigEndian.PutUint32(b[8:12], 48)
	binary.BigEndian.PutUint32(b[16:20], 1<<30)
	if _, e := Parse(b, 400, "normal"); e == nil {
		t.Fatal("oversized decompression accepted")
	}
	if _, e := Parse([]byte("<html>fake font</html>"), 400, "normal"); e == nil {
		t.Fatal("non font accepted")
	}
}
func TestTrustedNormalizedFontCanExceedUploadBudget(t *testing.T) {
	b, e := os.ReadFile("../../../assets/fonts/Inter-VF.ttf")
	if e != nil {
		t.Fatal(e)
	}
	b = append(b, make([]byte, MaxUploadBytes-len(b)+1)...)
	if _, e = Parse(b, 400, "normal"); e == nil {
		t.Fatal("oversized upload accepted")
	}
	if _, e = ParseNormalized(b, 400, "normal"); e != nil {
		t.Fatal("trusted decoded font rejected", e)
	}
}
func TestWOFF2DecodesAndRetainsGlyphs(t *testing.T) {
	b, e := os.ReadFile("../../../assets/fonts/Inter-VF.ttf")
	if e != nil {
		t.Fatal(e)
	}
	source, e := fontconvert.ParseSFNT(b, 0)
	if e != nil {
		t.Fatal(e)
	}
	woff, e := source.WriteWOFF2()
	if e != nil {
		t.Fatal(e)
	}
	face, e := Parse(woff, 400, "normal")
	if e != nil {
		t.Fatal(e)
	}
	if e = face.CheckText("Hello 123"); e != nil {
		t.Fatal(e)
	}
}
