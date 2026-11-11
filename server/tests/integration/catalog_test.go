package integration_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/copy"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"fastposter/server/internal/transport"
	"strconv"
	"sync"
	"testing"
	"time"
)

func retireVersion(t *testing.T, db *sql.DB, assetID, version string) storage.ReclaimResult {
	t.Helper()
	number, e := strconv.ParseUint(version, 10, 64)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	tx, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback()
	result, e := storage.RetireUnreferencedVersion(ctx, tx, storage.AssetVersionRef{AssetID: assetID, Version: number})
	if e != nil {
		t.Fatal(e)
	}
	if e = tx.Commit(); e != nil {
		t.Fatal(e)
	}
	return result
}

func TestCatalogUnpublishKeepsReferencedVersionReadable(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	if _, e := db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	if _, e := db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "共享背景", AssetID: "bg-1", Published: true})
	if e != nil {
		t.Fatal(e)
	}
	a, e := p.Create(ctx, projectOwner(), "引用背景", doc)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = c.Save(ctx, admin, catalog.ResourceInput{ID: r.ID, Kind: "background", Title: r.Title, AssetID: "bg-1", Published: false, ExpectedVersion: r.Version}); e != nil {
		t.Fatal(e)
	}
	images := assets.NewService(db, p.Store, nil, t.TempDir())
	if _, e = images.AuthorizeRead(ctx, projectOwner(), "bg-1", "1"); e != nil {
		t.Fatal("existing project lost background", e)
	}
	if _, e = p.ResolveSnapshot(ctx, projectOwner(), a.ID, "1"); e != nil {
		t.Fatal(e)
	}
	if e = c.Delete(ctx, admin, r.ID); e == nil {
		t.Fatal("referenced file could be deleted")
	}
	if _, e = c.Save(ctx, projectOwner(), catalog.ResourceInput{Kind: "background", Title: "forged", AssetID: "bg-1"}); e == nil {
		t.Fatal("normal user managed catalog")
	}
}
func TestCatalogAdminProjectListContainsMetadataOnly(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	if _, e := p.Create(ctx, projectOwner(), "private", doc); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	items, _, e := c.AdminProjects(ctx, auth.Principal{UserID: "u2", Role: "admin"}, catalog.Filter{})
	if e != nil {
		t.Fatal(e)
	}
	raw, e := json.Marshal(items)
	if e != nil {
		t.Fatal(e)
	}
	var rows []map[string]any
	if e = json.Unmarshal(raw, &rows); e != nil {
		t.Fatal(e)
	}
	if len(rows) != 1 {
		t.Fatal("missing metadata")
	}
	for key := range rows[0] {
		if key == "document" || key == "textBlocks" || key == "fonts" || key == "background" {
			t.Fatal("private poster exposed in metadata", key)
		}
	}
}
func TestCatalogAdminStatsCountActualStorage(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	o, e := c.Overview(ctx, auth.Principal{UserID: "u2", Role: "admin"})
	if e != nil {
		t.Fatal(e)
	}
	actual, e := storage.Usage(ctx, p.Store)
	if e != nil || o.StorageBytes != actual {
		t.Fatalf("storage bytes %d %d %v", o.StorageBytes, actual, e)
	}
}
func TestPublishedResourceAndOtherTrashProtectAssetFromRetirement(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	project, e := p.Create(ctx, projectOwner(), "待彻底删除", doc)
	if e != nil {
		t.Fatal(e)
	}
	if e = p.SoftDelete(ctx, projectOwner(), project.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "公开背景", AssetID: "bg-1", Published: true})
	if e != nil {
		t.Fatal(e)
	}
	if result := retireVersion(t, db, "bg-1", "1"); result.Retired {
		t.Fatal("asset referenced by a trashed project was retired")
	}
	if _, e = db.Exec("DELETE FROM asset_refs WHERE owner_kind IN ('project','project-history') AND owner_id=?", project.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("DELETE FROM projects WHERE id=?", project.ID); e != nil {
		t.Fatal(e)
	}
	if result := retireVersion(t, db, "bg-1", "1"); result.Retired {
		t.Fatal("asset referenced by a published resource was retired")
	}
	if _, e = db.Exec("DELETE FROM asset_refs WHERE owner_kind IN ('resource','resource-version') AND (owner_id=? OR owner_id LIKE ?)", r.ID, r.ID+":%"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("DELETE FROM resources WHERE id=?", r.ID); e != nil {
		t.Fatal(e)
	}
	result := retireVersion(t, db, "bg-1", "1")
	if !result.Retired || len(result.Keys) == 0 {
		t.Fatalf("unreferenced asset version was not retired: %+v", result)
	}
	for _, key := range result.Keys {
		if _, e = p.Store.Stat(ctx, key); e != nil {
			t.Fatalf("retirement deleted files before commit: %s %v", key, e)
		}
	}
}

func TestCatalogSaveCannotPublishRetiredVersion(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	if _, e := db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	retirement, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer retirement.Rollback()
	for _, statement := range []string{
		"SELECT 1 FROM assets WHERE id='bg-1' FOR UPDATE",
		"SELECT 1 FROM asset_versions WHERE asset_id='bg-1' AND version=1 FOR UPDATE",
	} {
		if _, e = retirement.ExecContext(ctx, statement); e != nil {
			t.Fatal(e)
		}
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM asset_versions WHERE asset_id='bg-1' AND version=1"); e != nil {
		t.Fatal(e)
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM assets WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	saved := make(chan error, 1)
	go func() {
		_, err := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "race", AssetID: "bg-1"})
		saved <- err
	}()
	select {
	case e = <-saved:
		t.Fatalf("catalog save bypassed an in-flight retirement: %v", e)
	case <-time.After(250 * time.Millisecond):
	}
	if e = retirement.Commit(); e != nil {
		t.Fatal(e)
	}
	select {
	case e = <-saved:
		var known *domain.Error
		if !errors.As(e, &known) || known.Code != "NOT_FOUND" {
			t.Fatalf("catalog save after retirement = %v, want NOT_FOUND", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("catalog save did not observe the retirement commit")
	}
	var count int
	if e = db.QueryRow("SELECT COUNT(*) FROM resources WHERE title='race'").Scan(&count); e != nil || count != 0 {
		t.Fatalf("retired version was published: %d %v", count, e)
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE asset_id='bg-1'").Scan(&count); e != nil || count != 0 {
		t.Fatalf("retired version gained references: %d %v", count, e)
	}
}

func TestCatalogDeletesUnreferencedResourceVersionWithoutDeletingFile(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	admin := auth.Principal{UserID: "u1", Role: "admin"}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "unused", AssetID: "bg-1"})
	if e != nil {
		t.Fatal(e)
	}
	if e = c.Delete(ctx, admin, r.ID); e != nil {
		t.Fatal("own resource-version refs blocked unreferenced metadata deletion", e)
	}
	if _, e = c.Get(ctx, admin, r.ID, true); e == nil {
		t.Fatal("deleted resource still listed")
	}
}

