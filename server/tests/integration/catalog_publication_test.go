package integration_test

import (
	"context"
	"database/sql"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/copy"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"fastposter/server/internal/transport"
	"strconv"
	"strings"
	"testing"
)

// newPublicationHarness is like newVersionHarness but wires a real assets
// service, so publishing asset-backed resources can go through the adapter's
// publicResource reply builder (which resolves the resource's main asset).
// Only synthetic seed data is used.
func newPublicationHarness(t *testing.T) *versionHarness {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	if _, e = accounts.CreateAdmin(ctx, "pub-admin", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.Register(ctx, "pub-user", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	a, e := accounts.Login(ctx, "pub-admin", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	u, e := accounts.Login(ctx, "pub-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	images := assets.NewService(db, store, nil, t.TempDir())
	c := catalog.NewService(db, store, images)
	return &versionHarness{
		db:      db,
		adminT:  a.Token,
		userT:   u.Token,
		adapter: transport.CatalogAdapter(accounts, c, copy.NewService(db, c)),
	}
}

// publishInvoke drives AdminPublishResource through the catalog adapter, the
// typed CatalogCall that a bound HTTP POST becomes. The publication body
// carries only published + expectedVersion; id is a path parameter.
func (h *versionHarness) publishInvoke(ctx context.Context, token, id string, published *bool, expectedVersion string) (*common.RPCReply, error) {
	return h.adapter(ctx, &common.CatalogCall{
		Context: &common.CallContext{RequestId: "b02", SessionToken: token},
		Action:  "AdminPublishResource",
		Publication: &common.PublishResourceInput{
			Id:              id,
			Published:       published,
			ExpectedVersion: expectedVersion,
		},
	})
}

type pubVersionRow struct{ assetID, assetVersion, document, body, metadata string }

func readPubVersionRow(t *testing.T, db *sql.DB, id string, version uint64) pubVersionRow {
	t.Helper()
	var assetID, assetVersion, document, body, metadata sql.NullString
	if e := db.QueryRow("SELECT asset_id,asset_version,document,body,metadata FROM resource_versions WHERE resource_id=? AND version=?", id, version).Scan(&assetID, &assetVersion, &document, &body, &metadata); e != nil {
		t.Fatal(e)
	}
	return pubVersionRow{assetID.String, assetVersion.String, document.String, body.String, metadata.String}
}

func pubRefs(t *testing.T, db *sql.DB, ownerKind, ownerID string) string {
	t.Helper()
	rows, e := db.Query("SELECT asset_id,asset_version FROM asset_refs WHERE owner_kind=? AND owner_id=? ORDER BY asset_id,asset_version", ownerKind, ownerID)
	if e != nil {
		t.Fatal(e)
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var asset string
		var version uint64
		if e = rows.Scan(&asset, &version); e != nil {
			t.Fatal(e)
		}
		out = append(out, asset+":"+strconv.FormatUint(version, 10))
	}
	if e = rows.Err(); e != nil {
		t.Fatal(e)
	}
	return strings.Join(out, ",")
}

func jsonColumn(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// TestCatalogPublicationPreservesVersionContentAndRefs publishes four kinds
// (background, font, template, copy) and asserts the new version inherits the
// locked current version's title/metadata/asset version/document/body and that
// both owner kinds of asset_refs stay intact. Only synthetic seed data is used.
func TestCatalogPublicationPreservesVersionContentAndRefs(t *testing.T) {
	h := newPublicationHarness(t)
	ctx := context.Background()

	var adminID string
	if e := h.db.QueryRow("SELECT id FROM users WHERE username='pub-admin'").Scan(&adminID); e != nil {
		t.Fatal(e)
	}
	sha := strings.Repeat("0", 64)
	for _, a := range []struct{ id, kind, meta string }{
		{"pub-bg", "image", "{}"},
		{"pub-font", "font", `{"family":"Noto","weight":400,"style":"normal"}`},
	} {
		if _, e := h.db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES(?,?,?,?)", a.id, adminID, a.kind, a.id); e != nil {
			t.Fatal(e)
		}
		if _, e := h.db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,original_size,normalized_size,original_sha256,normalized_sha256,metadata) VALUES(?,1,'synthetic','synthetic','','application/octet-stream',1,1,?,?,?)", a.id, sha, sha, a.meta); e != nil {
			t.Fatal(e)
		}
	}

	type spec struct {
		id, kind, document, body, metadata string
		refs                               []string
	}
	specs := []spec{
		{"pub-r-bg", "background", "", "背景说明", "{}", []string{"pub-bg"}},
		{"pub-r-font", "font", "", "字体说明", `{"family":"Noto","weight":400,"style":"normal","license":"OFL"}`, []string{"pub-font"}},
		{"pub-r-tpl", "template", `{"background":{"assetId":"pub-bg","version":"1"}}`, "", "{}", []string{"pub-bg", "pub-font"}},
		{"pub-r-copy", "copy", "", "文案正文", "{}", nil},
	}
	for _, s := range specs {
		if _, e := h.db.Exec("INSERT INTO resources(id,kind,title,published,current_version,created_by) VALUES(?,?,?,0,1,?)", s.id, s.kind, s.kind+" 内容", adminID); e != nil {
			t.Fatal(e)
		}
		var assetID, assetVersion any
		if len(s.refs) > 0 {
			assetID, assetVersion = s.refs[0], "1"
		}
		if _, e := h.db.Exec("INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,document,body,metadata) VALUES(?,1,?,?,?,?,?)", s.id, assetID, assetVersion, jsonColumn(s.document), jsonColumn(s.body), s.metadata); e != nil {
			t.Fatal(e)
		}
		for _, asset := range s.refs {
			if _, e := h.db.Exec("INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('resource',?,?,1),('resource-version',?,?,1)", s.id, asset, s.id+":1", asset); e != nil {
				t.Fatal(e)
			}
		}
	}

	for _, s := range specs {
		before := readPubVersionRow(t, h.db, s.id, 1)
		refsBefore := pubRefs(t, h.db, "resource-version", s.id+":1")

		r, e := h.publishInvoke(ctx, h.adminT, s.id, vpBool(true), "1")
		if e != nil {
			t.Fatal(s.kind, e)
		}
		if r.Error != nil {
			t.Fatalf("%s: publication rejected: %s %s", s.kind, r.Error.Code, r.Error.Message)
		}
		echoed := requireResource(t, r)
		if echoed.Version != "2" {
			t.Fatalf("%s: response version must be the transaction snapshot (2), got %s", s.kind, echoed.Version)
		}

		after := readPubVersionRow(t, h.db, s.id, 2)
		if before != after {
			t.Fatalf("%s: new version did not inherit content/assets: %+v -> %+v", s.kind, before, after)
		}
		if got := pubRefs(t, h.db, "resource-version", s.id+":2"); got != refsBefore {
			t.Fatalf("%s: resource-version refs not copied: %q -> %q", s.kind, refsBefore, got)
		}
		var resourceRefs int
		if e = h.db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='resource' AND owner_id=?", s.id).Scan(&resourceRefs); e != nil {
			t.Fatal(e)
		}
		if resourceRefs != len(s.refs) {
			t.Fatalf("%s: resource refs not preserved: got %d want %d", s.kind, resourceRefs, len(s.refs))
		}
		var published bool
		var current uint64
		if e = h.db.QueryRow("SELECT published,current_version FROM resources WHERE id=?", s.id).Scan(&published, &current); e != nil {
			t.Fatal(e)
		}
		if !published || current != 2 {
			t.Fatalf("%s: published=%v current=%d, want true/2", s.kind, published, current)
		}
		var oldRows int
		if e = h.db.QueryRow("SELECT COUNT(*) FROM resource_versions WHERE resource_id=? AND version=1", s.id).Scan(&oldRows); e != nil {
			t.Fatal(e)
		}
		if oldRows != 1 {
			t.Fatalf("%s: previous version not readable", s.kind)
		}
		var audits int
		if e = h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=? AND action='resource.publish' AND result='success'", s.id).Scan(&audits); e != nil {
			t.Fatal(e)
		}
		if audits != 1 {
			t.Fatalf("%s: expected exactly one success audit, got %d", s.kind, audits)
		}
	}
}

