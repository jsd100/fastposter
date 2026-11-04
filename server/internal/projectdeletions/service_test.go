package projectdeletions_test

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"strings"
	"testing"
	"time"
)

var (
	deletionOwner = auth.Principal{UserID: "u1", Role: "user"}
	deletionAdmin = auth.Principal{UserID: "u2", Role: "admin"}
)

type deletionFixture struct {
	Service  *projectdeletions.Service
	DB       *sql.DB
	Store    storage.FileStore
	Projects *projects.Service
}

func newDeletionFixture(t *testing.T) deletionFixture {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('u1','one','one','disabled'),('u2','two','two','disabled'),('u3','three','three','disabled')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("UPDATE users SET must_change_password=1 WHERE id='u3'"); e != nil {
		t.Fatal(e)
	}
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	return deletionFixture{Service: projectdeletions.NewService(db, store), DB: db, Store: store, Projects: projects.NewService(db, store)}
}

func (f deletionFixture) exec(t *testing.T, query string, args ...any) {
	t.Helper()
	if _, e := f.DB.Exec(query, args...); e != nil {
		t.Fatalf("%s: %v", query, e)
	}
}

func (f deletionFixture) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if e := f.DB.QueryRow(query, args...).Scan(&n); e != nil {
		t.Fatal(e)
	}
	return n
}

type deletionAsset struct {
	ID                            string
	Original, Normalized, Preview storage.Key
}

func (f deletionFixture) asset(t *testing.T, id, owner string) deletionAsset {
	t.Helper()
	put := func(prefix string) storage.Key {
		key := storage.NewKey(prefix)
		if _, e := f.Store.Put(context.Background(), key, strings.NewReader(id+":"+prefix)); e != nil {
			t.Fatal(e)
		}
		return key
	}
	out := deletionAsset{ID: id, Original: put("originals"), Normalized: put("normalized"), Preview: put("previews")}
	f.exec(t, "INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,'image',?)", id, owner, id)
	f.exec(t, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256) VALUES(?,1,?,?,?,'image/png',1200,1600,1,1,1,?,?)", id, string(out.Original), string(out.Normalized), string(out.Preview), strings.Repeat("0", 64), strings.Repeat("0", 64))
	return out
}

func (f deletionFixture) addAssetVersion(t *testing.T, id string, version int) deletionAsset {
	t.Helper()
	put := func(prefix string) storage.Key {
		key := storage.NewKey(prefix)
		if _, e := f.Store.Put(context.Background(), key, strings.NewReader(id+":"+prefix)); e != nil {
			t.Fatal(e)
		}
		return key
	}
	out := deletionAsset{ID: id, Original: put("originals"), Normalized: put("normalized"), Preview: put("previews")}
	f.exec(t, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256) VALUES(?,?,?,?,?,'image/png',1200,1600,1,1,1,?,?)", id, version, string(out.Original), string(out.Normalized), string(out.Preview), strings.Repeat("0", 64), strings.Repeat("0", 64))
	return out
}

func (f deletionFixture) project(t *testing.T, id, owner, title string, trashed bool, document string) {
	t.Helper()
	deleted := "NULL"
	if trashed {
		deleted = "UTC_TIMESTAMP(6)"
	}
	f.exec(t, "INSERT INTO projects(id,owner_id,title,document,revision,width,height,deleted_at) VALUES(?,?,?,?,1,1200,1600,"+deleted+")", id, owner, title, document)
	f.exec(t, "INSERT INTO project_revisions(project_id,revision,document) VALUES(?,1,?)", id, document)
}

