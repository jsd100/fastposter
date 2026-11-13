package copy

import (
	"context"
	"database/sql"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/domain"
)

type Service struct {
	DB      *sql.DB
	Catalog *catalog.Service
}

func NewService(db *sql.DB, c *catalog.Service) *Service {
	return &Service{DB: db, Catalog: c}
}

func (s *Service) ListCategories(ctx context.Context, p auth.Principal, admin bool) ([]catalog.Resource, error) {
	out := []catalog.Resource{}
	for page := 1; ; page++ {
		rows, total, e := s.Catalog.List(ctx, p, "copy-category", catalog.Filter{Page: page, PageSize: 100}, admin)
		if e != nil {
			return nil, e
		}
		out = append(out, rows...)
		if len(out) >= total || len(rows) == 0 {
			return out, nil
		}
		if page >= 1000 {
			return nil, domain.E("INVALID_INPUT", "分类数量过多")
		}
	}
}

func (s *Service) ListChildren(ctx context.Context, p auth.Principal, parentID string, admin bool) ([]catalog.Resource, error) {
	rows, _, e := s.Catalog.List(ctx, p, "copy-category", catalog.Filter{Page: 1, PageSize: 100, ParentID: parentID}, admin)
	return rows, e
}

func (s *Service) ListEntries(ctx context.Context, p auth.Principal, categoryID, keyword string, page, pageSize int, admin bool) ([]catalog.Resource, int, error) {
	return s.Catalog.List(ctx, p, "copy", catalog.Filter{Page: page, PageSize: pageSize, CategoryID: categoryID, Keyword: keyword}, admin)
}

func (s *Service) SaveCategory(ctx context.Context, p auth.Principal, input catalog.ResourceInput) (catalog.Resource, error) {
	input.Kind = "copy-category"
	return s.Catalog.Save(ctx, p, input)
}

func (s *Service) SaveCopy(ctx context.Context, p auth.Principal, input catalog.ResourceInput) (catalog.Resource, error) {
	input.Kind = "copy"
	return s.Catalog.Save(ctx, p, input)
}

func (s *Service) Publish(ctx context.Context, p auth.Principal, id string, expectedVersion string) error {
	return s.setPublished(ctx, p, id, true, expectedVersion)
}

func (s *Service) Unpublish(ctx context.Context, p auth.Principal, id string, expectedVersion string) error {
	return s.setPublished(ctx, p, id, false, expectedVersion)
}

func (s *Service) setPublished(ctx context.Context, p auth.Principal, id string, published bool, expectedVersion string) error {
	if e := auth.RequireAdmin(p); e != nil {
		return e
	}
	// Get is used only for the immutable kind guard; the version prerequisite
	// comes from the caller, never from r.Version (no pre-transaction version
	// read, no post-commit re-read).
	r, e := s.Catalog.Get(ctx, p, id, true)
	if e != nil {
		return e
	}
	if r.Kind != "copy" && r.Kind != "copy-category" {
		return domain.E("INVALID_INPUT", "不是文案或文案分类")
	}
	_, e = s.Catalog.SetPublished(ctx, p, id, published, expectedVersion)
	return e
}

// MoveCategory delegates to the catalog service so classification edits and
// standalone moves share the same tree validation, lock order and version
// contract.
func (s *Service) MoveCategory(ctx context.Context, p auth.Principal, id, parentID, expectedVersion string) error {
	return s.Catalog.MoveCategory(ctx, p, id, parentID, expectedVersion)
}
