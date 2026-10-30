package storage_test

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/internal/config"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func gcFixture(t *testing.T) (*sql.DB, storage.FileStore, string) {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled'),('u2','two','two','disabled')"); e != nil {
		t.Fatal(e)
	}
	dir := t.TempDir()
	store, e := storage.NewLocal(dir)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	return db, store, dir
}

func seedProjectRow(t *testing.T, db *sql.DB, id, owner string) {
	t.Helper()
	if _, e := db.Exec("INSERT INTO projects(id,owner_id,title,document,revision,width,height) VALUES(?,?,?,JSON_OBJECT('schemaVersion',1),1,1200,1600)", id, owner, "test"); e != nil {
		t.Fatal(e)
	}
}

type seededAsset struct {
	id                                        string
	original, normalized, preview             storage.Key
	originalSize, normalizedSize, previewSize int64
	originalHash, normalizedHash              string
}

func seedAsset(t *testing.T, db *sql.DB, store storage.FileStore, dir, id, owner string, age time.Duration) seededAsset {
	t.Helper()
	ctx := context.Background()
	out := seededAsset{id: id}
	put := func(prefix, content string) (storage.Key, int64, string) {
		key := storage.NewKey(prefix)
		info, e := store.Put(ctx, key, strings.NewReader(content))
		if e != nil {
			t.Fatal(e)
		}
		if age > 0 {
			old := time.Now().Add(-age)
			if e = os.Chtimes(filepath.Join(dir, filepath.FromSlash(string(key))), old, old); e != nil {
				t.Fatal(e)
			}
		}
		return key, info.Size, info.SHA256
	}
	var originalHash, normalizedHash, previewHash string
	out.original, out.originalSize, originalHash = put("test-assets/original", id+"-original")
	out.normalized, out.normalizedSize, normalizedHash = put("test-assets/normalized", id+"-normalized")
	out.preview, out.previewSize, previewHash = put("test-assets/preview", id+"-preview")
	out.originalHash, out.normalizedHash = originalHash, normalizedHash
	if _, e := db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?, 'image', ?)", id, owner, id); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES(?,1,?,?,?,'image/png',1200,1600,?,?,?,?,?,'{}')", id, string(out.original), string(out.normalized), string(out.preview), out.originalSize, out.normalizedSize, out.previewSize, originalHash, normalizedHash); e != nil {
		t.Fatal(e)
	}
	_ = previewHash
	return out
}

func putFile(t *testing.T, store storage.FileStore, dir, key, content string, age time.Duration) {
	t.Helper()
	if _, e := store.Put(context.Background(), storage.Key(key), strings.NewReader(content)); e != nil {
		t.Fatal(e)
	}
	if age > 0 {
		stamp := time.Now().Add(-age)
		if e := os.Chtimes(filepath.Join(dir, filepath.FromSlash(key)), stamp, stamp); e != nil {
			t.Fatal(e)
		}
	}
}

func fileExists(t *testing.T, store storage.FileStore, key storage.Key) bool {
	t.Helper()
	r, e := store.Open(context.Background(), key)
	if errors.Is(e, os.ErrNotExist) {
		return false
	}
	if e != nil {
		t.Fatal(e)
	}
	r.Close()
	return true
}

func seedJob(t *testing.T, db *sql.DB, id, user, project, state, result, preview string, expires, lease *time.Time) {
	t.Helper()
	nullable := func(value string) any {
		if value == "" {
			return nil
		}
		return value
	}
	var expiresValue, leaseValue any
	if expires != nil {
		expiresValue = *expires
	}
	if lease != nil {
		leaseValue = *lease
	}
	var size int64
	if result != "" {
		size = 10
	}
	if _, e := db.Exec("INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,state,attempts,lease_until,result_key,preview_key,result_size,expires_at) VALUES(?,?,?,1,?,?,?,?,?,1,?,?,?,?,?)", id, user, project, "{}", "poster-renderer-v1", "hash", id, state, leaseValue, nullable(result), nullable(preview), size, expiresValue); e != nil {
		t.Fatal(e)
	}
}