// TestCatalogPublicationRejectsStaleEvenForSameState proves version comparison
// happens before state comparison and that a legal same-state publication is a
// success with zero writes.
func TestCatalogPublicationRejectsStaleEvenForSameState(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	created := h.saveCopy(t, ctx, "草稿", "内容A", true)

	// A stale version with an identical target state MUST still conflict (409).
	r, e := h.publishInvoke(ctx, h.adminT, created.Id, vpBool(true), "999")
	if e != nil {
		t.Fatal(e)
	}
	if r == nil || r.Error == nil || r.Error.Code != "REVISION_CONFLICT" {
		t.Fatalf("stale same-state publication must be REVISION_CONFLICT, got %+v", r)
	}
	if got := h.snapshot(t, created.Id); got.version != 1 || got.versionRows != 1 {
		t.Fatalf("stale publication wrote state: %+v", got)
	}

	// Legal version + state already equal => success, ZERO write.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(true), created.Version)
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("same-state publication rejected", r.Error.Code, r.Error.Message)
	}
	if v := requireResource(t, r).Version; v != "1" {
		t.Fatalf("response version must be the transaction snapshot: %s", v)
	}
	if got := h.snapshot(t, created.Id); got.version != 1 || got.versionRows != 1 {
		t.Fatalf("same-state publication wrote a version: %+v", got)
	}
	var audits int
	if e = h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=? AND action='resource.publish'", created.Id).Scan(&audits); e != nil {
		t.Fatal(e)
	}
	if audits != 0 {
		t.Fatalf("same-state publication wrote an audit: %d", audits)
	}

	// A real state change with the same legal version advances the version.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(false), created.Version)
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("state-change publication rejected", r.Error.Code, r.Error.Message)
	}
	if v := requireResource(t, r).Version; v != "2" {
		t.Fatalf("state-change response version = %s, want 2 (transaction snapshot)", v)
	}
	if got := h.snapshot(t, created.Id); got.version != 2 || got.versionRows != 2 {
		t.Fatalf("state-change publication did not write one new version: %+v", got)
	}
	if e = h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=? AND action='resource.publish' AND result='success'", created.Id).Scan(&audits); e != nil {
		t.Fatal(e)
	}
	if audits != 1 {
		t.Fatalf("state-change publication audits = %d, want 1", audits)
	}
}