// ---- B01 version precondition tests -------------------------------------
// These drive the transport contract (the typed CatalogCall a bound HTTP
// request becomes) rather than calling catalog.Service directly, so the
// expectedVersion wire field is exercised end to end.

func vpStr(s string) *string { return &s }
func vpBool(b bool) *bool    { return &b }
func vpI32(i int32) *int32   { return &i }

type versionHarness struct {
	db      *sql.DB
	adminT  string
	userT   string
	adapter func(context.Context, *common.CatalogCall) (*common.RPCReply, error)
}

func newVersionHarness(t *testing.T) *versionHarness {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	if _, e = accounts.CreateAdmin(ctx, "ver-admin", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.Register(ctx, "ver-user", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	a, e := accounts.Login(ctx, "ver-admin", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	u, e := accounts.Login(ctx, "ver-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, nil, nil)
	return &versionHarness{
		db:      db,
		adminT:  a.Token,
		userT:   u.Token,
		adapter: transport.CatalogAdapter(accounts, c, copy.NewService(db, c)),
	}
}

func (h *versionHarness) invoke(ctx context.Context, token, action string, in *common.ResourceInput, mv *common.MoveResourceInput, id string) (*common.RPCReply, error) {
	c := &common.CatalogCall{Context: &common.CallContext{RequestId: "b01", SessionToken: token}, Action: action}
	if in != nil {
		c.Input = in
	}
	if mv != nil {
		c.Move = mv
	}
	if id != "" {
		c.Id = vpStr(id)
	}
	return h.adapter(ctx, c)
}

func requireResource(t *testing.T, r *common.RPCReply) *common.ResourceDTO {
	t.Helper()
	if r == nil || r.Error != nil || r.Data == nil || r.Data.Resource == nil {
		t.Fatalf("save failed: %+v", r)
	}
	return r.Data.Resource
}

func (h *versionHarness) saveResource(t *testing.T, ctx context.Context, kind, title, parent string, published bool) *common.ResourceDTO {
	t.Helper()
	in := &common.ResourceInput{Kind: kind, Title: title, Published: vpBool(published)}
	if parent != "" {
		in.ParentId = vpStr(parent)
	}
	r, e := h.invoke(ctx, h.adminT, "AdminSaveResource", in, nil, "")
	if e != nil {
		t.Fatal(e)
	}
	return requireResource(t, r)
}

func (h *versionHarness) saveCopy(t *testing.T, ctx context.Context, title, body string, published bool) *common.ResourceDTO {
	t.Helper()
	r, e := h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy", Title: title, Body: vpStr(body), Published: vpBool(published),
	}, nil, "")
	if e != nil {
		t.Fatal(e)
	}
	return requireResource(t, r)
}

func (h *versionHarness) saveCategory(t *testing.T, ctx context.Context, title, parent string, published bool) *common.ResourceDTO {
	return h.saveResource(t, ctx, "copy-category", title, parent, published)
}

type versionSnap struct {
	version     uint64
	versionRows int
	parent      string
	title       string
}

func (h *versionHarness) snapshot(t *testing.T, id string) versionSnap {
	t.Helper()
	var s versionSnap
	var parent sql.NullString
	if e := h.db.QueryRow("SELECT current_version,parent_id,title FROM resources WHERE id=?", id).Scan(&s.version, &parent, &s.title); e != nil {
		t.Fatal(e)
	}
	s.parent = parent.String
	if e := h.db.QueryRow("SELECT COUNT(*) FROM resource_versions WHERE resource_id=?", id).Scan(&s.versionRows); e != nil {
		t.Fatal(e)
	}
	return s
}

func TestCatalogSaveVersionRejectsConcurrentOverwrite(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	created := h.saveCopy(t, ctx, "初稿", "内容A", true)
	old, e := strconv.ParseUint(created.Version, 10, 64)
	if e != nil {
		t.Fatal(e)
	}

	var wg sync.WaitGroup
	replies := make([]*common.RPCReply, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			v := created.Version
			replies[i], _ = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
				Kind: "copy", Title: "并发标题", Id: vpStr(created.Id),
				Body: vpStr("内容B"), Published: vpBool(true), ExpectedVersion: &v,
			}, nil, "")
		}(i)
	}
	wg.Wait()
	success, conflict := 0, 0
	for _, r := range replies {
		if r == nil {
			t.Fatal("nil reply")
		}
		if r.Error == nil {
			success++
		} else if r.Error.Code == "REVISION_CONFLICT" {
			conflict++
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("concurrent overwrite: want 1 success + 1 REVISION_CONFLICT, got success=%d conflict=%d", success, conflict)
	}
	var current uint64
	if e = h.db.QueryRow("SELECT current_version FROM resources WHERE id=?", created.Id).Scan(&current); e != nil {
		t.Fatal(e)
	}
	if current != old+1 {
		t.Fatalf("current_version must advance exactly once: got %d want %d", current, old+1)
	}
	var audits int
	if e = h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=? AND action='resource.save' AND result='success'", created.Id).Scan(&audits); e != nil {
		t.Fatal(e)
	}
	// One creation plus exactly one winning concurrent write.
	if audits != 2 {
		t.Fatalf("success audits: got %d want 2 (create + one winning update)", audits)
	}
}