func TestGCDoesNotDeleteActiveOrLeasedFiles(t *testing.T) {
	db, store, dir := gcFixture(t)
	seedProjectRow(t, db, "p1", "u1")
	asset := seedAsset(t, db, store, dir, "a1", "u1", 48*time.Hour)
	putFile(t, store, dir, "staging/images/active", "staged", 48*time.Hour)
	if _, e := db.Exec("INSERT INTO staged_uploads(file_key,user_id,state,expires_at) VALUES('staging/images/active','u1','staged',UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE)"); e != nil {
		t.Fatal(e)
	}
	putFile(t, store, dir, "staging/images/claimed", "claimed", 48*time.Hour)
	if _, e := db.Exec("INSERT INTO staged_uploads(file_key,user_id,state,expires_at) VALUES('staging/images/claimed','u1','claimed',UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE)"); e != nil {
		t.Fatal(e)
	}
	now := time.Now().UTC()
	expires := now.Add(7 * 24 * time.Hour)
	putFile(t, store, dir, "exports/live", "result", 48*time.Hour)
	putFile(t, store, dir, "export-previews/live", "preview", 48*time.Hour)
	seedJob(t, db, "j-live", "u1", "p1", "succeeded", "exports/live", "export-previews/live", &expires, nil)
	lease := now.Add(30 * time.Second)
	putFile(t, store, dir, "exports/leased", "leased-result", 48*time.Hour)
	putFile(t, store, dir, "export-previews/leased", "leased-preview", 48*time.Hour)
	seedJob(t, db, "j-leased", "u1", "p1", "running", "exports/leased", "export-previews/leased", &expires, &lease)
	collector := storage.GC{DB: db, Store: store, Root: dir, Grace: 24 * time.Hour, DryRun: true}
	report, e := collector.Run(context.Background(), now)
	if e != nil {
		t.Fatal(e)
	}
	if report.DeletedFiles != 0 {
		t.Fatalf("dry-run deleted referenced files: %+v", report)
	}
	for _, key := range []storage.Key{asset.original, asset.normalized, asset.preview, "staging/images/active", "staging/images/claimed", "exports/live", "export-previews/live", "exports/leased", "export-previews/leased"} {
		if !fileExists(t, store, key) {
			t.Fatalf("referenced file was removed: %s", key)
		}
	}
	collector.DryRun = false
	report, e = collector.Run(context.Background(), now)
	if e != nil {
		t.Fatal(e)
	}
	if report.DeletedFiles != 0 {
		t.Fatalf("active files were collected: %+v", report)
	}
	for _, key := range []storage.Key{asset.original, asset.normalized, asset.preview, "staging/images/active", "staging/images/claimed", "exports/live", "export-previews/live", "exports/leased", "export-previews/leased"} {
		if !fileExists(t, store, key) {
			t.Fatalf("active file was removed: %s", key)
		}
	}
}

