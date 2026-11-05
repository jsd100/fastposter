package projectdeletions

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"io/fs"
	"strings"
	"sync"
	"testing"
	"time"
)

type cleanupFixture struct {
	service *Service
	worker  *Worker
	db      *sql.DB
	store   storage.FileStore
	dir     string
}

func newCleanupFixture(t *testing.T) *cleanupFixture {
	t.Helper()
	return newCleanupFixtureWith(t, nil)
}

func newCleanupFixtureWith(t *testing.T, wrap func(storage.FileStore) storage.FileStore) *cleanupFixture {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('u1','one','one','disabled')"); e != nil {
		t.Fatal(e)
	}
	dir := t.TempDir()
	local, e := storage.NewLocal(dir)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { local.Close() })
	var store storage.FileStore = local
	if wrap != nil {
		store = wrap(local)
	}
	service := NewService(db, store)
	return &cleanupFixture{
		service: service,
		db:      db,
		store:   store,
		dir:     dir,
		worker:  &Worker{Service: service, Writers: storage.NewWriterGate(dir), Paused: func() bool { return storage.MaintenanceActive(dir) }, ID: "cleanup-1"},
	}
}

func (f *cleanupFixture) exec(t *testing.T, query string, args ...any) {
	t.Helper()
	if _, e := f.db.Exec(query, args...); e != nil {
		t.Fatalf("%s: %v", query, e)
	}
}

func (f *cleanupFixture) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if e := f.db.QueryRow(query, args...).Scan(&n); e != nil {
		t.Fatal(e)
	}
	return n
}

func (f *cleanupFixture) put(t *testing.T, prefix string) storage.Key {
	t.Helper()
	key := storage.NewKey(prefix)
	if _, e := f.store.Put(context.Background(), key, strings.NewReader(prefix)); e != nil {
		t.Fatal(e)
	}
	return key
}

type seededDeletion struct {
	TaskID  string
	Private []storage.Key
	Shared  storage.Key
	Asset   string
}

