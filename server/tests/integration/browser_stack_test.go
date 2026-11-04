package integration_test

import (
	"context"
	"fastposter/server/gen/kitex/core"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/copy"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/templates"
	"fastposter/server/internal/testutil"
	"fastposter/server/internal/transport"
	"github.com/cloudwego/hertz/pkg/app"
	hserver "github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/kitex/client"
	kserver "github.com/cloudwego/kitex/server"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// Browser acceptance uses actual domain services and transports in a disposable
// MySQL schema and data directory, never the developer's fastposter database.
func TestBrowserStack(t *testing.T) {
	if os.Getenv("FASTPOSTER_E2E_STACK") != "1" {
		t.Skip("browser-stack harness only")
	}
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	dataDir := t.TempDir()
	store, e := storage.NewLocal(dataDir)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	root := repoRoot(t)
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.CreateAdmin(context.Background(), "admin-e2e", "fastposter-test-only-password"); e != nil {
		t.Fatal(e)
	}
	images := assets.NewService(db, store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	if e = images.BootstrapFonts(context.Background(), root); e != nil {
		t.Fatal(e)
	}
	posters := projects.NewService(db, store)
	library := catalog.NewService(db, store, images)
	copies := copy.NewService(db, library)
	portable := templates.NewService(db, store, posters, images, library, t.TempDir())
	rl, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	coreServer := coreservice.NewServer(&transport.CoreHandler{AuthFunc: transport.AuthAdapter(accounts), AssetsFunc: transport.AssetsAdapter(accounts, images), CatalogFunc: transport.CatalogAdapter(accounts, library, copies), AdminFunc: transport.AdminAdapter(accounts, library, projectdeletions.NewService(db, store)), ProjectsFunc: transport.ProjectsAdapter(accounts, posters, projectdeletions.NewService(db, store)), TemplatesFunc: transport.TemplatesAdapter(accounts, portable), ExportsFunc: transport.ExportsAdapter(accounts, exports.NewService(db, store, projects.NewService(db, store))), Health: db.PingContext}, kserver.WithListener(rl))
	go coreServer.Run()
	defer coreServer.Stop()
	rpc, e := coreservice.NewClient("browser.core", client.WithHostPorts(rl.Addr().String()), client.WithRPCTimeout(75*time.Second))
	if e != nil {
		t.Fatal(e)
	}
	hl, e := net.Listen("tcp", "127.0.0.1:18080")
	if e != nil {
		t.Fatal(e)
	}
	h := hserver.New(hserver.WithListener(hl), hserver.WithStreamBody(true), hserver.WithMaxRequestBodySize(82<<20))
	g := transport.Gateway{RPC: rpc, Store: store, AllowedOrigins: []string{"http://127.0.0.1:15173", "http://127.0.0.1:15174"}}
	g.BindUploads()
	g.Register(h)
	h.GET("/api/v1/health", func(ctx context.Context, r *app.RequestContext) {
		probe := http.Client{Timeout: 250 * time.Millisecond}
		response, err := probe.Get("http://127.0.0.1:15174/admin/")
		if err != nil {
			r.Status(503)
			return
		}
		response.Body.Close()
		if response.StatusCode != 200 {
			r.Status(503)
			return
		}
		_, e := rpc.Ping(ctx, &core.PingRequest{RequestId: "browser-health"})
		if e != nil {
			r.Status(503)
			return
		}
		r.JSON(200, map[string]string{"status": "ok"})
	})
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	worker := exports.Worker{Service: exports.NewService(db, store, projects.NewService(db, store)), Renderer: &exports.Renderer{ChromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", RendererDir: filepath.Join(root, "apps/renderer/dist")}, TempRoot: t.TempDir(), ID: "browser-worker"}
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); worker.Run(workerCtx) }()
	defer func() { workerCancel(); <-workerDone }()
	cleanupCtx, cleanupCancel := context.WithCancel(context.Background())
	defer cleanupCancel()
	cleanupWorker := projectdeletions.Worker{Service: projectdeletions.NewService(db, store), Writers: storage.NewWriterGate(dataDir), Paused: func() bool { return storage.MaintenanceActive(dataDir) }, ID: "browser-cleanup"}
	cleanupDone := make(chan struct{})
	go func() { defer close(cleanupDone); cleanupWorker.Run(cleanupCtx) }()
	defer func() { cleanupCancel(); <-cleanupDone }()
	go h.Run()
	defer h.Close()
	cmd := exec.Command("pnpm", "exec", "vite", "apps/web", "--host", "127.0.0.1", "--port", "15173", "--strictPort", "--config", "apps/web/vite.config.ts")
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "API_PROXY=http://127.0.0.1:18080")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if e = cmd.Start(); e != nil {
		t.Fatal(e)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	defer func() {
		syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
	}()
	adminCmd := exec.Command("pnpm", "exec", "vite", "apps/admin", "--host", "127.0.0.1", "--port", "15174", "--strictPort", "--config", "apps/admin/vite.config.ts")
	adminCmd.Dir = root
	adminCmd.Env = append(os.Environ(), "API_PROXY=http://127.0.0.1:18080")
	adminCmd.Stdout = os.Stdout
	adminCmd.Stderr = os.Stderr
	adminCmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if e = adminCmd.Start(); e != nil {
		t.Fatal(e)
	}
	adminDone := make(chan error, 1)
	go func() { adminDone <- adminCmd.Wait() }()
	defer func() {
		syscall.Kill(-adminCmd.Process.Pid, syscall.SIGTERM)
		select {
		case <-adminDone:
		case <-time.After(3 * time.Second):
			syscall.Kill(-adminCmd.Process.Pid, syscall.SIGKILL)
		}
	}()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	select {
	case <-ctx.Done():
	case e := <-done:
		t.Fatalf("frontend server stopped: %v", e)
	}
}