func TestCollectsOrphanAfterGracePeriod(t *testing.T) {
	db, store, dir := gcFixture(t)
	seedProjectRow(t, db, "p1", "u1")
	asset := seedAsset(t, db, store, dir, "a1", "u1", 48*time.Hour)
	putFile(t, store, dir, "exports/orphan-old", "orphan", 48*time.Hour)
	putFile(t, store, dir, "tmp/leftover", "partial", 48*time.Hour)
	putFile(t, store, dir, "staging/images/expired", "expired", 48*time.Hour)
	if _, e := db.Exec("INSERT INTO staged_uploads(file_key,user_id,state,expires_at) VALUES('staging/images/expired','u1','staged',UTC_TIMESTAMP(6)-INTERVAL 30 HOUR)"); e != nil {
		t.Fatal(e)
	}
	putFile(t, store, dir, "staging/images/done", "complete file", 48*time.Hour)
	if _, e := db.Exec("INSERT INTO staged_uploads(file_key,user_id,state,expires_at) VALUES('staging/images/done','u1','complete',UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE)"); e != nil {
		t.Fatal(e)
	}
	putFile(t, store, dir, "exports/recent", "recent", 0)
	now := time.Now().UTC()
	collector := storage.GC{DB: db, Store: store, Root: dir, Grace: 24 * time.Hour, DryRun: true}
	report, e := collector.Run(context.Background(), now)
	if e != nil {
		t.Fatal(e)
	}
	if report.DeletedFiles != 4 || report.ExpiredUploads != 1 {
		t.Fatalf("unexpected dry-run report: %+v", report)
	}
	for _, key := range []string{"exports/orphan-old", "tmp/leftover", "staging/images/expired", "staging/images/done", "exports/recent"} {
		if !fileExists(t, store, storage.Key(key)) {
			t.Fatalf("dry-run removed %s", key)
		}
	}
	var expiredRows int
	if e = db.QueryRow("SELECT COUNT(*) FROM staged_uploads WHERE file_key='staging/images/expired'").Scan(&expiredRows); e != nil || expiredRows != 1 {
		t.Fatalf("dry-run changed staged row: %d %v", expiredRows, e)
	}
	if !fileExists(t, store, asset.normalized) {
		t.Fatal("asset file missing before apply")
	}
	collector.DryRun = false
	report, e = collector.Run(context.Background(), now)
	if e != nil {
		t.Fatal(e)
	}
	if report.DeletedFiles != 4 || report.ExpiredUploads != 1 || report.FreedBytes <= 0 {
		t.Fatalf("unexpected apply report: %+v", report)
	}
	for _, key := range []string{"exports/orphan-old", "tmp/leftover", "staging/images/expired", "staging/images/done"} {
		if fileExists(t, store, storage.Key(key)) {
			t.Fatalf("orphan survived %s", key)
		}
	}
	if !fileExists(t, store, "exports/recent") {
		t.Fatal("recent orphan was deleted inside grace period")
	}
	if !fileExists(t, store, asset.normalized) {
		t.Fatal("referenced asset was deleted")
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM staged_uploads WHERE file_key='staging/images/expired'").Scan(&expiredRows); e != nil || expiredRows != 0 {
		t.Fatalf("expired staged row was not collected: %d %v", expiredRows, e)
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM staged_uploads WHERE file_key='staging/images/done'").Scan(&expiredRows); e != nil || expiredRows != 1 {
		t.Fatalf("terminal staged row changed: %d %v", expiredRows, e)
	}
}

