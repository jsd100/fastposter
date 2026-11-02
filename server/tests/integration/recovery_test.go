package integration_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/app"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"github.com/go-sql-driver/mysql"
	"image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func recoveryPrincipal(id string) auth.Principal { return auth.Principal{UserID: id, Role: "user"} }

func recoveryEnv(overrides map[string]string) []string {
	out := make([]string, 0, len(os.Environ())+len(overrides))
	for _, item := range os.Environ() {
		key, _, _ := strings.Cut(item, "=")
		if _, replaced := overrides[key]; replaced {
			continue
		}
		out = append(out, item)
	}
	for key, value := range overrides {
		out = append(out, key+"="+value)
	}
	return out
}

func buildMaintenance(t *testing.T, root string) string {
	t.Helper()
	binary := filepath.Join(t.TempDir(), "maintenance")
	build := exec.Command("go", "build", "-o", binary, "./server/cmd/maintenance")
	build.Dir = root
	if output, e := build.CombinedOutput(); e != nil {
		t.Fatalf("maintenance build failed: %v %s", e, output)
	}
	return binary
}

func seedRecoveryAsset(t *testing.T, db *sql.DB, store storage.FileStore, id, owner, kind, path, metadata string, width, height int) storage.Key {
	t.Helper()
	raw, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	prefix := "normalized"
	if kind == "font" {
		prefix = "fonts"
	}
	key := storage.NewKey(prefix)
	info, e := store.Put(context.Background(), key, bytes.NewReader(raw))
	if e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,?,?)", id, owner, kind, filepath.Base(path)); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES(?,1,?,?,'',?,?,?,?,?,0,?,?,?)", id, string(key), string(key), "application/octet-stream", width, height, info.Size, info.Size, info.SHA256, info.SHA256, metadata); e != nil {
		t.Fatal(e)
	}
	return key
}

