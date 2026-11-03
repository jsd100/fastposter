package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"fastposter/server/internal/transport"
	hserver "github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/kitex/client"
	kserver "github.com/cloudwego/kitex/server"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAssetHTTPUploadAndPrivateRead(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	ctx := context.Background()
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"owner", "other"} {
		if _, e = accounts.Register(ctx, name, "correct horse battery"); e != nil {
			t.Fatal(e)
		}
	}
	owner, e := accounts.Login(ctx, "owner", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	other, e := accounts.Login(ctx, "other", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	dataDir := t.TempDir()
	store, e := storage.NewLocal(dataDir)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	root := repoRoot(t)
	svc := assets.NewService(db, store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	core := coreservice.NewServer(&transport.CoreHandler{AssetsFunc: transport.AssetsAdapter(accounts, svc)}, kserver.WithListener(listener))
	go core.Run()
	defer core.Stop()
	rpc, e := coreservice.NewClient("assets.test", client.WithHostPorts(listener.Addr().String()), client.WithRPCTimeout(30*time.Second))
	if e != nil {
		t.Fatal(e)
	}
	httpListener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	h := hserver.New(hserver.WithListener(httpListener), hserver.WithStreamBody(true), hserver.WithMaxRequestBodySize(82<<20))
	g := transport.Gateway{RPC: rpc, Store: store, AllowedOrigins: []string{"http://poster.test"}}
	g.BindUploads()
	g.Register(h)
	go h.Run()
	defer h.Close()
	base := "http://" + httpListener.Addr().String()
	web := &http.Client{Timeout: 10 * time.Second}
	upload := func(token, name string, raw []byte) *http.Response {
		t.Helper()
		var body bytes.Buffer
		w := multipart.NewWriter(&body)
		part, e := w.CreateFormFile("file", name)
		if e != nil {
			t.Fatal(e)
		}
		part.Write(raw)
		w.Close()
		req, e := http.NewRequest("POST", base+"/api/v1/assets/images", &body)
		if e != nil {
			t.Fatal(e)
		}
		req.Header.Set("Content-Type", w.FormDataContentType())
		req.Header.Set("Origin", "http://poster.test")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "fp_session", Value: token})
		}
		r, e := web.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		return r
	}
	pngFixture, e := os.ReadFile(filepath.Join(root, "tests/fixtures/images/rgba.png"))
	if e != nil {
		t.Fatal(e)
	}
	var portrait bytes.Buffer
	portraitImage := image.NewNRGBA(image.Rect(0, 0, 1152, 2048))
	for i := 3; i < len(portraitImage.Pix); i += 4 {
		portraitImage.Pix[i] = 255
	}
	if e = png.Encode(&portrait, portraitImage); e != nil {
		t.Fatal(e)
	}
	denied := upload("", "a.png", pngFixture)
	denied.Body.Close()
	if denied.StatusCode != 401 {
		t.Fatalf("anonymous upload: %d", denied.StatusCode)
	}
	spoofed := upload(owner.Token, "pretend.png", []byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))
	spoofed.Body.Close()
	if spoofed.StatusCode != 422 {
		t.Fatalf("spoofed content: %d", spoofed.StatusCode)
	}
	corruptFixture := append([]byte{}, pngFixture...)
	corruptFixture[len(corruptFixture)/2] ^= 0xff
	corrupt := upload(owner.Token, "broken.png", corruptFixture)
	corrupt.Body.Close()
	if corrupt.StatusCode != 422 {
		t.Fatalf("corrupt image: %d", corrupt.StatusCode)
	}
	mislabeled := upload(owner.Token, "portrait.jpg", portrait.Bytes())
	mislabeledRaw, e := io.ReadAll(mislabeled.Body)
	mislabeled.Body.Close()
	if e != nil || mislabeled.StatusCode != 200 {
		t.Fatalf("mislabeled upload %d: %s", mislabeled.StatusCode, mislabeledRaw)
	}
	var mislabeledPayload common.PublicPayload
	if e = json.Unmarshal(mislabeledRaw, &mislabeledPayload); e != nil || mislabeledPayload.Asset == nil {
		t.Fatalf("invalid mislabeled asset response %s", mislabeledRaw)
	}
	if got := mislabeledPayload.Asset.GetName(); got != "portrait.png" {
		t.Fatalf("normalized asset name %q", got)
	}
	if mislabeledPayload.Asset.GetWidth() != 1152 || mislabeledPayload.Asset.GetHeight() != 2048 {
		t.Fatalf("asset dimensions %dx%d", mislabeledPayload.Asset.GetWidth(), mislabeledPayload.Asset.GetHeight())
	}
	get := func(token, path string) *http.Response {
		t.Helper()
		req, e := http.NewRequest("GET", base+path, nil)
		if e != nil {
			t.Fatal(e)
		}
		req.AddCookie(&http.Cookie{Name: "fp_session", Value: token})
		req.Header.Set("Range", "bytes=0-1")
		res, e := web.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		return res
	}
	mislabeledRead := get(owner.Token, mislabeledPayload.Asset.GetUrl())
	mislabeledImage, e := png.Decode(mislabeledRead.Body)
	mislabeledRead.Body.Close()
	if e != nil || mislabeledRead.StatusCode != 200 || mislabeledRead.Header.Get("Content-Type") != "image/png" || mislabeledImage.Bounds().Dx() != 1152 || mislabeledImage.Bounds().Dy() != 2048 {
		t.Fatalf("mislabeled normalized response: %d %s %v", mislabeledRead.StatusCode, mislabeledRead.Header.Get("Content-Type"), e)
	}
	if disposition := mislabeledRead.Header.Get("Content-Disposition"); !strings.Contains(disposition, "portrait.png") {
		t.Fatalf("normalized download name %q", disposition)
	}
	uploaded := upload(owner.Token, "海报.png", pngFixture)
	raw, e := io.ReadAll(uploaded.Body)
	uploaded.Body.Close()
	if e != nil || uploaded.StatusCode != 200 {
		t.Fatalf("upload %d: %s", uploaded.StatusCode, raw)
	}
	if bytes.Contains(raw, []byte(dataDir)) || bytes.Contains(raw, []byte("fileKey")) || bytes.Contains(raw, []byte("normalized/")) {
		t.Fatal("internal storage detail exposed")
	}
	var payload common.PublicPayload
	if e = json.Unmarshal(raw, &payload); e != nil || payload.Asset == nil {
		t.Fatalf("invalid asset response %s", raw)
	}
	read := get(owner.Token, payload.Asset.GetUrl())
	img, e := png.Decode(read.Body)
	read.Body.Close()
	if e != nil || img.Bounds().Dx() != 4 || read.StatusCode != 200 || read.Header.Get("Content-Type") != "image/png" || !strings.Contains(read.Header.Get("Cache-Control"), "private") {
		t.Fatal("invalid private PNG response", e)
	}
	if strings.Contains(read.Header.Get("Content-Disposition"), "\r") {
		t.Fatal("unsafe filename")
	}
	for _, path := range []string{payload.Asset.GetUrl(), "/api/v1/assets/not-present/versions/1"} {
		r := get(other.Token, path)
		r.Body.Close()
		if r.StatusCode != 404 {
			t.Fatalf("asset existence leak %s: %d", path, r.StatusCode)
		}
	}
	var staged int
	if e = db.QueryRow("SELECT COUNT(*) FROM staged_uploads WHERE state IN ('staged','claimed')").Scan(&staged); e != nil || staged != 0 {
		t.Fatalf("unfinished upload %d: %v", staged, e)
	}
}
