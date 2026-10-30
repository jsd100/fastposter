package catalog

import (
	"context"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
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