func (f deletionFixture) ref(t *testing.T, kind, owner, asset string, version int) {
	t.Helper()
	f.exec(t, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES(?,?,?,?)", kind, owner, asset, version)
}

func (f deletionFixture) exportJob(t *testing.T, id, user, project, state string, result, preview storage.Key, lease *time.Time) {
	t.Helper()
	var resultValue, previewValue, leaseValue any
	if result != "" {
		resultValue = string(result)
		if _, e := f.Store.Put(context.Background(), result, strings.NewReader(id)); e != nil {
			t.Fatal(e)
		}
	}
	if preview != "" {
		previewValue = string(preview)
		if _, e := f.Store.Put(context.Background(), preview, strings.NewReader(id)); e != nil {
			t.Fatal(e)
		}
	}
	if lease != nil {
		leaseValue = *lease
	}
	f.exec(t, "INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,state,lease_until,result_key,preview_key,result_size) VALUES(?,?,?,1,'{}','v1','hash',?,?,?,?,?,10)", id, user, project, id, state, leaseValue, resultValue, previewValue)
}

func (f deletionFixture) resource(t *testing.T, id, asset string, version int) {
	t.Helper()
	f.exec(t, "INSERT INTO resources(id,kind,title,published,created_by) VALUES(?,'background',?,1,'u2')", id, id)
	f.exec(t, "INSERT INTO resource_versions(resource_id,version,asset_id,asset_version) VALUES(?,1,?,?)", id, asset, version)
	f.exec(t, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('resource',?,?,?),('resource-version',?,?,?)", id, asset, version, id+":1", asset, version)
}

func wantDeletionCode(t *testing.T, err error, code string) {
	t.Helper()
	var known *domain.Error
	if !errors.As(err, &known) || known.Code != code {
		t.Fatalf("error = %v, want %s", err, code)
	}
}

func (f deletionFixture) fileExists(t *testing.T, key storage.Key) bool {
	t.Helper()
	reader, e := f.Store.Open(context.Background(), key)
	if e != nil {
		return false
	}
	reader.Close()
	return true
}

func TestAcceptDeletesHistoryExportsAndCapturesKeys(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	f.project(t, "p1", "u1", "待删除作品", true, `{"schemaVersion":1}`)
	current := f.asset(t, "a-current", "u1")
	history := f.asset(t, "a-history", "u1")
	exported := f.asset(t, "a-export", "u1")
	multiVersion1 := f.asset(t, "a-multi", "u1")
	multiVersion2 := f.addAssetVersion(t, "a-multi", 2)
	sharedResource := f.asset(t, "a-resource", "u2")
	sharedProject := f.asset(t, "a-shared-project", "u1")
	f.project(t, "p2", "u1", "其他作品", false, `{"schemaVersion":1}`)
	f.ref(t, "project", "p1", "a-current", 1)
	f.ref(t, "project", "p1", "a-multi", 1)
	f.ref(t, "project-history", "p1", "a-history", 1)
	f.ref(t, "project-history", "p1", "a-multi", 1)
	f.ref(t, "export", "j1", "a-export", 1)
	f.ref(t, "project", "p2", "a-shared-project", 1)
	f.resource(t, "res-1", "a-resource", 1)
	f.exportJob(t, "j1", "u1", "p1", "succeeded", "exports/j1", "export-previews/j1", nil)
	f.exportJob(t, "j2", "u1", "p1", "failed", "", "", nil)

	task, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p1")
	if e != nil {
		t.Fatal(e)
	}
	if task.State != "pending" || task.ProjectID != "p1" || task.OwnerID != "u1" || task.Title != "待删除作品" || task.Width != 1200 || task.Height != 1600 || task.DeletedAt == nil || task.CreatedAt.IsZero() {
		t.Fatalf("unexpected task: %+v", task)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM projects WHERE id='p1'"); n != 0 {
		t.Fatal("project row remained", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_revisions WHERE project_id='p1'"); n != 0 {
		t.Fatal("project history remained", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM export_jobs WHERE project_id='p1'"); n != 0 {
		t.Fatal("export jobs remained", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM asset_refs WHERE owner_id IN ('p1','j1','j2')"); n != 0 {
		t.Fatal("project references remained", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM asset_refs WHERE owner_id IN ('p2','res-1','res-1:1')"); n != 3 {
		t.Fatalf("unrelated references were removed: %d", n)
	}
	rows, e := f.DB.Query("SELECT asset_id,asset_version FROM project_deletion_assets WHERE task_id=? ORDER BY asset_id", task.ID)
	if e != nil {
		t.Fatal(e)
	}
	captured := map[string]uint64{}
	for rows.Next() {
		var asset string
		var version uint64
		if e = rows.Scan(&asset, &version); e != nil {
			rows.Close()
			t.Fatal(e)
		}
		captured[asset] = version
	}
	rows.Close()
	want := map[string]uint64{"a-current": 1, "a-history": 1, "a-export": 1, "a-multi": 1}
	if len(captured) != len(want) {
		t.Fatalf("captured candidates = %v", captured)
	}
	for asset, version := range want {
		if captured[asset] != version {
			t.Fatalf("captured candidates = %v", captured)
		}
	}
	for _, key := range []storage.Key{current.Original, current.Normalized, current.Preview, history.Original, history.Normalized, history.Preview, exported.Original, exported.Normalized, exported.Preview, multiVersion1.Original, multiVersion1.Normalized, multiVersion1.Preview, "exports/j1", "export-previews/j1"} {
		if n := f.count(t, "SELECT COUNT(*) FROM project_deletion_files WHERE task_id=? AND file_key=?", task.ID, string(key)); n != 1 {
			t.Fatalf("file work missing for %s", key)
		}
		if !f.fileExists(t, key) {
			t.Fatalf("accept deleted file before cleanup: %s", key)
		}
	}
	for _, key := range []storage.Key{multiVersion2.Original, multiVersion2.Normalized, multiVersion2.Preview, sharedResource.Original, sharedResource.Normalized, sharedResource.Preview, sharedProject.Original, sharedProject.Normalized, sharedProject.Preview} {
		if n := f.count(t, "SELECT COUNT(*) FROM project_deletion_files WHERE task_id=? AND file_key=?", task.ID, string(key)); n != 0 {
			t.Fatalf("file work captured a non-exclusive key: %s", key)
		}
		if !f.fileExists(t, key) {
			t.Fatalf("shared file missing: %s", key)
		}
	}
}

func TestAcceptMalformedDocument(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	f.project(t, "p-broken", "u1", "损坏作品", true, `"broken"`)
	asset := f.asset(t, "a-broken", "u1")
	f.ref(t, "project-history", "p-broken", "a-broken", 1)
	task, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-broken")
	if e != nil {
		t.Fatal(e)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM projects WHERE id='p-broken'"); n != 0 {
		t.Fatal("malformed document blocked deletion", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletion_assets WHERE task_id=? AND asset_id='a-broken'", task.ID); n != 1 {
		t.Fatal("historical candidate missing", n)
	}
	if !f.fileExists(t, asset.Normalized) {
		t.Fatal("accept removed files directly")
	}
}

func TestAcceptPermissionsAndIdempotency(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	f.project(t, "p-normal", "u1", "正常作品", false, `{"schemaVersion":1}`)
	f.project(t, "p-other", "u2", "他人作品", true, `{"schemaVersion":1}`)
	f.project(t, "p-u3", "u3", "需改密", true, `{"schemaVersion":1}`)
	f.project(t, "p-owner", "u1", "本人作品", true, `{"schemaVersion":1}`)
	f.project(t, "p-admin", "u1", "管理员删除", true, `{"schemaVersion":1}`)

	_, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-normal")
	wantDeletionCode(t, e, "CONFLICT")
	_, e = f.Service.Accept(ctx, deletionAdmin, projectdeletions.AdminScope, "p-normal")
	wantDeletionCode(t, e, "CONFLICT")
	_, e = f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "missing")
	wantDeletionCode(t, e, "NOT_FOUND")
	_, e = f.Service.Accept(ctx, deletionAdmin, projectdeletions.AdminScope, "missing")
	wantDeletionCode(t, e, "NOT_FOUND")
	_, e = f.Service.Accept(ctx, deletionOwner, projectdeletions.AdminScope, "p-owner")
	wantDeletionCode(t, e, "FORBIDDEN")
	_, e = f.Service.Accept(ctx, auth.Principal{UserID: "u3", Role: "user", MustChangePassword: true}, projectdeletions.OwnerScope, "p-u3")
	wantDeletionCode(t, e, "PASSWORD_CHANGE_REQUIRED")
	_, e = f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-other")
	wantDeletionCode(t, e, "NOT_FOUND")
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletions"); n != 0 {
		t.Fatal("rejected requests created tasks", n)
	}

	first, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-owner")
	if e != nil {
		t.Fatal(e)
	}
	second, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-owner")
	if e != nil {
		t.Fatal(e)
	}
	if first.ID != second.ID {
		t.Fatal("replayed accept created another task")
	}
	_, e = f.Service.Accept(ctx, deletionAdmin, projectdeletions.OwnerScope, "p-owner")
	wantDeletionCode(t, e, "NOT_FOUND")
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletions WHERE project_id='p-owner'"); n != 1 {
		t.Fatal("duplicate tasks created", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM admin_audit_logs"); n != 0 {
		t.Fatal("owner accept wrote an admin audit", n)
	}

	adminFirst, e := f.Service.Accept(ctx, deletionAdmin, projectdeletions.AdminScope, "p-admin")
	if e != nil {
		t.Fatal(e)
	}
	adminSecond, e := f.Service.Accept(ctx, deletionAdmin, projectdeletions.AdminScope, "p-admin")
	if e != nil {
		t.Fatal(e)
	}
	ownerReplay, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-admin")
	if e != nil {
		t.Fatal(e)
	}
	if adminFirst.ID != adminSecond.ID || adminFirst.ID != ownerReplay.ID {
		t.Fatal("admin replay created another task")
	}
	if n := f.count(t, "SELECT COUNT(*) FROM admin_audit_logs WHERE action='project.permanent-delete' AND target_id='p-admin'"); n != 1 {
		t.Fatal("accept audit was not exactly once", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletions"); n != 2 {
		t.Fatal("unexpected task count", n)
	}
}

func TestAcceptRejectsActiveExport(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	now := time.Now().UTC()
	future, past := now.Add(time.Minute), now.Add(-time.Minute)
	for _, job := range []struct {
		project, state string
		lease          *time.Time
	}{
		{"p-queued", "queued", nil},
		{"p-running", "running", &future},
		{"p-expired", "running", &past},
	} {
		f.project(t, job.project, "u1", job.project, true, `{"schemaVersion":1}`)
		f.asset(t, "a-"+job.project, "u1")
		f.ref(t, "project", job.project, "a-"+job.project, 1)
		f.exportJob(t, "j-"+job.project, "u1", job.project, job.state, "", "", job.lease)
		_, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, job.project)
		wantDeletionCode(t, e, "CONFLICT")
		if n := f.count(t, "SELECT COUNT(*) FROM projects WHERE id=?", job.project); n != 1 {
			t.Fatalf("%s: project disappeared", job.project)
		}
		if n := f.count(t, "SELECT COUNT(*) FROM export_jobs WHERE id=?", "j-"+job.project); n != 1 {
			t.Fatalf("%s: export job disappeared", job.project)
		}
		if n := f.count(t, "SELECT COUNT(*) FROM asset_refs WHERE owner_id=?", job.project); n != 1 {
			t.Fatalf("%s: references disappeared", job.project)
		}
	}
	if n := f.count(t, "SELECT COUNT(*) FROM project_deletions"); n != 0 {
		t.Fatal("rejected requests created tasks", n)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM admin_audit_logs"); n != 0 {
		t.Fatal("rejected requests wrote audits", n)
	}
}

func TestDeletionQueriesAndRetry(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	f.project(t, "p-1", "u1", "第一件", true, `{"schemaVersion":1}`)
	f.project(t, "p-2", "u1", "第二件", true, `{"schemaVersion":1}`)
	f.project(t, "p-3", "u2", "他人任务", true, `{"schemaVersion":1}`)
	first, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-1")
	if e != nil {
		t.Fatal(e)
	}
	second, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-2")
	if e != nil {
		t.Fatal(e)
	}
	other, e := f.Service.Accept(ctx, auth.Principal{UserID: "u2", Role: "user"}, projectdeletions.OwnerScope, "p-3")
	if e != nil {
		t.Fatal(e)
	}
	items, total, e := f.Service.List(ctx, deletionOwner, projectdeletions.OwnerScope, projectdeletions.Query{})
	if e != nil || total != 2 || len(items) != 2 {
		t.Fatalf("owner list = %d/%d %v", len(items), total, e)
	}
	for _, item := range items {
		if item.OwnerID != "u1" {
			t.Fatal("owner list leaked another user's task")
		}
	}
	items, total, e = f.Service.List(ctx, deletionOwner, projectdeletions.OwnerScope, projectdeletions.Query{Keyword: "第二"})
	if e != nil || total != 1 || len(items) != 1 || items[0].ID != second.ID {
		t.Fatalf("keyword list = %d/%d %v", len(items), total, e)
	}
	items, total, e = f.Service.List(ctx, deletionOwner, projectdeletions.OwnerScope, projectdeletions.Query{Page: 2, PageSize: 1})
	if e != nil || total != 2 || len(items) != 1 || items[0].ID != second.ID {
		t.Fatalf("paged list = %d/%d %v", len(items), total, e)
	}
	items, total, e = f.Service.List(ctx, deletionAdmin, projectdeletions.AdminScope, projectdeletions.Query{OwnerID: "u2"})
	if e != nil || total != 1 || len(items) != 1 || items[0].ID != other.ID {
		t.Fatalf("admin owner filter = %d/%d %v", len(items), total, e)
	}
	_, _, e = f.Service.List(ctx, deletionOwner, projectdeletions.AdminScope, projectdeletions.Query{})
	wantDeletionCode(t, e, "FORBIDDEN")

	if _, e = f.Service.Get(ctx, deletionOwner, projectdeletions.OwnerScope, other.ID); e == nil {
		t.Fatal("owner read another user's task")
	} else {
		wantDeletionCode(t, e, "NOT_FOUND")
	}
	if got, e := f.Service.Get(ctx, deletionOwner, projectdeletions.OwnerScope, first.ID); e != nil || got.ID != first.ID {
		t.Fatal("owner cannot read own task", e)
	}
	if got, e := f.Service.Get(ctx, deletionAdmin, projectdeletions.AdminScope, other.ID); e != nil || got.ID != other.ID {
		t.Fatal("admin cannot read task", e)
	}

	f.exec(t, "UPDATE project_deletions SET state='completed',title=NULL,completed_at=UTC_TIMESTAMP(6) WHERE id=?", first.ID)
	items, total, e = f.Service.List(ctx, deletionOwner, projectdeletions.OwnerScope, projectdeletions.Query{})
	if e != nil || total != 1 || len(items) != 1 || items[0].ID != second.ID {
		t.Fatalf("completed task remained in list: %d/%d %v", len(items), total, e)
	}
	completed, e := f.Service.Get(ctx, deletionOwner, projectdeletions.OwnerScope, first.ID)
	if e != nil || completed.State != "completed" || completed.Title != "" || completed.CompletedAt == nil {
		t.Fatalf("completed task not readable: %+v %v", completed, e)
	}

	f.exec(t, "UPDATE project_deletions SET state='retry_wait',next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 1 HOUR WHERE id=?", second.ID)
	before := time.Now().UTC()
	retried, e := f.Service.Retry(ctx, deletionOwner, projectdeletions.OwnerScope, second.ID)
	if e != nil || retried.ID != second.ID {
		t.Fatal("owner retry failed", e)
	}
	var next time.Time
	if e = f.DB.QueryRow("SELECT next_attempt_at FROM project_deletions WHERE id=?", second.ID).Scan(&next); e != nil {
		t.Fatal(e)
	}
	if next.After(before.Add(time.Minute)) {
		t.Fatalf("retry did not move next_attempt_at forward: %s", next)
	}
	f.exec(t, "UPDATE project_deletions SET state='running',lease_token='live',lease_until=UTC_TIMESTAMP(6)+INTERVAL 1 MINUTE WHERE id=?", second.ID)
	_, e = f.Service.Retry(ctx, deletionOwner, projectdeletions.OwnerScope, second.ID)
	wantDeletionCode(t, e, "CONFLICT")
	f.exec(t, "UPDATE project_deletions SET lease_until=UTC_TIMESTAMP(6)-INTERVAL 1 MINUTE WHERE id=?", second.ID)
	if _, e = f.Service.Retry(ctx, deletionAdmin, projectdeletions.AdminScope, second.ID); e != nil {
		t.Fatal("admin retry failed", e)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM admin_audit_logs WHERE action='project.cleanup-retry' AND target_id=?", second.ID); n != 1 {
		t.Fatal("admin retry audit was not written exactly once", n)
	}
	if _, e = f.Service.Retry(ctx, deletionAdmin, projectdeletions.AdminScope, first.ID); e != nil {
		t.Fatal("completed retry should be idempotent", e)
	}
	if n := f.count(t, "SELECT COUNT(*) FROM admin_audit_logs WHERE action='project.cleanup-retry'"); n != 1 {
		t.Fatal("completed retry wrote an audit", n)
	}
	if _, e = f.Service.Retry(ctx, deletionOwner, projectdeletions.OwnerScope, other.ID); e == nil {
		t.Fatal("owner retried another user's task")
	} else {
		wantDeletionCode(t, e, "NOT_FOUND")
	}
}

func TestDeletionListRetainsOldUnfinishedTasks(t *testing.T) {
	f := newDeletionFixture(t)
	ctx := context.Background()
	f.project(t, "p-old", "u1", "过期未完成", true, `{"schemaVersion":1}`)
	task, e := f.Service.Accept(ctx, deletionOwner, projectdeletions.OwnerScope, "p-old")
	if e != nil {
		t.Fatal(e)
	}
	f.exec(t, "UPDATE project_deletions SET created_at=UTC_TIMESTAMP(6)-INTERVAL 31 DAY,deleted_at=UTC_TIMESTAMP(6)-INTERVAL 31 DAY,state='retry_wait',next_attempt_at=UTC_TIMESTAMP(6)+INTERVAL 1 HOUR WHERE id=?", task.ID)

	items, total, e := f.Service.List(ctx, deletionOwner, projectdeletions.OwnerScope, projectdeletions.Query{})
	if e != nil || total != 1 || len(items) != 1 || items[0].ID != task.ID || items[0].State != "retry_wait" {
		t.Fatalf("old unfinished task hidden: %d/%d %+v %v", len(items), total, items, e)
	}
}