func TestCatalogCategoryEditRollsBackParentAndFields(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	root := h.saveCategory(t, ctx, "根", "", true)
	other := h.saveCategory(t, ctx, "其他", "", true)
	child := h.saveCategory(t, ctx, "子", root.Id, true)

	// A single atomic edit: fields plus parent, one snapshot version.
	v := child.Version
	r, e := h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy-category", Title: "子改名", Id: vpStr(child.Id),
		ParentId: vpStr(other.Id), SortOrder: vpI32(7), Published: vpBool(false),
		ExpectedVersion: &v,
	}, nil, "")
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("valid atomic category edit rejected", r.Error.Code, r.Error.Message)
	}
	after := h.snapshot(t, child.Id)
	if after.version != 2 || after.parent != other.Id || after.title != "子改名" || after.versionRows != 2 {
		t.Fatalf("atomic edit not applied in one transaction: %+v", after)
	}

	// Existing-resource edits with a missing / malformed / stale version must
	// be rejected before anything is written.
	cases := []struct {
		name string
		ver  *string
		code string
	}{
		{"missing", nil, "INVALID_INPUT"},
		{"empty", vpStr(""), "INVALID_INPUT"},
		{"zero", vpStr("0"), "INVALID_INPUT"},
		{"leading-zero", vpStr("01"), "INVALID_INPUT"},
		{"negative", vpStr("-1"), "INVALID_INPUT"},
		{"padded", vpStr(" 1"), "INVALID_INPUT"},
		{"float", vpStr("1.0"), "INVALID_INPUT"},
		{"non-numeric", vpStr("abc"), "INVALID_INPUT"},
		{"overflow", vpStr("18446744073709551616"), "INVALID_INPUT"},
		{"stale", vpStr("1"), "REVISION_CONFLICT"},
	}
	for _, tc := range cases {
		r, e = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
			Kind: "copy-category", Title: "试探", Id: vpStr(child.Id),
			ParentId: vpStr(root.Id), ExpectedVersion: tc.ver,
		}, nil, "")
		if e != nil {
			t.Fatal(tc.name, e)
		}
		if r.Error == nil || r.Error.Code != tc.code {
			t.Fatalf("%s: want %s, got %+v", tc.name, tc.code, r.Error)
		}
		if got := h.snapshot(t, child.Id); got != after {
			t.Fatalf("%s changed the resource: %+v -> %+v", tc.name, after, got)
		}
	}

	// A field validation failure also leaves version, fields and tree intact.
	r, e = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy-category", Title: "  ", Id: vpStr(child.Id),
		ExpectedVersion: vpStr("2"),
	}, nil, "")
	if e != nil || r.Error == nil {
		t.Fatal("empty title should be rejected", e)
	}
	if got := h.snapshot(t, child.Id); got != after {
		t.Fatalf("empty title changed the resource: %+v -> %+v", after, got)
	}
}

