package projectdeletions

import (
	"context"
	"database/sql"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"unicode/utf8"
)

func pagination(q Query) (int, int, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 24
	}
	if q.PageSize > 100 {
		q.PageSize = 100
	}
	if q.Page > 100000 || utf8.RuneCountInString(q.Keyword) > 120 {
		return 0, 0, domain.E("INVALID_INPUT", "查询参数无效")
	}
	return q.Page, q.PageSize, nil
}

func (s *Service) List(ctx context.Context, actor auth.Principal, scope Scope, q Query) ([]Task, int, error) {
	if e := authorizeScope(actor, scope); e != nil {
		return nil, 0, e
	}
	page, size, e := pagination(q)
	if e != nil {
		return nil, 0, e
	}
	where := "state<>'completed'"
	args := []any{}
	if scope == OwnerScope {
		where += " AND owner_id=?"
		args = append(args, actor.UserID)
	} else if q.OwnerID != "" {
		where += " AND owner_id=?"
		args = append(args, q.OwnerID)
	}
	if q.Keyword != "" {
		where += " AND title LIKE ?"
		args = append(args, "%"+q.Keyword+"%")
	}
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM project_deletions WHERE "+where, args...).Scan(&total); e != nil {
		return nil, 0, e
	}
	args = append(args, size, (page-1)*size)
	rows, e := s.DB.QueryContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE "+where+" ORDER BY created_at,id LIMIT ? OFFSET ?", args...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	items := []Task{}
	for rows.Next() {
		task, e := scanTask(rows)
		if e != nil {
			return nil, 0, e
		}
		items = append(items, task)
	}
	return items, total, rows.Err()
}

func (s *Service) Get(ctx context.Context, actor auth.Principal, scope Scope, taskID string) (Task, error) {
	if e := authorizeScope(actor, scope); e != nil {
		return Task{}, e
	}
	task, e := scanTask(s.DB.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE id=?", taskID))
	if e != nil {
		return Task{}, e
	}
	if e = s.authorizeTask(actor, scope, task); e != nil {
		return Task{}, e
	}
	return task, nil
}

func (s *Service) Retry(ctx context.Context, actor auth.Principal, scope Scope, taskID string) (Task, error) {
	if e := authorizeScope(actor, scope); e != nil {
		return Task{}, e
	}
	tx, e := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return Task{}, e
	}
	defer tx.Rollback()
	task, e := scanTask(tx.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE id=? FOR UPDATE", taskID))
	if e != nil {
		return Task{}, e
	}
	if e = s.authorizeTask(actor, scope, task); e != nil {
		return Task{}, e
	}
	if task.State == "completed" {
		if e = tx.Commit(); e != nil {
			return Task{}, e
		}
		return task, nil
	}
	var state string
	var lease sql.NullTime
	if e = tx.QueryRowContext(ctx, "SELECT state,lease_until FROM project_deletions WHERE id=?", taskID).Scan(&state, &lease); e != nil {
		return Task{}, e
	}
	if state == "running" && lease.Valid && lease.Time.After(s.now()) {
		return Task{}, domain.E("CONFLICT", "清理任务正在执行，请稍后重试")
	}
	if _, e = tx.ExecContext(ctx, "UPDATE project_deletions SET next_attempt_at=? WHERE id=?", s.now(), taskID); e != nil {
		return Task{}, e
	}
	if scope == AdminScope {
		if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,'project.cleanup-retry',?,'success')", domain.ID(), actor.UserID, taskID); e != nil {
			return Task{}, e
		}
	}
	task, e = scanTask(tx.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE id=?", taskID))
	if e != nil {
		return Task{}, e
	}
	if e = tx.Commit(); e != nil {
		return Task{}, e
	}
	return task, nil
}