// TestCatalogPublicationHTTPContract pins the wire-level error contract:
// explicit published:false is accepted, a missing/null published is BAD_REQUEST
// (400 via hertz.go), bad/missing versions are INVALID_INPUT (422), stale is
// REVISION_CONFLICT (409), and ordinary users are FORBIDDEN (403).
func TestCatalogPublicationHTTPContract(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	created := h.saveCopy(t, ctx, "草稿", "内容", true) // published=true, version 1

	expectCode := func(r *common.RPCReply, e error, code string) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
		if r == nil || r.Error == nil || r.Error.Code != code {
			t.Fatalf("want %s, got %+v", code, r)
		}
	}
	baseline := h.snapshot(t, created.Id)
	assertUnchanged := func() {
		t.Helper()
		if got := h.snapshot(t, created.Id); got != baseline {
			t.Fatalf("publication mutated state: %+v -> %+v", baseline, got)
		}
	}

	// Missing published (nil pointer => IsSetPublished false) => BAD_REQUEST, zero write.
	r, e := h.publishInvoke(ctx, h.adminT, created.Id, nil, created.Version)
	expectCode(r, e, "BAD_REQUEST")
	assertUnchanged()
	// An explicit JSON null also collapses to a nil pointer and is rejected.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, nil, created.Version)
	expectCode(r, e, "BAD_REQUEST")
	assertUnchanged()

	// Missing / empty / malformed expectedVersion => INVALID_INPUT + refresh hint.
	for _, bad := range []string{"", "0", "01", "-1", " 1", "1.0", "abc", "18446744073709551616"} {
		r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(false), bad)
		expectCode(r, e, "INVALID_INPUT")
	}
	assertUnchanged()

	// Well-formed but stale => REVISION_CONFLICT.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(false), "999")
	expectCode(r, e, "REVISION_CONFLICT")
	assertUnchanged()

	// Ordinary user with a legal version => FORBIDDEN, no version echo/write.
	r, e = h.publishInvoke(ctx, h.userT, created.Id, vpBool(false), created.Version)
	expectCode(r, e, "FORBIDDEN")
	if r.Data != nil && r.Data.Resource != nil {
		t.Fatal("ordinary user learned the current version")
	}
	assertUnchanged()

	// Explicit published:false must be accepted (not mistaken for a missing field).
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(false), created.Version)
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("explicit published:false rejected", r.Error.Code, r.Error.Message)
	}
	unpublished := requireResource(t, r)
	if unpublished.Published || unpublished.Version != "2" {
		t.Fatalf("published:false not applied via the transaction snapshot: %+v", unpublished)
	}
	baseline = h.snapshot(t, created.Id)

	// publish:true with the new version advances again.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(true), "2")
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("republish rejected", r.Error.Code, r.Error.Message)
	}
	if v := requireResource(t, r).Version; v != "3" {
		t.Fatalf("republish version = %s, want 3", v)
	}
	baseline = h.snapshot(t, created.Id)

	// Same-state (already published) with the legal version: success, zero write.
	r, e = h.publishInvoke(ctx, h.adminT, created.Id, vpBool(true), "3")
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("same-state publish rejected", r.Error.Code, r.Error.Message)
	}
	if v := requireResource(t, r).Version; v != "3" {
		t.Fatalf("same-state version = %s, want 3", v)
	}
	assertUnchanged()
}
