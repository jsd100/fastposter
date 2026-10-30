package exports

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/server/internal/document"
	"fmt"
	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/emulation"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"image"
	"image/png"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type ResolvedFont struct {
	AssetID string
	Version string
	Path    string
	Weight  int
	Style   string
}
type RenderSnapshot struct {
	Document        document.Document
	Fonts           []ResolvedFont
	RendererVersion string
}
type BlockBounds struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}
type LayoutReport struct {
	Width    int           `json:"width"`
	Height   int           `json:"height"`
	Blocks   []BlockBounds `json:"blocks"`
	Overflow bool          `json:"overflow"`
}
type Renderer struct {
	ChromePath  string
	RendererDir string
}

func (r *Renderer) RenderText(ctx context.Context, snapshot RenderSnapshot) (image.Image, LayoutReport, error) {
	var report LayoutReport
	d := snapshot.Document
	if e := document.Validate(d); e != nil {
		return nil, report, e
	}
	if e := validateFontFaces(d); e != nil {
		return nil, report, e
	}
	fonts := map[string]ResolvedFont{}
	for _, f := range snapshot.Fonts {
		if _, e := os.Stat(f.Path); e != nil {
			return nil, report, errors.New("font file unavailable")
		}
		fonts[f.AssetID] = f
	}
	for _, ref := range d.Fonts {
		f, ok := fonts[ref.AssetID]
		if !ok || f.Version != ref.Version || f.Weight != ref.Weight || f.Style != ref.Style {
			return nil, report, fmt.Errorf("font version unavailable: %s", ref.AssetID)
		}
	}
	if _, e := os.Stat(filepath.Join(r.RendererDir, "index.html")); e != nil {
		return nil, report, errors.New("renderer build unavailable")
	}
	var nonce [24]byte
	if _, e := rand.Read(nonce[:]); e != nil {
		return nil, report, e
	}
	token := hex.EncodeToString(nonce[:])
	prefix := "/" + token + "/"
	mux := http.NewServeMux()
	mux.Handle(prefix+"font/", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		id := req.URL.Path[len(prefix+"font/"):]
		f, ok := fonts[id]
		if !ok {
			http.NotFound(w, req)
			return
		}
		w.Header().Set("Content-Type", "font/ttf")
		http.ServeFile(w, req, f.Path)
	}))
	static := http.StripPrefix(prefix, http.FileServer(http.Dir(r.RendererDir)))
	mux.Handle(prefix, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'")
		static.ServeHTTP(w, req)
	}))
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		return nil, report, e
	}
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go srv.Serve(listener)
	defer srv.Close()
	base := "http://" + listener.Addr().String() + prefix
	payload := struct {
		Document document.Document `json:"document"`
		Fonts    []map[string]any  `json:"fonts"`
	}{Document: d, Fonts: []map[string]any{}}
	for _, f := range snapshot.Fonts {
		family := ""
		for _, ref := range d.Fonts {
			if ref.AssetID == f.AssetID {
				family = ref.Family
				break
			}
		}
		payload.Fonts = append(payload.Fonts, map[string]any{"assetId": f.AssetID, "family": family, "version": f.Version, "url": base + "font/" + f.AssetID, "weight": f.Weight, "style": f.Style})
	}
	raw, e := json.Marshal(payload)
	if e != nil {
		return nil, report, e
	}
	opts := append([]chromedp.ExecAllocatorOption{}, chromedp.DefaultExecAllocatorOptions[:]...)
	opts = append(opts, chromedp.ExecPath(r.ChromePath), chromedp.Flag("hide-scrollbars", true), chromedp.Flag("force-color-profile", "srgb"))
	allocator, cancelAllocator := chromedp.NewExecAllocator(ctx, opts...)
	defer cancelAllocator()
	browser, cancelBrowser := chromedp.NewContext(allocator)
	defer cancelBrowser()
	var screenshot []byte
	w, h := int64(d.Canvas.Width), int64(d.Canvas.Height)
	e = chromedp.Do(browser, chromedp.Func(func(ctx context.Context, target *chromedp.Target) error {
		if _, err := cdp.Call(ctx, target, emulation.SetDeviceMetricsOverride, emulation.SetDeviceMetricsOverrideParams{Width: w, Height: h, DeviceScaleFactor: 1, Mobile: false}); err != nil {
			return err
		}
		// cdproto's RGBA currently omits alpha=0, whose protocol default is 1.
		// This command intentionally serializes the alpha field even when zero.
		type transparentRGBA struct {
			R int     `json:"r"`
			G int     `json:"g"`
			B int     `json:"b"`
			A float64 `json:"a"`
		}
		type backgroundParams struct {
			Color transparentRGBA `json:"color"`
		}
		command := cdp.Command[backgroundParams, cdp.Empty]{Method: emulation.CommandSetDefaultBackgroundColorOverride}
		_, err := cdp.Call(ctx, target, command, backgroundParams{Color: transparentRGBA{}})
		return err
	}), chromedp.Navigate(base), chromedp.WaitReady(chromedp.CSS("body")))
	if e == nil {
		report, e = chromedp.Run(browser, chromedp.Evaluate[LayoutReport]("window.renderPoster("+string(raw)+")", chromedp.EvalAwaitPromise))
	}
	if e == nil {
		screenshot, e = chromedp.Run(browser, func(ctx context.Context, target *chromedp.Target) ([]byte, error) {
			capture, err := cdp.Call(ctx, target, page.CaptureScreenshot, page.CaptureScreenshotParams{Format: page.CaptureScreenshotFormatPng, CaptureBeyondViewport: new(true), Clip: &page.Viewport{X: 0, Y: 0, Width: float64(w), Height: float64(h), Scale: 1}})
			return capture.Data, err
		})
	}
	if e != nil {
		return nil, report, fmt.Errorf("render text: %w", e)
	}
	img, e := png.Decode(bytes.NewReader(screenshot))
	if e != nil {
		return nil, report, e
	}
	if img.Bounds().Dx() != int(w) || img.Bounds().Dy() != int(h) {
		return nil, report, errors.New("render output dimensions mismatch: " + strconv.Itoa(img.Bounds().Dx()))
	}
	return img, report, nil
}
