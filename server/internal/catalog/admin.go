package catalog

import (
	"context"
	"database/sql"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"strconv"
	"time"
)

type ProjectMetadata struct {
	ID        string  `json:"id"`
	OwnerID   string  `json:"ownerId"`
	Title     string  `json:"title"`
	Revision  string  `json:"revision"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	UpdatedAt string  `json:"updatedAt"`
	DeletedAt *string `json:"deletedAt,omitempty"`
}

func (s *Service) AdminProjects(ctx context.Context, p auth.Principal, f Filter) ([]ProjectMetadata, int, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return nil, 0, e
	}
	page, size, e := pagination(f)
	if e != nil {
		return nil, 0, e
	}
	where := "1=1"
	args := []any{}
	if f.UserID != "" {
		where += " AND owner_id=?"
		args = append(args, f.UserID)
	}
	if f.Keyword != "" {
		where += " AND title LIKE ?"
		args = append(args, "%"+f.Keyword+"%")
	}
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM projects WHERE "+where, args...).Scan(&total); e != nil {
		return nil, 0, e
	}
	args = append(args, size, (page-1)*size)
	rows, e := s.DB.QueryContext(ctx, "SELECT id,owner_id,title,revision,width,height,updated_at,deleted_at FROM projects WHERE "+where+" ORDER BY updated_at DESC,id LIMIT ? OFFSET ?", args...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := []ProjectMetadata{}
	for rows.Next() {
		var row ProjectMetadata
		var revision uint64
		var updated time.Time
		var deleted sql.NullTime
		if e = rows.Scan(&row.ID, &row.OwnerID, &row.Title, &revision, &row.Width, &row.Height, &updated, &deleted); e != nil {
			return nil, 0, e
		}
		row.Revision = strconv.FormatUint(revision, 10)
		row.UpdatedAt = updated.UTC().Format(time.RFC3339Nano)
		if deleted.Valid {
			date := deleted.Time.UTC().Format(time.RFC3339Nano)
			row.DeletedAt = &date
		}
		items = append(items, row)
	}
	return items, total, rows.Err()
}
func (s *Service) Users(ctx context.Context, p auth.Principal, f Filter) ([]auth.User, int, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return nil, 0, e
	}
	page, size, e := pagination(f)
	if e != nil {
		return nil, 0, e
	}
	where := "id<>'system'"
	args := []any{}
	if f.Keyword != "" {
		where += " AND username LIKE ?"
		args = append(args, "%"+f.Keyword+"%")
	}
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE "+where, args...).Scan(&total); e != nil {
		return nil, 0, e
	}
	args = append(args, size, (page-1)*size)
	rows, e := s.DB.QueryContext(ctx, "SELECT id,username,role,disabled,must_change_password,created_at FROM users WHERE "+where+" ORDER BY created_at DESC,id LIMIT ? OFFSET ?", args...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []auth.User{}
	for rows.Next() {
		var u auth.User
		if e = rows.Scan(&u.ID, &u.Username, &u.Role, &u.Disabled, &u.MustChangePassword, &u.CreatedAt); e != nil {
			return nil, 0, e
		}
		out = append(out, u)
	}
	return out, total, rows.Err()
}

type Overview struct {
	Users, Projects, SuccessfulExports, FailedExports int
	StorageBytes                                      int64
}

func (s *Service) Overview(ctx context.Context, p auth.Principal) (Overview, error) {
	var o Overview
	if e := auth.RequireAdmin(p); e != nil {
		return o, e
	}
	for _, query := range []struct {
		sql   string
		value *int
	}{{"SELECT COUNT(*) FROM users WHERE id<>'system'", &o.Users}, {"SELECT COUNT(*) FROM projects", &o.Projects}, {"SELECT COUNT(*) FROM export_jobs WHERE state='succeeded'", &o.SuccessfulExports}, {"SELECT COUNT(*) FROM export_jobs WHERE state='failed'", &o.FailedExports}} {
		if e := s.DB.QueryRowContext(ctx, query.sql).Scan(query.value); e != nil {
			return o, e
		}
	}
	usage, e := storage.Usage(ctx, s.Store)
	o.StorageBytes = usage
	return o, e
}

type Audit struct{ ID, ActorID, Action, TargetID, CreatedAt string }

func (s *Service) Audit(ctx context.Context, p auth.Principal, f Filter) ([]Audit, int, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return nil, 0, e
	}
	page, size, e := pagination(f)
	if e != nil {
		return nil, 0, e
	}
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM admin_audit_logs").Scan(&total); e != nil {
		return nil, 0, e
	}
	rows, e := s.DB.QueryContext(ctx, "SELECT id,actor_id,action,target_id,created_at FROM admin_audit_logs ORDER BY created_at DESC,id LIMIT ? OFFSET ?", size, (page-1)*size)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []Audit{}
	for rows.Next() {
		var a Audit
		var at time.Time
		if e = rows.Scan(&a.ID, &a.ActorID, &a.Action, &a.TargetID, &at); e != nil {
			return nil, 0, e
		}
		a.CreatedAt = at.UTC().Format(time.RFC3339Nano)
		out = append(out, a)
	}
	return out, total, rows.Err()
}