func TestCatalogMoveVersionAndDepth(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	root := h.saveCategory(t, ctx, "根", "", true)
	other := h.saveCategory(t, ctx, "其他", "", true)
	child := h.saveCategory(t, ctx, "子", root.Id, true)
	before := h.snapshot(t, child.Id)

	// Standalone move advances the version, writes a version row and audit.
	v := strconv.FormatUint(before.version, 10)
	r, e := h.invoke(ctx, h.adminT, "AdminMoveResource", nil, &common.MoveResourceInput{
		Id: child.Id, ParentId: vpStr(other.Id), ExpectedVersion: &v,
	}, "")
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("valid standalone move rejected", r.Error.Code, r.Error.Message)
	}
	after := h.snapshot(t, child.Id)
	if after.version != before.version+1 || after.versionRows != before.versionRows+1 {
		t.Fatalf("standalone move must advance version and write a version row: %+v -> %+v", before, after)
	}
	if after.parent != other.Id || after.title != before.title {
		t.Fatalf("standalone move changed unrelated fields: %+v -> %+v", before, after)
	}
	var oldRow int
	if e = h.db.QueryRow("SELECT COUNT(*) FROM resource_versions WHERE resource_id=? AND version=?", child.Id, before.version).Scan(&oldRow); e != nil {
		t.Fatal(e)
	}
	if oldRow != 1 {
		t.Fatal("previous version must remain readable")
	}
	var audits int
	if e = h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=? AND result='success'", child.Id).Scan(&audits); e != nil {
		t.Fatal(e)
	}
	if audits != 2 {
		t.Fatalf("move success audits: got %d want 2 (create + move)", audits)
	}

	// Failures must not advance the version or mutate the tree.
	current := strconv.FormatUint(after.version, 10)
	d1 := h.saveCategory(t, ctx, "深1", "", true)
	d2 := h.saveCategory(t, ctx, "深2", d1.Id, true)
	d3 := h.saveCategory(t, ctx, "深3", d2.Id, true)
	d4 := h.saveCategory(t, ctx, "深4", d3.Id, true)
	d5 := h.saveCategory(t, ctx, "深5", d4.Id, true)
	foreign := h.saveResource(t, ctx, "background-category", "外来分类", "", true)

	bad := []struct {
		name string
		mv   *common.MoveResourceInput
		code string
	}{
		{"missing-version", &common.MoveResourceInput{Id: child.Id, ParentId: vpStr(root.Id)}, "INVALID_INPUT"},
		{"malformed-version", &common.MoveResourceInput{Id: child.Id, ParentId: vpStr(root.Id), ExpectedVersion: vpStr("01")}, "INVALID_INPUT"},
		{"stale-version", &common.MoveResourceInput{Id: child.Id, ParentId: vpStr(root.Id), ExpectedVersion: vpStr("1")}, "REVISION_CONFLICT"},
		{"cycle", &common.MoveResourceInput{Id: d1.Id, ParentId: vpStr(d5.Id), ExpectedVersion: vpStr(d1.Version)}, ""},
		{"cross-kind", &common.MoveResourceInput{Id: child.Id, ParentId: vpStr(foreign.Id), ExpectedVersion: &current}, ""},
		{"six-levels", &common.MoveResourceInput{Id: child.Id, ParentId: vpStr(d5.Id), ExpectedVersion: &current}, ""},
	}
	for _, tc := range bad {
		r, e = h.invoke(ctx, h.adminT, "AdminMoveResource", nil, tc.mv, "")
		if e != nil {
			t.Fatal(tc.name, e)
		}
		if tc.code == "" {
			if r.Error == nil {
				t.Fatalf("%s: expected rejection, got success", tc.name)
			}
		} else if r.Error == nil || r.Error.Code != tc.code {
			t.Fatalf("%s: want %s, got %+v", tc.name, tc.code, r.Error)
		}
	}
	if got := h.snapshot(t, child.Id); got != after {
		t.Fatalf("failed moves changed the moved category: %+v -> %+v", after, got)
	}
}
