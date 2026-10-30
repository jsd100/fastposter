package catalog

import (
	"context"
	"database/sql"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/exports"
	"strconv"
)

func (s *Service) Jobs(ctx context.Context, p auth.Principal, f Filter) ([]exports.Job, int, error) {
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
		where += " AND user_id=?"
		args = append(args, f.UserID)
	}
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE "+where, args...).Scan(&total); e != nil {
		return nil, 0, e
	}
	args = append(args, size, (page-1)*size)
	rows, e := s.DB.QueryContext(ctx, "SELECT id,user_id,project_id,revision,state,error_code,created_at FROM export_jobs WHERE "+where+" ORDER BY created_at DESC,id LIMIT ? OFFSET ?", args...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []exports.Job{}
	for rows.Next() {
		var job exports.Job
		var revision uint64
		var code sql.NullString
		if e = rows.Scan(&job.ID, &job.UserID, &job.ProjectID, &revision, &job.State, &code, &job.CreatedAt); e != nil {
			return nil, 0, e
		}
		job.Revision = strconv.FormatUint(revision, 10)
		job.ErrorCode = code.String
		if job.State == "failed" {
			job.ErrorMessage = "导出失败（" + job.ErrorCode + "），详细内容仅作品所有者可查看"
		}
		out = append(out, job)
	}
	return out, total, rows.Err()
}
