package integration_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func projectService(t *testing.T) (*projects.Service, *sql.DB, document.Document) {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled'),('u2','two','two','disabled')"); e != nil {
		t.Fatal(e)
	}
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	for _, id := range []string{"bg-1", "bg-other", "font-1"} {
		owner, kind, w, h := "u1", "image", 1200, 1600
		meta := "{}"
		if id == "bg-other" {
			owner = "u2"
		}
		if id == "font-1" {
			kind = "font"
			w = 0
			h = 0
			meta = `{"family":"Noto Sans SC","weight":400,"style":"normal"}`
		}
		key := storage.NewKey("test")
		info, e := store.Put(context.Background(), key, strings.NewReader("immutable bytes"))
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,?,?)", id, owner, kind, id); e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES(?,1,?,?,?,'application/octet-stream',?,?,1,1,1,?,?,?)", id, string(key), string(key), string(key), w, h, info.SHA256, info.SHA256, meta); e != nil {
			t.Fatal(e)
		}
	}
	raw, e := os.ReadFile(filepath.Join(repoRoot(t), "tests/fixtures/documents/valid-mixed.json"))
	if e != nil {
		t.Fatal(e)
	}
	doc, e := document.Parse(raw)
	if e != nil {
		t.Fatal(e)
	}
	return projects.NewService(db, store), db, doc
}
func projectOwner() auth.Principal { return auth.Principal{UserID: "u1", Role: "user"} }
func TestProjectSaveRejectsStaleRevisionWithoutMutation(t *testing.T) {
	svc, _, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	created, e := svc.Create(ctx, p, "海报", doc)
	if e != nil {
		t.Fatal(e)
	}
	doc.TextBlocks[0].X = 90
	first, e := svc.Save(ctx, p, created.ID, "1", "第一版", doc)
	if e != nil || first.Revision != "2" {
		t.Fatal("save failed", e)
	}
	doc.TextBlocks[0].X = 100
	_, e = svc.Save(ctx, p, created.ID, "1", "过期版", doc)
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "REVISION_CONFLICT" {
		t.Fatal("stale save accepted", e)
	}
	current, e := svc.Get(ctx, p, created.ID)
	if e != nil || current.Title != "第一版" || current.Document.TextBlocks[0].X != 90 {
		t.Fatal("stale write mutated document")
	}
	var successes int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for range 2 {
		wg.Go(func() {
			_, e := svc.Save(ctx, p, created.ID, "2", "并发", doc)
			if e == nil {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	if successes != 1 {
		t.Fatalf("CAS winners %d", successes)
	}
}
func TestProjectCannotReferenceOtherUsersAssets(t *testing.T) {
	svc, db, doc := projectService(t)
	doc.Background.AssetID = "bg-other"
	if _, e := svc.Create(context.Background(), projectOwner(), "不能使用", doc); e == nil {
		t.Fatal("foreign asset referenced")
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM projects").Scan(&count)
	if count != 0 {
		t.Fatal("invalid project registered")
	}
	doc.Background.AssetID = "bg-1"
	doc.Canvas.Width = 1199
	if _, e := svc.Create(context.Background(), projectOwner(), "错误尺寸", doc); e == nil {
		t.Fatal("canvas no longer matches original background")
	}
}
func TestProjectCloneGetsIndependentID(t *testing.T) {
	svc, _, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	original, e := svc.Create(ctx, p, "原件", doc)
	if e != nil {
		t.Fatal(e)
	}
	copy, e := svc.Clone(ctx, p, original.ID)
	if e != nil || copy.ID == original.ID || copy.Revision != "1" {
		t.Fatal("clone failed", e)
	}
	if _, e = svc.Get(ctx, auth.Principal{UserID: "u2", Role: "admin"}, original.ID); e == nil {
		t.Fatal("admin read private project")
	}
}
func TestProjectDeleteRestoreWithin30Days(t *testing.T) {
	svc, db, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	a, e := svc.Create(ctx, p, "作品", doc)
	if e != nil {
		t.Fatal(e)
	}
	if e = svc.SoftDelete(ctx, p, a.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = svc.Get(ctx, p, a.ID); e == nil {
		t.Fatal("deleted project still active")
	}
	if _, e = svc.Restore(ctx, p, a.ID); e != nil {
		t.Fatal(e)
	}
	svc.SoftDelete(ctx, p, a.ID)
	db.Exec("UPDATE projects SET deleted_at=UTC_TIMESTAMP(6)-INTERVAL 31 DAY WHERE id=?", a.ID)
	if _, e = svc.Restore(ctx, p, a.ID); e == nil {
		t.Fatal("expired trash restored")
	}
}
func TestProjectSnapshotImmutableAfterLaterSave(t *testing.T) {
	svc, db, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	a, e := svc.Create(ctx, p, "作品", doc)
	if e != nil {
		t.Fatal(e)
	}
	first, e := svc.ResolveSnapshot(ctx, p, a.ID, "1")
	if e != nil {
		t.Fatal(e)
	}
	before, _ := json.Marshal(first)
	doc.TextBlocks[0].Content.Content[0].Content[0].Text = "已修改"
	doc.Fonts = nil
	doc.TextBlocks = nil
	if _, e = svc.Save(ctx, p, a.ID, "1", "新版", doc); e != nil {
		t.Fatal(e)
	}
	second, e := svc.ResolveSnapshot(ctx, p, a.ID, "1")
	if e != nil {
		t.Fatal(e)
	}
	after, _ := json.Marshal(second)
	if string(before) != string(after) {
		t.Fatal("immutable snapshot changed")
	}
	var refs int
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='project' AND owner_id=? AND asset_id='font-1'", a.ID).Scan(&refs); e != nil || refs != 0 {
		t.Fatal("current refs not updated")
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='project-history' AND owner_id=? AND asset_id='font-1'", a.ID).Scan(&refs); e != nil || refs != 1 {
		t.Fatal("historical version lost its font")
	}
}

func TestProjectPreservesUnpublishedAssetVersion(t *testing.T) {
	svc, db, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	if _, e := db.Exec("UPDATE assets SET owner_id=NULL WHERE id='font-1'"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO resources(id,kind,title,published,created_by) VALUES('font-resource','font','font',1,'u1')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,metadata) VALUES('font-resource',1,'font-1',1,JSON_OBJECT())"); e != nil {
		t.Fatal(e)
	}
	a, e := svc.Create(ctx, p, "公开字体", doc)
	if e != nil {
		t.Fatal(e)
	}
	db.Exec("UPDATE resources SET published=0 WHERE id='font-resource'")
	if _, e = svc.Save(ctx, p, a.ID, "1", "保留已用字体", doc); e != nil {
		t.Fatal("unpublication broke existing reference", e)
	}
	if _, e = svc.ResolveSnapshot(ctx, p, a.ID, "1"); e != nil {
		t.Fatal("old snapshot lost font", e)
	}
	// Another user has an owned background, but has never referenced the unpublished font.
	doc.Background.AssetID = "bg-other"
	if _, e = svc.Create(ctx, auth.Principal{UserID: "u2", Role: "user"}, "不能新选", doc); e == nil {
		t.Fatal("new project used unpublished font")
	}
}
func TestProjectRevisionAndReferencesRollbackTogether(t *testing.T) {
	svc, db, doc := projectService(t)
	ctx := context.Background()
	p := projectOwner()
	a, e := svc.Create(ctx, p, "原版", doc)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("CREATE TRIGGER fail_revision BEFORE INSERT ON project_revisions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected failure'"); e != nil {
		t.Fatal(e)
	}
	doc.TextBlocks = nil
	doc.Fonts = nil
	if _, e = svc.Save(ctx, p, a.ID, "1", "不应出现", doc); e == nil {
		t.Fatal("revision failure reported success")
	}
	current, e := svc.Get(ctx, p, a.ID)
	if e != nil || current.Revision != "1" || current.Title != "原版" {
		t.Fatal("partial document update", e)
	}
	var count int
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='project' AND owner_id=? AND asset_id='font-1'", a.ID).Scan(&count); e != nil || count != 1 {
		t.Fatal("partial reference update", e)
	}
}