func TestExpiresOnlyExportResultAfterSevenDays(t *testing.T) {
	db, store, dir := gcFixture(t)
	seedProjectRow(t, db, "p1", "u1")
	asset := seedAsset(t, db, store, dir, "a1", "u1", 48*time.Hour)
	putFile(t, store, dir, "exports/expired", "result", 0)
	putFile(t, store, dir, "export-previews/expired", "preview", 0)
	completed := time.Now().UTC().Truncate(time.Microsecond)
	expires := completed.Add(7 * 24 * time.Hour)
	seedJob(t, db, "j-expire", "u1", "p1", "succeeded", "exports/expired", "export-previews/expired", &expires, nil)
	if _, e := db.Exec("INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('export','j-expire','a1',1),('project','p1','a1',1)"); e != nil {
		t.Fatal(e)
	}
	collector := storage.GC{DB: db, Store: store, Root: dir, Grace: 24 * time.Hour}
	report, e := collector.Run(context.Background(), completed.Add(7*24*time.Hour-time.Minute))
	if e != nil {
		t.Fatal(e)
	}
	if report.ExpiredExports != 0 {
		t.Fatalf("result expired early: %+v", report)
	}
	if !fileExists(t, store, "exports/expired") || !fileExists(t, store, "export-previews/expired") {
		t.Fatal("unexpired result was deleted")
	}
	report, e = collector.Run(context.Background(), completed.Add(7*24*time.Hour+time.Second))
	if e != nil {
		t.Fatal(e)
	}
	if report.ExpiredExports != 1 {
		t.Fatalf("seven-day result was not expired: %+v", report)
	}
	if fileExists(t, store, "exports/expired") || fileExists(t, store, "export-previews/expired") {
		t.Fatal("expired result files survived")
	}
	var result, preview sql.NullString
	var size int64
	if e = db.QueryRow("SELECT result_key,preview_key,result_size FROM export_jobs WHERE id='j-expire'").Scan(&result, &preview, &size); e != nil {
		t.Fatal(e)
	}
	if result.Valid || preview.Valid || size != 0 {
		t.Fatal("expired job still advertises deleted files")
	}
	var exportRefs, projectRefs int
	db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='export' AND owner_id='j-expire'").Scan(&exportRefs)
	db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='project' AND owner_id='p1'").Scan(&projectRefs)
	if exportRefs != 0 || projectRefs != 1 {
		t.Fatalf("unexpected asset refs after expiry: export=%d project=%d", exportRefs, projectRefs)
	}
	if !fileExists(t, store, asset.normalized) {
		t.Fatal("project asset was removed with export result")
	}
	if !fileExists(t, store, asset.original) {
		t.Fatal("project original asset was removed")
	}
}

func TestSoftDeletedProjectRestoresWithin30Days(t *testing.T) {
	db, store, dir := gcFixture(t)
	raw, e := os.ReadFile(filepath.Join(repoRoot(t), "tests/fixtures/documents/valid-mixed.json"))
	if e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO projects(id,owner_id,title,document,revision,width,height) VALUES('p-restore','u1','恢复测试',?,1,1200,1600)", raw); e != nil {
		t.Fatal(e)
	}
	asset := seedAsset(t, db, store, dir, "a1", "u1", 48*time.Hour)
	if _, e = db.Exec("INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project','p-restore','a1',1),('project-history','p-restore','a1',1)"); e != nil {
		t.Fatal(e)
	}
	service := projects.NewService(db, store)
	principal := projectsPrincipal()
	if e = service.SoftDelete(context.Background(), principal, "p-restore"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE projects SET deleted_at=UTC_TIMESTAMP(6)-INTERVAL 29 DAY WHERE id='p-restore'"); e != nil {
		t.Fatal(e)
	}
	collector := storage.GC{DB: db, Store: store, Root: dir, Grace: 24 * time.Hour}
	if _, e = collector.Run(context.Background(), time.Now().UTC()); e != nil {
		t.Fatal(e)
	}
	if !fileExists(t, store, asset.normalized) {
		t.Fatal("soft-deleted project assets were collected inside the restore window")
	}
	restored, e := service.Restore(context.Background(), principal, "p-restore")
	if e != nil || restored.Title != "恢复测试" {
		t.Fatalf("restore within 30 days failed: %v", e)
	}
	if e = service.SoftDelete(context.Background(), principal, "p-restore"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE projects SET deleted_at=UTC_TIMESTAMP(6)-INTERVAL 31 DAY WHERE id='p-restore'"); e != nil {
		t.Fatal(e)
	}
	_, e = service.Restore(context.Background(), principal, "p-restore")
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "NOT_FOUND" {
		t.Fatalf("restore outside window should fail: %v", e)
	}
}

func projectsPrincipal() auth.Principal { return auth.Principal{UserID: "u1", Role: "user"} }

