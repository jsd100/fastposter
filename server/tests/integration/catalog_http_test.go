package integration_test

import (
	"bytes"
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/transport"
	"testing"
)

func TestCatalogTransportRejectsUserAndMetadataExcludesDocument(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	accounts, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	admin, e := accounts.CreateAdmin(ctx, "meta-admin", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	user, e := accounts.Register(ctx, "meta-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	a, e := accounts.Login(ctx, "meta-admin", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	u, e := accounts.Login(ctx, "meta-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = p.Create(ctx, projectOwner(), "metadata", doc); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	adapter := transport.AdminAdapter(accounts, c, projectdeletions.NewService(db, p.Store))
	for _, action := range []string{"AdminOverview", "AdminUsers", "AdminProjects", "AdminJobs", "AdminAudit"} {
		reply, e := adapter(ctx, &common.AdminCall{Context: &common.CallContext{RequestId: "test", SessionToken: u.Token}, Action: action})
		if e != nil || reply.Error == nil || reply.Error.Code != "FORBIDDEN" {
			t.Fatal("user forged admin call", action, e)
		}
	}
	reply, e := adapter(ctx, &common.AdminCall{Context: &common.CallContext{RequestId: "test", SessionToken: a.Token}, Action: "AdminProjects"})
	if e != nil || reply.Error != nil {
		t.Fatal(e)
	}
	raw := mustJSON(reply.Data)
	if bytes.Contains(raw, []byte("document")) || bytes.Contains(raw, []byte("textBlocks")) || bytes.Contains(raw, []byte("风景")) {
		t.Fatal("private document leaked")
	}
	if len(reply.Data.MetadataProjects) != 1 || reply.Data.Projects != nil {
		t.Fatal("metadata DTO not used")
	}
	_ = admin
	_ = user
}

func TestCatalogHTTPRejectsUnversionedAndNonAdminMutation(t *testing.T) {
	h := newVersionHarness(t)
	ctx := context.Background()
	res := h.saveCopy(t, ctx, "草稿", "内容", true)

	expectCode := func(r *common.RPCReply, e error, code string) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
		if r == nil || r.Error == nil || r.Error.Code != code {
			t.Fatalf("want %s, got %+v", code, r)
		}
	}

	// An old payload (no expectedVersion) on an existing resource is rejected.
	r, e := h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy", Title: "旧页面保存", Id: vpStr(res.Id), Body: vpStr("内容"), Published: vpBool(true),
	}, nil, "")
	expectCode(r, e, "INVALID_INPUT")

	// Malformed versions are INVALID_INPUT; a well-formed but stale one conflicts.
	for _, bad := range []string{"", "0", "01", "-1", " 1", "1.0", "abc", "18446744073709551616"} {
		r, e = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
			Kind: "copy", Title: "非法版本", Id: vpStr(res.Id), Body: vpStr("内容"), ExpectedVersion: vpStr(bad),
		}, nil, "")
		expectCode(r, e, "INVALID_INPUT")
	}
	r, e = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy", Title: "过期版本", Id: vpStr(res.Id), Body: vpStr("内容"), ExpectedVersion: vpStr("999"),
	}, nil, "")
	expectCode(r, e, "REVISION_CONFLICT")

	// Ordinary accounts are rejected first and never learn the current version.
	r, e = h.invoke(ctx, h.userT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy", Title: "越权", Id: vpStr(res.Id), Body: vpStr("内容"), ExpectedVersion: vpStr("1"),
	}, nil, "")
	expectCode(r, e, "FORBIDDEN")

	// A matching version updates to the newest snapshot; the admin detail GET
	// then reloads by ID and must reflect it, not any stale list/title.
	r, e = h.invoke(ctx, h.adminT, "AdminSaveResource", &common.ResourceInput{
		Kind: "copy", Title: "最新标题", Id: vpStr(res.Id), Body: vpStr("最新内容"),
		Published: vpBool(true), ExpectedVersion: vpStr("1"),
	}, nil, "")
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("setup update failed", r.Error.Code, r.Error.Message)
	}
	r, e = h.invoke(ctx, h.adminT, "AdminGetResource", nil, nil, res.Id)
	if e != nil {
		t.Fatal(e)
	}
	if r.Error != nil {
		t.Fatal("detail GET failed", r.Error.Code, r.Error.Message)
	}
	if r.Data == nil || r.Data.Resource == nil {
		t.Fatal("detail reply has no resource")
	}
	if r.Data.Resource.Version != "2" || r.Data.Resource.Title != "最新标题" {
		t.Fatalf("detail must read the latest resource by id: %+v", r.Data.Resource)
	}
}
