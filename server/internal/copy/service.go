package copy

import (
	"context"
	"database/sql"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/domain"
	"strings"
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

func (s *Service) Publish(ctx context.Context, p auth.Principal, id string) error {
	return s.setPublished(ctx, p, id, true)
}

func (s *Service) Unpublish(ctx context.Context, p auth.Principal, id string) error {
	return s.setPublished(ctx, p, id, false)
}

func (s *Service) setPublished(ctx context.Context, p auth.Principal, id string, published bool) error {
	if e := auth.RequireAdmin(p); e != nil {
		return e
	}
	r, e := s.Catalog.Get(ctx, p, id, true)
	if e != nil {
		return e
	}
	if r.Kind != "copy" && r.Kind != "copy-category" {
		return domain.E("INVALID_INPUT", "不是文案或文案分类")
	}
	_, e = s.Catalog.Save(ctx, p, catalog.ResourceInput{ID: r.ID, Kind: r.Kind, Title: r.Title, CategoryID: r.CategoryID, ParentID: r.ParentID, SortOrder: r.SortOrder, Published: published, Body: r.Body})
	return e
}

// MoveCategory re-parents a category only after proving the moved subtree
// stays within five levels and cannot become its own ancestor.
func (s *Service) MoveCategory(ctx context.Context, p auth.Principal, id, parentID string) error {
	if e := auth.RequireAdmin(p); e != nil {
		return e
	}
	id, parentID = strings.TrimSpace(id), strings.TrimSpace(parentID)
	if id == "" || id == parentID {
		return domain.E("INVALID_INPUT", "请选择有效的新上级分类")
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var kind string
	e = tx.QueryRowContext(ctx, "SELECT kind FROM resources WHERE id=? AND deleted_at IS NULL FOR UPDATE", id).Scan(&kind)
	if e == sql.ErrNoRows {
		return domain.E("NOT_FOUND", "分类不存在")
	}
	if e != nil {
		return e
	}
	if kind != "copy-category" {
		return domain.E("INVALID_INPUT", "只能移动文案分类")
	}
	parents, e := catalog.LoadCategoryParents(ctx, tx, "copy-category")
	if e != nil {
		return e
	}
	parentDepth := 0
	if parentID != "" {
		if _, ok := parents[parentID]; !ok {
			return domain.E("NOT_FOUND", "目标分类不存在")
		}
		walk := parentID
		seen := map[string]bool{}
		for walk != "" {
			if walk == id {
				return domain.E("INVALID_INPUT", "分类不能移动到自身或子分类")
			}
			if seen[walk] {
				return domain.E("INVALID_INPUT", "分类树存在循环，请先修复分类")
			}
			seen[walk] = true
			parentDepth++
			if parentDepth > 5 {
				return domain.E("INVALID_INPUT", "分类最多 5 层")
			}
			walk = parents[walk]
		}
	}
	height, e := parents.SubtreeHeight(id)
	if e != nil {
		return e
	}
	if parentDepth+1+height-1 > 5 {
		return domain.E("INVALID_INPUT", "分类最多 5 层")
	}
	if _, e = tx.ExecContext(ctx, "UPDATE resources SET parent_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?", nullString(parentID), id); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,'copy.category.move',?,'success')", domain.ID(), p.UserID, id); e != nil {
		return e
	}
	return tx.Commit()
}

func nullString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