func TestRestartUsesSameAbsoluteDataDir(t *testing.T) {
	base := t.TempDir()
	env := map[string]string{"MYSQL_DSN": "user:pass@tcp(127.0.0.1:3306)/fastposter", "APP_DATA_DIR": "var/data"}
	first, e := config.Load(env, base)
	if e != nil {
		t.Fatal(e)
	}
	second, e := config.Load(env, base)
	if e != nil {
		t.Fatal(e)
	}
	if !filepath.IsAbs(first.AbsoluteDataDir) || first.AbsoluteDataDir != second.AbsoluteDataDir {
		t.Fatalf("restart changed data directory: %s vs %s", first.AbsoluteDataDir, second.AbsoluteDataDir)
	}
	store, e := storage.NewLocal(first.AbsoluteDataDir)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = store.Put(context.Background(), "originals/restart", strings.NewReader("durable")); e != nil {
		t.Fatal(e)
	}
	store.Close()
	store, e = storage.NewLocal(second.AbsoluteDataDir)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	r, e := store.Open(context.Background(), "originals/restart")
	if e != nil {
		t.Fatal(e)
	}
	defer r.Close()
	content, _ := io.ReadAll(r)
	if string(content) != "durable" {
		t.Fatal("data written before restart is unreadable after restart")
	}
	absolute := map[string]string{"MYSQL_DSN": env["MYSQL_DSN"], "APP_DATA_DIR": filepath.Join(base, "custom-data")}
	third, e := config.Load(absolute, base)
	if e != nil || third.AbsoluteDataDir != filepath.Join(base, "custom-data") {
		t.Fatalf("absolute APP_DATA_DIR changed: %s %v", third.AbsoluteDataDir, e)
	}
}

func TestMaintenanceGatePausesAndReleases(t *testing.T) {
	dir := t.TempDir()
	if storage.MaintenanceActive(dir) {
		t.Fatal("maintenance unexpectedly active")
	}
	guard, e := storage.BeginMaintenance(dir)
	if e != nil {
		t.Fatal(e)
	}
	if !storage.MaintenanceActive(dir) {
		t.Fatal("maintenance gate did not activate")
	}
	if _, e = storage.BeginMaintenance(dir); e == nil {
		t.Fatal("second maintenance operation acquired the lock")
	}
	if e = guard.Close(); e != nil {
		t.Fatal(e)
	}
	if storage.MaintenanceActive(dir) {
		t.Fatal("maintenance gate survived close")
	}
	if _, e = os.Stat(filepath.Join(dir, storage.MaintenanceGateName)); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("gate file was not removed")
	}
}

func TestVerifyFilesDetectsMissingAssetFile(t *testing.T) {
	db, store, _ := gcFixture(t)
	ctx := context.Background()
	put := func(content string) (storage.Key, int64, string) {
		key := storage.NewKey("test-assets")
		info, e := store.Put(ctx, key, strings.NewReader(content))
		if e != nil {
			t.Fatal(e)
		}
		return key, info.Size, info.SHA256
	}
	original, originalSize, originalHash := put("original")
	normalized, normalizedSize, normalizedHash := put("normalized")
	preview, previewSize, _ := put("preview")
	if _, e := db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES('a-verify','u1','image','verify')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES('a-verify',1,?,?,?, 'image/png',1,1,?,?,?,?,?,'{}')", string(original), string(normalized), string(preview), originalSize, normalizedSize, previewSize, originalHash, normalizedHash); e != nil {
		t.Fatal(e)
	}
	check, e := storage.VerifyFiles(ctx, db, store)
	if e != nil || !check.Healthy() {
		t.Fatalf("healthy files reported bad: %+v %v", check, e)
	}
	if e = store.Delete(ctx, normalized); e != nil {
		t.Fatal(e)
	}
	check, e = storage.VerifyFiles(ctx, db, store)
	if e != nil || len(check.Missing) != 1 || check.Missing[0] != string(normalized) {
		t.Fatalf("missing normalized file not detected: %+v %v", check, e)
	}
	health, e := storage.CheckHealth(ctx, t.TempDir())
	if e != nil || !health.Writable || health.FreeBytes == 0 || health.TotalBytes == 0 {
		t.Fatalf("disk health looks wrong: %+v %v", health, e)
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