func TestRecoveryRestoresDatabaseFilesAndPrivateAccess(t *testing.T) {
	ctx := context.Background()
	root := repoRoot(t)
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	baseConfig, e := mysql.ParseDSN(os.Getenv("FASTPOSTER_TEST_MYSQL_DSN"))
	if e != nil {
		t.Fatal(e)
	}
	var sourceDB string
	if e = db.QueryRow("SELECT DATABASE()").Scan(&sourceDB); e != nil {
		t.Fatal(e)
	}
	sourceConfig := *baseConfig
	sourceConfig.DBName = sourceDB
	sourceDSN := sourceConfig.FormatDSN()
	user1 := recoveryPrincipal("rec-u1")
	user2 := recoveryPrincipal("rec-u2")
	if _, e = db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('rec-u1','rec one','rec one','disabled'),('rec-u2','rec two','rec two','disabled')"); e != nil {
		t.Fatal(e)
	}
	sourceDir := filepath.Join(t.TempDir(), "data")
	store, e := storage.NewLocal(sourceDir)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	background := seedRecoveryAsset(t, db, store, "rec-bg", "rec-u1", "image", filepath.Join(root, "tests/fixtures/images/editor.png"), "{}", 1200, 1600)
	seedRecoveryAsset(t, db, store, "rec-font", "rec-u1", "font", filepath.Join(root, "assets/fonts/NotoSansSC-VF.ttf"), `{"family":"Noto Sans SC","weight":400,"style":"normal"}`, 0, 0)
	raw, e := os.ReadFile(filepath.Join(root, "tests/fixtures/documents/valid-mixed.json"))
	if e != nil {
		t.Fatal(e)
	}
	raw = bytes.ReplaceAll(raw, []byte("bg-1"), []byte("rec-bg"))
	raw = bytes.ReplaceAll(raw, []byte("font-1"), []byte("rec-font"))
	doc, e := document.Parse(raw)
	if e != nil {
		t.Fatal(e)
	}
	projectService := projects.NewService(db, store)
	created, e := projectService.Create(ctx, user1, "备份恢复作品", doc)
	if e != nil {
		t.Fatal(e)
	}
	exportService := exports.NewService(db, store, projectService)
	job, e := exportService.Create(ctx, user1, created.ID, "1", "recovery-export")
	if e != nil {
		t.Fatal(e)
	}
	completedAt := time.Now().UTC().Add(time.Second)
	lease, e := exportService.Claim(ctx, "recovery-worker", completedAt)
	if e != nil || lease == nil {
		t.Fatal("could not claim recovery export", e)
	}
	resultKey := storage.NewKey("exports")
	result := []byte(fakePNG)
	if _, e = store.Put(ctx, resultKey, bytes.NewReader(result)); e != nil {
		t.Fatal(e)
	}
	previewKey := storage.NewKey("export-previews")
	if _, e = store.Put(ctx, previewKey, bytes.NewReader([]byte("preview"))); e != nil {
		t.Fatal(e)
	}
	if e = exportService.Complete(ctx, *lease, resultKey, previewKey, int64(len(result)), completedAt); e != nil {
		t.Fatal(e)
	}
	backgroundInfo, e := store.Stat(ctx, background)
	if e != nil {
		t.Fatal(e)
	}
	binary := buildMaintenance(t, root)
	backupDir := filepath.Join(t.TempDir(), "backup")
	backup := exec.Command(binary, "backup", "-dest", backupDir,
		"-wait", "30s")
	backup.Dir = root
	backup.Env = recoveryEnv(map[string]string{"MYSQL_DSN": sourceDSN, "APP_DATA_DIR": sourceDir})
	var backupOutput bytes.Buffer
	backup.Stdout = &backupOutput
	backup.Stderr = &backupOutput
	inFlight, e := storage.NewWriterGate(sourceDir).TryAcquire()
	if e != nil {
		t.Fatal(e)
	}
	if e = backup.Start(); e != nil {
		inFlight.Release()
		t.Fatal(e)
	}
	backedUp := make(chan error, 1)
	go func() { backedUp <- backup.Wait() }()
	entered := time.Now().Add(10 * time.Second)
	for !storage.MaintenanceActive(sourceDir) {
		if time.Now().After(entered) {
			inFlight.Release()
			t.Fatal("backup did not enter maintenance mode")
		}
		select {
		case e = <-backedUp:
			inFlight.Release()
			t.Fatalf("backup exited before in-flight writes drained: %v %s", e, backupOutput.String())
		case <-time.After(25 * time.Millisecond):
		}
	}
	select {
	case e = <-backedUp:
		t.Fatalf("backup completed while a write was still in flight: %v %s", e, backupOutput.String())
	case <-time.After(500 * time.Millisecond):
	}
	if e = inFlight.Release(); e != nil {
		t.Fatal(e)
	}
	if e = <-backedUp; e != nil {
		t.Fatalf("backup failed after the in-flight write drained: %v %s", e, backupOutput.String())
	}
	if storage.MaintenanceActive(sourceDir) {
		t.Fatal("backup did not release the maintenance gate")
	}
	manifestRaw, e := os.ReadFile(filepath.Join(backupDir, "manifest.json"))
	if e != nil {
		t.Fatal(e)
	}
	var manifest struct {
		Format        string           `json:"format"`
		Version       int              `json:"version"`
		SchemaVersion int              `json:"schemaVersion"`
		DataFiles     int              `json:"dataFiles"`
		Counts        map[string]int64 `json:"counts"`
	}
	if e = json.Unmarshal(manifestRaw, &manifest); e != nil {
		t.Fatal(e)
	}
	if manifest.Format != "fastposter-backup" || manifest.Version != 1 || manifest.SchemaVersion != 1 || manifest.DataFiles < 3 {
		t.Fatalf("unexpected backup manifest: %+v", manifest)
	}
	if manifest.Counts["projects"] != 1 || manifest.Counts["export_jobs"] != 1 {
		t.Fatalf("backup counts do not match source: %+v", manifest.Counts)
	}
	adminConfig := *baseConfig
	adminConfig.DBName = ""
	admin, e := app.OpenMySQL(ctx, adminConfig.FormatDSN())
	if e != nil {
		t.Fatal(e)
	}
	defer admin.Close()
	targetDB := "fastposter_test_restore_" + domain.ID()
	sentinelDB := "fastposter_test_sentinel_" + domain.ID()
	for _, name := range []string{targetDB, sentinelDB} {
		if _, e = admin.ExecContext(ctx, "CREATE DATABASE `"+name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); e != nil {
			t.Fatal(e)
		}
		defer admin.Exec("DROP DATABASE `" + name + "`")
	}
	if _, e = admin.ExecContext(ctx, "CREATE TABLE `"+sentinelDB+"`.projects(id VARCHAR(64) PRIMARY KEY)"); e != nil {
		t.Fatal(e)
	}
	if _, e = admin.ExecContext(ctx, "INSERT INTO `"+sentinelDB+"`.projects(id) VALUES('sentinel')"); e != nil {
		t.Fatal(e)
	}
	targetConfig := *baseConfig
	targetConfig.DBName = targetDB
	targetDSN := targetConfig.FormatDSN()
	targetDir := filepath.Join(t.TempDir(), "restored")
	restore := exec.Command(binary, "restore", "-source", backupDir, "-dsn", targetDSN, "-data-dir", targetDir)
	restore.Dir = root
	restore.Env = recoveryEnv(map[string]string{"MYSQL_DSN": sourceDSN, "APP_DATA_DIR": sourceDir})
	if output, e := restore.CombinedOutput(); e != nil {
		t.Fatalf("restore failed: %v %s", e, output)
	}
	var sentinel int
	if e = admin.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+sentinelDB+"`.projects WHERE id='sentinel'").Scan(&sentinel); e != nil || sentinel != 1 {
		t.Fatalf("restore touched another database: %d %v", sentinel, e)
	}
	targetDBHandle, e := app.OpenMySQL(ctx, targetDSN)
	if e != nil {
		t.Fatal(e)
	}
	defer targetDBHandle.Close()
	targetStore, e := storage.NewLocal(targetDir)
	if e != nil {
		t.Fatal(e)
	}
	defer targetStore.Close()
	restoredProjects := projects.NewService(targetDBHandle, targetStore)
	restoredProject, e := restoredProjects.Get(ctx, user1, created.ID)
	if e != nil {
		t.Fatal(e)
	}
	if restoredProject.Title != created.Title || restoredProject.Revision != created.Revision || !reflect.DeepEqual(restoredProject.Document, created.Document) {
		t.Fatal("restored project differs from source")
	}
	restoredBackground, e := targetStore.Stat(ctx, background)
	if e != nil || restoredBackground.SHA256 != backgroundInfo.SHA256 || restoredBackground.Size != backgroundInfo.Size {
		t.Fatalf("restored background hash mismatch: %+v %v", restoredBackground, e)
	}
	var restoredHash string
	if e = targetDBHandle.QueryRow("SELECT normalized_sha256 FROM asset_versions WHERE asset_id='rec-bg' AND version=1").Scan(&restoredHash); e != nil || restoredHash != backgroundInfo.SHA256 {
		t.Fatalf("restored asset metadata mismatch: %s %v", restoredHash, e)
	}
	if _, e = restoredProjects.Get(ctx, user2, created.ID); e == nil {
		t.Fatal("another user could read the restored private project")
	}
	restoredExports := exports.NewService(targetDBHandle, targetStore, restoredProjects)
	if _, e = restoredExports.Get(ctx, user2, job.ID); e == nil {
		t.Fatal("another user could read the restored export")
	}
	restoredJob, e := restoredExports.Get(ctx, user1, job.ID)
	if e != nil || restoredJob.State != "succeeded" || restoredJob.ResultSize != int64(len(result)) {
		t.Fatalf("restored export metadata is wrong: %+v %v", restoredJob, e)
	}
	file, e := targetStore.Open(ctx, restoredJob.ResultKey)
	if e != nil {
		t.Fatal(e)
	}
	content, _ := io.ReadAll(file)
	file.Close()
	if string(content) != fakePNG {
		t.Fatal("restored export content changed")
	}
	assetService := assets.NewService(targetDBHandle, targetStore, nil, t.TempDir())
	if _, e = assetService.AuthorizeRead(ctx, user2, "rec-bg", "1"); e == nil {
		t.Fatal("another user could read the restored private asset")
	}
	if key, e := assetService.AuthorizeRead(ctx, user1, "rec-bg", "1"); e != nil || key != background {
		t.Fatalf("owner cannot read restored asset: %s %v", key, e)
	}
	again, e := restoredExports.Create(ctx, user1, created.ID, "1", "after-restore")
	if e != nil {
		t.Fatal("re-export after restore failed", e)
	}
	secondLease, e := restoredExports.Claim(ctx, "restored-worker", time.Now().UTC())
	if e != nil || secondLease == nil || secondLease.Job.ID != again.ID {
		t.Fatal("restored export could not be claimed", e)
	}
	if os.Getenv("FASTPOSTER_RENDER_TEST") == "1" {
		renderer := &exports.Renderer{ChromePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", RendererDir: filepath.Join(root, "apps/renderer/dist")}
		worker := exports.Worker{Service: restoredExports, Renderer: renderer, TempRoot: t.TempDir()}
		if e = worker.Process(ctx, *secondLease); e != nil {
			t.Fatal(e)
		}
		rendered, e := restoredExports.Get(ctx, user1, again.ID)
		if e != nil || rendered.State != "succeeded" {
			t.Fatalf("re-export did not render: %+v %v", rendered, e)
		}
		imageFile, e := targetStore.Open(ctx, rendered.ResultKey)
		if e != nil {
			t.Fatal(e)
		}
		image, e := png.Decode(imageFile)
		imageFile.Close()
		if e != nil || image.Bounds().Dx() != 1200 || image.Bounds().Dy() != 1600 {
			t.Fatalf("re-export lost native dimensions: %v", e)
		}
	} else if e = restoredExports.Fail(ctx, *secondLease, "TEST_SKIPPED", "render disabled in this run", time.Now().UTC()); e != nil {
		t.Fatal(e)
	}
	check := exec.Command(binary, "check", "-min-free-mib", "0")
	check.Dir = root
	check.Env = recoveryEnv(map[string]string{"MYSQL_DSN": targetDSN, "APP_DATA_DIR": targetDir})
	if output, e := check.CombinedOutput(); e != nil {
		t.Fatalf("restored instance health check failed: %v %s", e, output)
	}
	var otherDBProjects int
	if e = admin.QueryRowContext(ctx, "SELECT COUNT(*) FROM `"+sentinelDB+"`.projects").Scan(&otherDBProjects); e != nil || otherDBProjects != 1 {
		t.Fatalf("restore changed another database: %d %v", otherDBProjects, e)
	}

	// A second -force restore targets a non-empty database and a non-empty data
	// directory. Both must be replaced only after the staged copy is verified.
	if _, e = targetDBHandle.ExecContext(ctx, "UPDATE projects SET title='tampered' WHERE id=?", created.ID); e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(filepath.Join(targetDir, "stale.bin"), []byte("stale"), 0600); e != nil {
		t.Fatal(e)
	}
	targetStore.Close()
	forced := exec.Command(binary, "restore", "-source", backupDir, "-dsn", targetDSN, "-data-dir", targetDir, "-force")
	forced.Dir = root
	forced.Env = recoveryEnv(map[string]string{"MYSQL_DSN": sourceDSN, "APP_DATA_DIR": sourceDir})
	if output, e := forced.CombinedOutput(); e != nil {
		t.Fatalf("forced restore over an existing target failed: %v %s", e, output)
	}
	if _, e = os.Stat(filepath.Join(targetDir, "stale.bin")); !errors.Is(e, os.ErrNotExist) {
		t.Fatalf("forced restore kept stale target files: %v", e)
	}
	var forcedTitle string
	if e = targetDBHandle.QueryRowContext(ctx, "SELECT title FROM projects WHERE id=?", created.ID).Scan(&forcedTitle); e != nil || forcedTitle != created.Title {
		t.Fatalf("forced restore did not replace the database: %q %v", forcedTitle, e)
	}
	restoredAgain, e := storage.NewLocal(targetDir)
	if e != nil {
		t.Fatal(e)
	}
	if info, e := restoredAgain.Stat(ctx, background); e != nil || info.SHA256 != backgroundInfo.SHA256 {
		t.Fatalf("forced restore lost asset files: %+v %v", info, e)
	}
	restoredAgain.Close()
}

const fakePNG = "\x89PNG\r\n\x1a\nrecovery-result"