func (f *cleanupFixture) seed(t *testing.T, projectID, assetID string, shareNormalized bool) seededDeletion {
	t.Helper()
	original := f.put(t, "originals")
	normalized := f.put(t, "normalized")
	preview := f.put(t, "previews")
	result := f.put(t, "exports")
	exportPreview := f.put(t, "export-previews")
	f.exec(t, "INSERT INTO projects(id,owner_id,title,document,revision,width,height,deleted_at) VALUES(?, 'u1', ?, '{\"schemaVersion\":1}', 1, 1200, 1600, UTC_TIMESTAMP(6))", projectID, projectID)
	f.exec(t, "INSERT INTO project_revisions(project_id,revision,document) VALUES(?,1,'{\"schemaVersion\":1}')", projectID)
	f.exec(t, "INSERT INTO assets(id,owner_id,kind,name) VALUES(?,'u1','image',?)", assetID, assetID)
	f.exec(t, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256) VALUES(?,1,?,?,?,'image/png',1200,1600,1,1,1,?,?)", assetID, string(original), string(normalized), string(preview), strings.Repeat("0", 64), strings.Repeat("0", 64))
	f.exec(t, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project',?,?,1),('project-history',?,?,1)", projectID, assetID, projectID, assetID)
	jobID := "j-" + projectID
	f.exec(t, "INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,state,result_key,preview_key,result_size) VALUES(?,'u1',?,1,'{}','v1','hash',?,'succeeded',?,?,10)", jobID, projectID, jobID, string(result), string(exportPreview))
	f.exec(t, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('export',?,?,1)", jobID, assetID)
	if shareNormalized {
		sharedOriginal := f.put(t, "originals")
		sharedPreview := f.put(t, "previews")
		f.exec(t, "INSERT INTO assets(id,owner_id,kind,name) VALUES(?,'u1','image',?)", assetID+"-shared", assetID+"-shared")
		f.exec(t, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256) VALUES(?,1,?,?,?,'image/png',1200,1600,1,1,1,?,?)", assetID+"-shared", string(sharedOriginal), string(normalized), string(sharedPreview), strings.Repeat("0", 64), strings.Repeat("0", 64))
	}
	task, e := f.service.Accept(context.Background(), auth.Principal{UserID: "u1", Role: "user"}, OwnerScope, projectID)
	if e != nil {
		t.Fatal(e)
	}
	return seededDeletion{TaskID: task.ID, Private: []storage.Key{original, preview, result, exportPreview}, Shared: normalized, Asset: assetID}
}

func (f *cleanupFixture) taskState(t *testing.T, taskID string) (string, string, int, int) {
	t.Helper()
	var state, code string
	var attempts, pending int
	if e := f.db.QueryRow("SELECT state,COALESCE(safe_error_code,''),attempts FROM project_deletions WHERE id=?", taskID).Scan(&state, &code, &attempts); e != nil {
		t.Fatal(e)
	}
	pending = f.count(t, "SELECT COUNT(*) FROM project_deletion_files WHERE task_id=? AND state='pending'", taskID)
	return state, code, attempts, pending
}

func (f *cleanupFixture) mustExist(t *testing.T, key storage.Key) {
	t.Helper()
	reader, e := f.store.Open(context.Background(), key)
	if e != nil {
		t.Fatalf("expected %s to exist: %v", key, e)
	}
	reader.Close()
}

func (f *cleanupFixture) mustGone(t *testing.T, key storage.Key) {
	t.Helper()
	reader, e := f.store.Open(context.Background(), key)
	if e == nil {
		reader.Close()
		t.Fatalf("private file remains: %s", key)
	}
	if !errors.Is(e, fs.ErrNotExist) {
		t.Fatalf("private file remains: %v", e)
	}
}

func TestCleanupDeletesOnlyUnreferencedFiles(t *testing.T) {
	f := newCleanupFixture(t)
	seed := f.seed(t, "p1", "a1", true)
	ran, e := f.worker.RunOnce(context.Background(), time.Now().UTC())
	if e != nil || !ran {
		t.Fatal("cleanup did not run", ran, e)
	}
	state, code, _, pending := f.taskState(t, seed.TaskID)
	if state != "completed" || code != "" || pending != 0 {
		t.Fatalf("task state=%s code=%s pending=%d", state, code, pending)
	}
	for _, key := range seed.Private {
		f.mustGone(t, key)
	}
	f.mustExist(t, seed.Shared)
	if n := f.count(t, "SELECT COUNT(*) FROM asset_versions WHERE asset_id=?", seed.Asset); n != 0 {
		t.Fatal("retired asset version remains", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM assets WHERE id=?", seed.Asset); n != 0 {
		t.Fatal("retired asset row remains", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM asset_versions WHERE asset_id=?", seed.Asset+"-shared"); n != 1 {
		t.Fatal("shared asset version was removed", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletion_files WHERE task_id=?", seed.TaskID); n != 0 {
		t.Fatal("file worklist remained", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletion_assets WHERE task_id=?", seed.TaskID); n != 0 {
		t.Fatal("candidate worklist remained", n)
	}
	var title sql.NullString
	var width, height sql.NullInt64
	if e = f.db.QueryRow("SELECT title,width,height FROM project_deletions WHERE id=?", seed.TaskID).Scan(&title, &width, &height); e != nil {
		t.Fatal(e)
	}
	if title.Valid || width.Valid || height.Valid {
		t.Fatal("completed task kept its display snapshot")
	}
}

type flakyStore struct {
	storage.FileStore
	FailOn storage.Key
	failed bool
}

func (s *flakyStore) Delete(ctx context.Context, key storage.Key) error {
	e := s.FileStore.Delete(ctx, key)
	if !s.failed && key == s.FailOn && e == nil {
		s.failed = true
		return errors.New("simulated confirmation failure after delete")
	}
	return e
}

func TestCleanupRetryAfterDeleteBeforeAck(t *testing.T) {
	flaky := &flakyStore{}
	f := newCleanupFixtureWith(t, func(store storage.FileStore) storage.FileStore {
		flaky.FileStore = store
		return flaky
	})
	seed := f.seed(t, "p1", "a1", false)
	flaky.FailOn = seed.Private[0]
	start := time.Now().UTC()
	ran, e := f.worker.RunOnce(context.Background(), start)
	if e != nil || !ran {
		t.Fatal("cleanup did not run", ran, e)
	}
	state, code, attempts, _ := f.taskState(t, seed.TaskID)
	if state != "retry_wait" || code == "" || attempts != 1 {
		t.Fatalf("failed task state=%s code=%s attempts=%d", state, code, attempts)
	}
	var next time.Time
	if e = f.db.QueryRow("SELECT next_attempt_at FROM project_deletions WHERE id=?", seed.TaskID).Scan(&next); e != nil {
		t.Fatal(e)
	}
	if next.Before(start.Add(4 * time.Second)) {
		t.Fatalf("retry was not delayed: %s", next)
	}
	f.mustGone(t, seed.Private[0])
	f.exec(t, "UPDATE project_deletions SET next_attempt_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?", seed.TaskID)
	ran, e = f.worker.RunOnce(context.Background(), time.Now().UTC())
	if e != nil || !ran {
		t.Fatal("second cleanup did not run", ran, e)
	}
	state, code, _, pending := f.taskState(t, seed.TaskID)
	if state != "completed" || code != "" || pending != 0 {
		t.Fatalf("retry did not converge: state=%s code=%s pending=%d", state, code, pending)
	}
	for _, key := range seed.Private {
		f.mustGone(t, key)
	}
}

func TestCleanupAfterGCRetiredMetadata(t *testing.T) {
	f := newCleanupFixture(t)
	seed := f.seed(t, "p1", "a1", false)
	f.exec(t, "DELETE FROM asset_refs WHERE asset_id=?", seed.Asset)
	f.exec(t, "DELETE FROM asset_versions WHERE asset_id=?", seed.Asset)
	f.exec(t, "DELETE FROM assets WHERE id=?", seed.Asset)
	ran, e := f.worker.RunOnce(context.Background(), time.Now().UTC())
	if e != nil || !ran {
		t.Fatal("cleanup did not run", ran, e)
	}
	state, _, _, pending := f.taskState(t, seed.TaskID)
	if state != "completed" || pending != 0 {
		t.Fatalf("task did not converge: state=%s pending=%d", state, pending)
	}
	for _, key := range seed.Private {
		f.mustGone(t, key)
	}
}

func TestCleanupExpiredLeaseAndTwoWorkers(t *testing.T) {
	f := newCleanupFixture(t)
	first := f.seed(t, "p1", "a1", false)
	f.exec(t, "UPDATE project_deletions SET state='running',lease_token='old-worker',lease_until=UTC_TIMESTAMP(6)-INTERVAL 1 MINUTE,attempts=1 WHERE id=?", first.TaskID)
	secondWorker := &Worker{Service: f.service, Writers: storage.NewWriterGate(f.dir), Paused: f.worker.Paused, ID: "cleanup-2"}
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for _, worker := range []*Worker{f.worker, secondWorker} {
		wg.Add(1)
		go func(w *Worker) {
			defer wg.Done()
			_, e := w.RunOnce(context.Background(), time.Now().UTC())
			results <- e
		}(worker)
	}
	wg.Wait()
	close(results)
	for e := range results {
		if e != nil {
			t.Fatal("concurrent cleanup failed", e)
		}
	}
	state, _, attempts, pending := f.taskState(t, first.TaskID)
	if state != "completed" || pending != 0 || attempts < 2 {
		t.Fatalf("expired lease was not recovered: state=%s attempts=%d pending=%d", state, attempts, pending)
	}
	for _, key := range first.Private {
		f.mustGone(t, key)
	}

	stale := f.seed(t, "p2", "a2", false)
	f.exec(t, "UPDATE project_deletions SET state='running',lease_token='new-worker',lease_until=UTC_TIMESTAMP(6)+INTERVAL 1 MINUTE,attempts=1 WHERE id=?", stale.TaskID)
	if e := f.worker.finish(context.Background(), stale.TaskID, "old-worker", time.Now().UTC()); !errors.Is(e, errLeaseLost) {
		t.Fatalf("stale worker confirmed completion: %v", e)
	}
	state, _, _, _ = f.taskState(t, stale.TaskID)
	if state != "running" {
		t.Fatalf("stale completion changed the task: %s", state)
	}
	if e := f.worker.fail(context.Background(), stale.TaskID, "old-worker", errors.New("boom"), time.Now().UTC()); !errors.Is(e, errLeaseLost) {
		t.Fatalf("stale worker recorded a failure: %v", e)
	}
	f.mustExist(t, stale.Private[0])
}

func TestCleanupMaintenancePause(t *testing.T) {
	f := newCleanupFixture(t)
	seed := f.seed(t, "p1", "a1", false)
	maintenance, e := storage.BeginMaintenance(f.dir)
	if e != nil {
		t.Fatal(e)
	}
	defer maintenance.Close()
	if e = maintenance.PauseWriters(context.Background(), time.Second); e != nil {
		t.Fatal(e)
	}
	ran, e := f.worker.RunOnce(context.Background(), time.Now().UTC())
	if e != nil || ran {
		t.Fatal("cleanup ran during maintenance", ran, e)
	}
	state, _, _, pending := f.taskState(t, seed.TaskID)
	if state != "pending" || pending == 0 {
		t.Fatalf("maintenance mutated the task: state=%s pending=%d", state, pending)
	}
	f.mustExist(t, seed.Private[0])
	if e = maintenance.Close(); e != nil {
		t.Fatal(e)
	}
	ran, e = f.worker.RunOnce(context.Background(), time.Now().UTC())
	if e != nil || !ran {
		t.Fatal("cleanup did not resume after maintenance", ran, e)
	}
	state, _, _, pending = f.taskState(t, seed.TaskID)
	if state != "completed" || pending != 0 {
		t.Fatalf("cleanup did not finish after maintenance: state=%s pending=%d", state, pending)
	}
	for _, key := range seed.Private {
		f.mustGone(t, key)
	}
}
