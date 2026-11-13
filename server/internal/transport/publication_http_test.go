package transport

import (
	"context"
	"database/sql"
	"encoding/json"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/copy"
	"fastposter/server/internal/testutil"
	"github.com/cloudwego/hertz/pkg/app"
	"testing"
)

// publicationHTTPHarness wires a real MySQL-backed CatalogAdapter and a zero
// value Gateway, so a bound AdminPublishResource request can be driven through
// the exact chain the registered handler uses: bindInput -> CatalogAdapter ->
// write (errorStatus). Only synthetic seed data is used. It lives in the
// transport package because bindInput / write / errorStatus are unexported and
// only a same-package test can drive them directly (Ruling 243/255).
type publicationHTTPHarness struct {
	db      *sql.DB
	token   string
	id      string
	adapter func(context.Context, *common.CatalogCall) (*common.RPCReply, error)
	g       *Gateway
}

func newPublicationHTTPHarness(t *testing.T) *publicationHTTPHarness {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	ctx := context.Background()
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = accounts.CreateAdmin(ctx, "pub-http-admin", "correct horse battery"); e != nil {
		t.Fatal(e)
	}
	a, e := accounts.Login(ctx, "pub-http-admin", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	var adminID string
	if e = db.QueryRow("SELECT id FROM users WHERE username='pub-http-admin'").Scan(&adminID); e != nil {
		t.Fatal(e)
	}
	// One published copy at version 1 with no asset dependency: the adapter's
	// publicResource reply builder then needs no assets service.
	if _, e = db.Exec("INSERT INTO resources(id,kind,title,published,current_version,created_by) VALUES('pub-http-r','copy','HTTP 契约',1,1,?)", adminID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO resource_versions(resource_id,version,body,metadata) VALUES('pub-http-r',1,'内容','{}')"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, nil, nil)
	return &publicationHTTPHarness{
		db:      db,
		token:   a.Token,
		id:      "pub-http-r",
		adapter: CatalogAdapter(accounts, c, copy.NewService(db, c)),
		g:       &Gateway{},
	}
}

// drivePublication sends a real JSON body through bindInput (the same decode
// the HTTP handler performs), constructs the typed CatalogCall with the bound
// Publication, runs the adapter, and finally writes the reply with write(),
// returning the RequestContext (for status/body), the reply and the bound
// input. In production id is a path parameter; bindInput also accepts it from
// the query, which is what this RequestContext exposes.
func (h *publicationHTTPHarness) drivePublication(t *testing.T, body string) (*app.RequestContext, *common.RPCReply, *common.PublishResourceInput) {
	t.Helper()
	ctx := context.Background()
	r := app.NewContext(0)
	r.Request.SetRequestURI("/api/v1/admin/resources/" + h.id + "/publication?id=" + h.id)
	r.Request.SetBodyString(body)
	in, e := bindInput[common.PublishResourceInput](r)
	if e != nil {
		t.Fatalf("bindInput rejected %s: %v", body, e)
	}
	cc := &common.CallContext{RequestId: "b02-http", SessionToken: h.token}
	reply, e := h.adapter(ctx, &common.CatalogCall{Context: cc, Action: "AdminPublishResource", Publication: in})
	h.g.write(ctx, r, "AdminPublishResource", cc, reply, e)
	return r, reply, in
}

type pubHTTPState struct {
	versionRows int
	audits      int
	published   bool
	current     uint64
}

func (h *publicationHTTPHarness) state(t *testing.T) pubHTTPState {
	t.Helper()
	var s pubHTTPState
	if e := h.db.QueryRow("SELECT COUNT(*) FROM resource_versions WHERE resource_id=?", h.id).Scan(&s.versionRows); e != nil {
		t.Fatal(e)
	}
	if e := h.db.QueryRow("SELECT COUNT(*) FROM admin_audit_logs WHERE target_id=?", h.id).Scan(&s.audits); e != nil {
		t.Fatal(e)
	}
	if e := h.db.QueryRow("SELECT published,current_version FROM resources WHERE id=?", h.id).Scan(&s.published, &s.current); e != nil {
		t.Fatal(e)
	}
	return s
}

func errorCode(t *testing.T, r *app.RequestContext) string {
	t.Helper()
	var payload struct {
		Code string `json:"code"`
	}
	if e := json.Unmarshal(r.Response.Body(), &payload); e != nil {
		t.Fatalf("response is not JSON: %q (%v)", r.Response.Body(), e)
	}
	return payload.Code
}

// TestCatalogPublicationHTTPLayerRejectsMissingAndNullPublished exercises the
// real HTTP binding/writing layer for B02.1 :64 / Ruling 220 (Ruling 243):
//   - explicit published:false is accepted and reaches version validation;
//   - a body without published -> HTTP 400 with zero writes;
//   - a real JSON {"published": null} body -> HTTP 400 with zero writes.
//
// It is a regression guard: production code is already correct, so this test
// is GREEN on the baseline; it proves the BAD_REQUEST -> 400 branch is live
// end to end. The earlier adapter-level test constructed CatalogCall directly
// and never parsed a JSON null, so this file supplies the missing evidence.
func TestCatalogPublicationHTTPLayerRejectsMissingAndNullPublished(t *testing.T) {
	h := newPublicationHTTPHarness(t)
	baseline := h.state(t)
	if baseline.versionRows != 1 || baseline.audits != 0 || !baseline.published || baseline.current != 1 {
		t.Fatalf("unexpected seed state: %+v", baseline)
	}

	// (2) Missing published: bindInput leaves the *bool nil, the adapter
	// returns BAD_REQUEST before any write, and write maps it to HTTP 400.
	r, reply, in := h.drivePublication(t, `{"expectedVersion":"1"}`)
	if in == nil || in.IsSetPublished() || in.Published != nil {
		t.Fatalf("missing published did not bind to a nil *bool: %+v", in)
	}
	if r.Response.StatusCode() != 400 {
		t.Fatalf("missing published: HTTP status = %d, want 400", r.Response.StatusCode())
	}
	if reply == nil || reply.Error == nil || reply.Error.Code != "BAD_REQUEST" {
		t.Fatalf("missing published: reply = %+v", reply)
	}
	if got := errorCode(t, r); got != "BAD_REQUEST" {
		t.Fatalf("missing published: response body code = %q, want BAD_REQUEST", got)
	}
	if got := h.state(t); got != baseline {
		t.Fatalf("missing published wrote state: %+v -> %+v", baseline, got)
	}

	// (3) A real JSON null for published: json.Decode sets the *bool to nil
	// exactly like a missing field. The old adapter-level test only called the
	// same nil twice and claimed this in a comment; here the JSON is parsed.
	r, reply, in = h.drivePublication(t, `{"published":null,"expectedVersion":"1"}`)
	if in == nil || in.IsSetPublished() || in.Published != nil {
		t.Fatalf("JSON null published did not bind to a nil *bool: %+v", in)
	}
	if r.Response.StatusCode() != 400 {
		t.Fatalf("JSON null published: HTTP status = %d, want 400", r.Response.StatusCode())
	}
	if reply == nil || reply.Error == nil || reply.Error.Code != "BAD_REQUEST" {
		t.Fatalf("JSON null published: reply = %+v", reply)
	}
	if got := errorCode(t, r); got != "BAD_REQUEST" {
		t.Fatalf("JSON null published: response body code = %q, want BAD_REQUEST", got)
	}
	if got := h.state(t); got != baseline {
		t.Fatalf("JSON null published wrote state: %+v -> %+v", baseline, got)
	}

	// (1a) Explicit published:false is NOT treated as a missing field: an empty
	// expectedVersion then reaches parseExpectedVersion, so the HTTP status is
	// 422 INVALID_INPUT rather than 400 BAD_REQUEST. Zero writes on this path.
	r, reply, in = h.drivePublication(t, `{"published":false,"expectedVersion":""}`)
	if in == nil || !in.IsSetPublished() || in.Published == nil || *in.Published {
		t.Fatalf("explicit published:false did not bind to a non-nil false: %+v", in)
	}
	if r.Response.StatusCode() != 422 {
		t.Fatalf("published:false with empty version: HTTP status = %d, want 422 (version validation reached)", r.Response.StatusCode())
	}
	if reply == nil || reply.Error == nil || reply.Error.Code != "INVALID_INPUT" {
		t.Fatalf("published:false with empty version: reply = %+v", reply)
	}
	if got := h.state(t); got != baseline {
		t.Fatalf("published:false with empty version wrote state: %+v -> %+v", baseline, got)
	}

	// (1b) Explicit published:false with the legal version succeeds over HTTP
	// 200, flips published to false and advances the version to 2.
	r, reply, in = h.drivePublication(t, `{"published":false,"expectedVersion":"1"}`)
	if in == nil || !in.IsSetPublished() || in.Published == nil || *in.Published {
		t.Fatalf("explicit published:false did not bind to a non-nil false: %+v", in)
	}
	if r.Response.StatusCode() != 200 {
		t.Fatalf("published:false: HTTP status = %d, want 200", r.Response.StatusCode())
	}
	if reply == nil || reply.Error != nil {
		t.Fatalf("published:false rejected: %+v", reply)
	}
	res := reply.Data.Resource
	if res == nil || res.Published || res.Version != "2" {
		t.Fatalf("published:false not applied through the transaction snapshot: %+v", res)
	}
	got := h.state(t)
	if got.versionRows != baseline.versionRows+1 || got.audits != 1 || got.published || got.current != 2 {
		t.Fatalf("published:false did not write exactly one new version + audit: %+v -> %+v", baseline, got)
	}
}
