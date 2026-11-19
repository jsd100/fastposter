package catalog

import (
	"context"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"os"
	"testing"
)

func TestManagementRequiresAdminBeforeAccessingData(t *testing.T) {
	s := NewService(nil, nil, nil)
	ctx := context.Background()
	p := auth.Principal{UserID: "ordinary", Role: "user"}
	calls := []func() error{func() error {
		_, e := s.Save(ctx, p, ResourceInput{Kind: "background", Title: "forged", AssetID: "private"})
		return e
	}, func() error { return s.Delete(ctx, p, "private") }, func() error { _, _, e := s.AdminProjects(ctx, p, Filter{}); return e }, func() error { _, _, e := s.Users(ctx, p, Filter{}); return e }, func() error { _, e := s.Overview(ctx, p); return e }, func() error { _, _, e := s.Jobs(ctx, p, Filter{}); return e }, func() error { _, _, e := s.Audit(ctx, p, Filter{}); return e }}
	for _, call := range calls {
		var known *domain.Error
		if e := call(); !errors.As(e, &known) || known.Code != "FORBIDDEN" {
			t.Fatal("management reached data without role check", e)
		}
	}
}

func TestTemplateGradientWriteBoundary(t *testing.T) {
	read := func(name string) document.Document {
		b, e := os.ReadFile("../../../tests/fixtures/documents/" + name + ".json")
		if e != nil {
			t.Fatal(e)
		}
		d, e := document.Parse(b)
		if e != nil {
			t.Fatal(e)
		}
		return d
	}
	code := func(e error) string {
		var known *domain.Error
		if !errors.As(e, &known) {
			t.Fatalf("not a domain error: %v", e)
		}
		return known.Code
	}

	v1Solid, v2Gradient := read("valid-mixed"), read("gradient-v2")
	if e := checkWrite(0, v1Solid); e != nil {
		t.Fatal("rejected v1 solid template", e)
	}
	if e := checkWrite(0, v2Gradient); e != nil {
		t.Fatal("rejected v2 gradient template with default configuration", e)
	}
	if e := checkWrite(1, v2Gradient); e != nil {
		t.Fatal("rejected v1 to v2 template upgrade", e)
	}
	if e := checkWrite(2, v1Solid); code(e) != "INVALID_INPUT" {
		t.Fatal("accepted a v2 to v1 template downgrade", e)
	}
}
