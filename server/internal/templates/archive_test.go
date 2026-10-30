package templates

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fmt"
	"io"
	"os"
	"testing"
)

func archiveFixture(t *testing.T) (Manifest, document.Document, []byte) {
	t.Helper()
	raw, e := os.ReadFile("../../../tests/fixtures/documents/valid-mixed.json")
	if e != nil {
		t.Fatal(e)
	}
	doc, e := document.Parse(raw)
	if e != nil {
		t.Fatal(e)
	}
	image, e := os.ReadFile("../../../tests/fixtures/images/editor.png")
	if e != nil {
		t.Fatal(e)
	}
	sum := sha256.Sum256(image)
	m := Manifest{Format: "fastposter", Version: 1, Title: "模板", DocumentPath: "document.json", Assets: []Asset{{AssetID: doc.Background.AssetID, Version: doc.Background.Version, Path: "assets/background.png", SHA256: hex.EncodeToString(sum[:])}}, Fonts: []Font{{AssetID: "font-1", Version: "1", Family: "Noto Sans SC", Weight: 400, Style: "normal", SHA256: hex.EncodeToString(sum[:])}}}
	return m, doc, image
}
func zipBytes(t *testing.T, files map[string][]byte, symlink string) []byte {
	t.Helper()
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	for name, body := range files {
		h := &zip.FileHeader{Name: name, Method: zip.Deflate}
		if name == symlink {
			h.SetMode(os.ModeSymlink | 0777)
		}
		f, e := w.CreateHeader(h)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = f.Write(body); e != nil {
			t.Fatal(e)
		}
	}
	if e := w.Close(); e != nil {
		t.Fatal(e)
	}
	return b.Bytes()
}
func TestArchiveRoundtripPreservesMixedMarks(t *testing.T) {
	m, d, image := archiveFixture(t)
	manifest, _ := json.Marshal(m)
	doc, _ := json.Marshal(d)
	raw := zipBytes(t, map[string][]byte{"manifest.json": manifest, "document.json": doc, "assets/background.png": image}, "")
	a, e := ReadArchive(context.Background(), bytes.NewReader(raw), t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(a.Document)
	if string(b) != string(doc) {
		t.Fatal("document marks changed")
	}
}
func TestArchiveLimitsAndPathTraversal(t *testing.T) {
	m, d, image := archiveFixture(t)
	manifest, _ := json.Marshal(m)
	doc, _ := json.Marshal(d)
	for _, name := range []string{"../escape", "/absolute.png", "assets/../escape.png", "assets/nested.zip", "script.html"} {
		files := map[string][]byte{"manifest.json": manifest, "document.json": doc, "assets/background.png": image, name: []byte("invalid")}
		if _, e := ReadArchive(context.Background(), bytes.NewReader(zipBytes(t, files, "")), t.TempDir()); e == nil {
			t.Fatal("unsafe or extra entry accepted", name)
		}
	}
	files := map[string][]byte{"manifest.json": manifest, "document.json": doc, "assets/background.png": image}
	if _, e := ReadArchive(context.Background(), bytes.NewReader(zipBytes(t, files, "assets/background.png")), t.TempDir()); e == nil {
		t.Fatal("symlink accepted")
	}
	for i := 0; i < 21; i++ {
		files[fmt.Sprintf("extra/%d", i)] = []byte("x")
	}
	if _, e := ReadArchive(context.Background(), bytes.NewReader(zipBytes(t, files, "")), t.TempDir()); e == nil {
		t.Fatal("file count exceeded")
	}
	if _, e := ReadArchive(context.Background(), io.LimitReader(zeroReader{}, 80*1024*1024+1), t.TempDir()); e == nil {
		t.Fatal("compressed byte limit exceeded")
	}
}

type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) { clear(p); return len(p), nil }
func TestArchiveExpandedAndCompressedLimitsAreIndependent(t *testing.T) {
	for _, size := range []uint64{uint64(MaxExpanded), uint64(MaxExpanded) + 1} {
		var raw bytes.Buffer
		z := zip.NewWriter(&raw)
		h := &zip.FileHeader{Name: "assets/background.png", Method: zip.Deflate, UncompressedSize64: size, CompressedSize64: 1}
		f, e := z.CreateRaw(h)
		if e != nil {
			t.Fatal(e)
		}
		f.Write([]byte{0})
		z.Close()
		_, e = ReadArchive(context.Background(), bytes.NewReader(raw.Bytes()), t.TempDir())
		var known *domain.Error
		if !errors.As(e, &known) {
			t.Fatal(e)
		}
		if size > uint64(MaxExpanded) && known.Code != "PAYLOAD_TOO_LARGE" {
			t.Fatal("expanded limit not enforced before decoding", e)
		}
		if size == uint64(MaxExpanded) && known.Code == "PAYLOAD_TOO_LARGE" {
			t.Fatal("exact expanded boundary rejected as over limit")
		}
	}
	_, e := ReadArchive(context.Background(), io.LimitReader(zeroReader{}, MaxCompressed+1), t.TempDir())
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "PAYLOAD_TOO_LARGE" {
		t.Fatal("compressed limit not distinguished", e)
	}
}
