package integration_test

import (
	"bytes"
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
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
	adapter := transport.AdminAdapter(accounts, c)
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
