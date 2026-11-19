package integration_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fastposter/server/internal/document"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestExportWorkerConsumesQueuedLegacySnapshot(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual browser rendering")
	}
	p, db, doc := projectService(t)
	ctx := context.Background()
	root := repoRoot(t)
	owner := projectOwner()
	project, e := p.Create(ctx, owner, "legacy export", doc)
	if e != nil {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(filepath.Join(root, "tests/fixtures/exports/queued-solid-snapshot.json"))
	if e != nil {
		t.Fatal(e)
	}
	var snapshot projects.RenderSnapshot
	if e = json.Unmarshal(raw, &snapshot); e != nil {
		t.Fatal(e)
	}
	for _, file := range []struct {
		key       storage.Key
		hash, rel string
	}{
		{snapshot.Background.Key, snapshot.Background.SHA256, "tests/fixtures/images/editor.png"},
		{snapshot.Fonts[0].Key, snapshot.Fonts[0].SHA256, "assets/fonts/NotoSansSC-VF.ttf"},
	} {
		source, e := os.Open(filepath.Join(root, file.rel))
		if e != nil {
			t.Fatal(e)
		}
		info, e := p.Store.Put(ctx, file.key, source)
		source.Close()
		if e != nil || info.SHA256 != file.hash {
			t.Fatalf("legacy fixture reference %q has incorrect content: %v", file.rel, e)
		}
	}
	const jobID = "queued-before-gradient-release"
	sum := sha256.Sum256(raw)
	_, e = db.Exec(`INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key)
		VALUES(?,?,?,1,?,?,?,?)`, jobID, owner.UserID, project.ID, raw, snapshot.RendererVersion, hex.EncodeToString(sum[:]), jobID)
	if e != nil {
		t.Fatal(e)
	}
	s := exports.NewService(db, p.Store, p)
	lease, e := s.Claim(ctx, "gradient-compatible-worker", time.Now().UTC())
	if e != nil || lease == nil || lease.Job.ID != jobID {
		t.Fatalf("expected queued legacy job: %+v, %v", lease, e)
	}
	worker := exports.Worker{Service: s, Renderer: &exports.Renderer{ChromePath: chromePath(), RendererDir: filepath.Join(root, "apps/renderer/dist")}, TempRoot: t.TempDir()}
	if e = worker.Process(ctx, *lease); e != nil {
		t.Fatal(e)
	}
	job, e := s.Get(ctx, owner, jobID)
	if e != nil || job.State != "succeeded" {
		t.Fatalf("legacy snapshot failed: %s %s %v", job.State, job.ErrorCode, e)
	}
	pngFile, e := p.Store.Open(ctx, job.ResultKey)
	if e != nil {
		t.Fatal(e)
	}
	defer pngFile.Close()
	info, e := png.DecodeConfig(pngFile)
	if e != nil || info.Width != 1200 || info.Height != 1600 {
		t.Fatalf("unexpected legacy PNG output %+v: %v", info, e)
	}
}

func TestGradientExportRejectsAnOldRendererBundle(t *testing.T) {
	if os.Getenv("FASTPOSTER_RENDER_TEST") != "1" {
		t.Skip("set FASTPOSTER_RENDER_TEST=1 for actual browser rendering")
	}
	dir := t.TempDir()
	if e := os.WriteFile(filepath.Join(dir, "index.html"), []byte(`<html><body><script src="./legacy.js"></script></body></html>`), 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(dir, "legacy.js"), []byte(`window.renderPoster = async () => ({overflow: false});`), 0600); e != nil {
		t.Fatal(e)
	}
	renderer := exports.Renderer{ChromePath: chromePath(), RendererDir: dir}
	snapshot := exports.RenderSnapshot{Document: document.Document{
		SchemaVersion: 1,
		Canvas:        document.Canvas{Width: 16, Height: 16},
		Background:    document.AssetRef{AssetID: "background", Version: "1"},
	}}
	if _, _, e := renderer.RenderText(context.Background(), snapshot); e != nil {
		t.Fatal("legacy bundle should still render a v1 snapshot", e)
	}
	snapshot.Document.SchemaVersion = 2
	if _, _, e := renderer.RenderText(context.Background(), snapshot); e == nil {
		t.Fatal("legacy bundle accepted a document whose gradients it cannot render")
	}
}
