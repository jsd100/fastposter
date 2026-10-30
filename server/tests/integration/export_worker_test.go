package integration_test

import (
	"context"
	"encoding/json"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/document"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestExportWorkerRendersRealPNG(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual worker rendering")
	}
	p, db, doc := projectService(t)
	ctx := context.Background()
	root := repoRoot(t)
	images := assets.NewService(db, p.Store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	if e := images.BootstrapFonts(ctx, root); e != nil {
		t.Fatal(e)
	}
	input, e := os.Open(filepath.Join(root, "tests/fixtures/images/editor.png"))
	if e != nil {
		t.Fatal(e)
	}
	background, e := images.Upload(ctx, projectOwner(), "editor.png", input)
	input.Close()
	if e != nil {
		t.Fatal(e)
	}
	doc.Background = document.AssetRef{AssetID: background.ID, Version: background.Version}
	doc.Fonts = []document.FontRef{{AssetID: "builtin-noto-sc-400", Version: "1", Family: "Noto Sans SC", Weight: 400, Style: "normal"}}
	doc.TextBlocks[0].DefaultStyle.FontID = "builtin-noto-sc-400"
	var rebind func(*document.Node)
	rebind = func(n *document.Node) {
		for i := range n.Marks {
			if _, ok := n.Marks[i].Attrs["fontId"]; ok {
				n.Marks[i].Attrs["fontId"] = "builtin-noto-sc-400"
			}
		}
		for i := range n.Content {
			rebind(&n.Content[i])
		}
	}
	rebind(&doc.TextBlocks[0].Content)
	a, e := p.Create(ctx, projectOwner(), "worker", doc)
	if e != nil {
		t.Fatal(e)
	}
	s := exports.NewService(db, p.Store, p)
	job, e := s.Create(ctx, projectOwner(), a.ID, "1", "worker-real")
	if e != nil {
		t.Fatal(e)
	}
	lease, e := s.Claim(ctx, "worker-test", time.Now().UTC())
	if e != nil || lease == nil {
		t.Fatal("no job", e)
	}
	worker := exports.Worker{Service: s, Renderer: &exports.Renderer{ChromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", RendererDir: filepath.Join(root, "apps/renderer/dist")}, TempRoot: t.TempDir()}
	if e = worker.Process(ctx, *lease); e != nil {
		t.Fatal(e)
	}
	out, e := s.Get(ctx, projectOwner(), job.ID)
	if e != nil || out.State != "succeeded" {
		t.Fatalf("job %s %s: %v", out.State, out.ErrorMessage, e)
	}
	file, e := p.Store.Open(ctx, out.ResultKey)
	if e != nil {
		t.Fatal(e)
	}
	img, e := png.Decode(file)
	file.Close()
	if e != nil || img.Bounds().Dx() != 1200 || img.Bounds().Dy() != 1600 {
		t.Fatal("native dimensions lost", e)
	}
	if got := color.NRGBAModel.Convert(img.At(0, 0)); got != (color.NRGBA{R: 229, G: 234, B: 223, A: 255}) {
		t.Fatal("uncovered background pixel changed", got)
	}
	var changed bool
	for y := 120; y < 500; y++ {
		for x := 80; x < 680; x++ {
			if color.NRGBAModel.Convert(img.At(x, y)) != (color.NRGBA{R: 229, G: 234, B: 223, A: 255}) {
				changed = true
				break
			}
		}
	}
	if !changed {
		t.Fatal("text layer missing from final PNG")
	}
	t.Run("disk full never succeeds", func(t *testing.T) {
		faulty := exports.NewService(db, diskFullStore{p.Store}, p)
		job, e := faulty.Create(ctx, projectOwner(), a.ID, "1", "disk-full")
		if e != nil {
			t.Fatal(e)
		}
		lease, e := faulty.Claim(ctx, "disk-worker", time.Now().UTC())
		if e != nil || lease == nil {
			t.Fatal(e)
		}
		w := worker
		w.Service = faulty
		if e = w.Process(ctx, *lease); e != nil {
			t.Fatal(e)
		}
		out, e := faulty.Get(ctx, projectOwner(), job.ID)
		if e != nil || out.State != "failed" || out.ErrorCode != "STORAGE_FULL" {
			t.Fatalf("disk full job %s %s %v", out.State, out.ErrorCode, e)
		}
	})
	t.Run("overflow blocked", func(t *testing.T) {
		changed := doc
		changed.TextBlocks = append([]document.TextBlock{}, doc.TextBlocks...)
		changed.TextBlocks[0].Y = 1590
		updated, e := p.Save(ctx, projectOwner(), a.ID, "1", "overflow", changed)
		if e != nil {
			t.Fatal(e)
		}
		job, e := s.Create(ctx, projectOwner(), a.ID, updated.Revision, "overflow")
		if e != nil {
			t.Fatal(e)
		}
		lease, e := s.Claim(ctx, "overflow-worker", time.Now().UTC())
		if e != nil || lease == nil {
			t.Fatal(e)
		}
		if e = worker.Process(ctx, *lease); e != nil {
			t.Fatal(e)
		}
		out, e := s.Get(ctx, projectOwner(), job.ID)
		if e != nil || out.State != "failed" || out.ErrorCode != "OVERFLOW" {
			t.Fatalf("overflow job %s %s %v", out.State, out.ErrorCode, e)
		}
	})
	t.Run("native worker restart", func(t *testing.T) {
		job, e := s.Create(ctx, projectOwner(), a.ID, "1", "native-restart")
		if e != nil {
			t.Fatal(e)
		}
		nativeExportRestart(t, s, job, root)
	})
	t.Run("missing font never succeeds", func(t *testing.T) {
		job, e := s.Create(ctx, projectOwner(), a.ID, "1", "missing-font")
		if e != nil {
			t.Fatal(e)
		}
		var frozen projects.RenderSnapshot
		if e = json.Unmarshal(job.Snapshot, &frozen); e != nil {
			t.Fatal(e)
		}
		if e = p.Store.Delete(ctx, frozen.Fonts[0].Key); e != nil {
			t.Fatal(e)
		}
		lease, e := s.Claim(ctx, "missing-font-worker", time.Now().UTC())
		if e != nil || lease == nil {
			t.Fatal(e)
		}
		if e = worker.Process(ctx, *lease); e != nil {
			t.Fatal(e)
		}
		out, e := s.Get(ctx, projectOwner(), job.ID)
		if e != nil || out.State != "failed" || out.ErrorCode != "MISSING_FONT" {
			t.Fatalf("missing font job %s %s %v", out.State, out.ErrorCode, e)
		}
	})

}
