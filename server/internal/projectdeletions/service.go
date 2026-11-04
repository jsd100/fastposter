package projectdeletions

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"github.com/go-sql-driver/mysql"
	"time"
)

type Scope string

const (
	OwnerScope Scope = "owner"
	AdminScope Scope = "admin"
)

type Task struct {
	ID, ProjectID, OwnerID, ActorID, Title, State, ErrorCode string
	Width, Height                                            int
	CreatedAt                                                time.Time
	DeletedAt, CompletedAt                                   *time.Time
}

type Query struct {
	Page, PageSize   int
	Keyword, OwnerID string
}

type Service struct {
	DB    *sql.DB
	Store storage.FileStore
	now   func() time.Time
}

func NewService(db *sql.DB, store storage.FileStore) *Service {
	return &Service{DB: db, Store: store, now: func() time.Time { return time.Now().UTC() }}
}

const taskColumns = "id,project_id,owner_id,actor_id,COALESCE(title,''),width,height,state,COALESCE(safe_error_code,''),created_at,deleted_at,completed_at"

func scanTask(row interface{ Scan(...any) error }) (Task, error) {
	var task Task
	var width, height sql.NullInt64
	var deleted, completed sql.NullTime
	e := row.Scan(&task.ID, &task.ProjectID, &task.OwnerID, &task.ActorID, &task.Title, &width, &height, &task.State, &task.ErrorCode, &task.CreatedAt, &deleted, &completed)
	if errors.Is(e, sql.ErrNoRows) {
		return task, domain.E("NOT_FOUND", "删除任务不存在或无权访问")
	}
	if e != nil {
		return task, e
	}
	task.Width, task.Height = int(width.Int64), int(height.Int64)
	if deleted.Valid {
		value := deleted.Time
		task.DeletedAt = &value
	}
	if completed.Valid {
		value := completed.Time
		task.CompletedAt = &value
	}
	return task, nil
}

func authorizeScope(actor auth.Principal, scope Scope) error {
	switch scope {
	case OwnerScope:
		return auth.RequireUsable(actor)
	case AdminScope:
		return auth.RequireAdmin(actor)
	default:
		return domain.E("INVALID_INPUT", "删除范围无效")
	}
}

func (s *Service) authorizeTask(actor auth.Principal, scope Scope, task Task) error {
	if scope == OwnerScope && task.OwnerID != actor.UserID {
		return domain.E("NOT_FOUND", "删除任务不存在或无权访问")
	}
	return nil
}

func (s *Service) findTaskByProject(ctx context.Context, actor auth.Principal, scope Scope, projectID string) (Task, bool, error) {
	task, e := scanTask(s.DB.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE project_id=?", projectID))
	var known *domain.Error
	if errors.As(e, &known) && known.Code == "NOT_FOUND" {
		return Task{}, false, nil
	}
	if e != nil {
		return Task{}, false, e
	}
	if e = s.authorizeTask(actor, scope, task); e != nil {
		return Task{}, false, e
	}
	return task, true, nil
}

func (s *Service) taskOrMissing(ctx context.Context, actor auth.Principal, scope Scope, projectID string) (Task, error) {
	if task, ok, e := s.findTaskByProject(ctx, actor, scope, projectID); e != nil {
		return Task{}, e
	} else if ok {
		return task, nil
	}
	return Task{}, domain.E("NOT_FOUND", "作品不存在或无权访问")
}

func (s *Service) lockTaskByProject(ctx context.Context, tx *sql.Tx, actor auth.Principal, scope Scope, projectID string) (Task, bool, error) {
	task, e := scanTask(tx.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE project_id=? FOR UPDATE", projectID))
	var known *domain.Error
	if errors.As(e, &known) && known.Code == "NOT_FOUND" {
		return Task{}, false, nil
	}
	if e != nil {
		return Task{}, false, e
	}
	if e = s.authorizeTask(actor, scope, task); e != nil {
		return Task{}, false, e
	}
	return task, true, nil
}

func retryableAccept(e error) bool {
	var mysqlError *mysql.MySQLError
	if !errors.As(e, &mysqlError) {
		return false
	}
	return mysqlError.Number == 1062 || mysqlError.Number == 1205 || mysqlError.Number == 1213
}

func (s *Service) Accept(ctx context.Context, actor auth.Principal, scope Scope, projectID string) (Task, error) {
	if e := authorizeScope(actor, scope); e != nil {
		return Task{}, e
	}
	if projectID == "" || len(projectID) > 64 {
		return Task{}, domain.E("NOT_FOUND", "作品不存在或无权访问")
	}
	if task, ok, e := s.findTaskByProject(ctx, actor, scope, projectID); e != nil {
		return Task{}, e
	} else if ok {
		return task, nil
	}
	for attempt := 0; attempt < 3; attempt++ {
		task, e := s.acceptOnce(ctx, actor, scope, projectID)
		if e == nil {
			return task, nil
		}
		if !retryableAccept(e) {
			return Task{}, e
		}
		if task, ok, readErr := s.findTaskByProject(ctx, actor, scope, projectID); readErr != nil {
			return Task{}, readErr
		} else if ok {
			return task, nil
		}
	}
	return Task{}, domain.E("CONFLICT", "删除任务正在创建，请稍后重试")
}

// acceptOnce removes the trashed project and captures every file candidate in
// one transaction. The user row is locked first so export creation, claiming
// and permanent deletion all serialize on the same owner.
func (s *Service) acceptOnce(ctx context.Context, actor auth.Principal, scope Scope, projectID string) (Task, error) {
	tx, e := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return Task{}, e
	}
	defer tx.Rollback()
	var owner string
	e = tx.QueryRowContext(ctx, "SELECT owner_id FROM projects WHERE id=?", projectID).Scan(&owner)
	if errors.Is(e, sql.ErrNoRows) {
		return s.taskOrMissing(ctx, actor, scope, projectID)
	}
	if e != nil {
		return Task{}, e
	}
	var locked string
	if e = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id=? FOR UPDATE", owner).Scan(&locked); e != nil {
		return Task{}, e
	}
	var currentOwner, title string
	var width, height int
	var deleted sql.NullTime
	e = tx.QueryRowContext(ctx, "SELECT owner_id,title,width,height,deleted_at FROM projects WHERE id=? FOR UPDATE", projectID).Scan(&currentOwner, &title, &width, &height, &deleted)
	if errors.Is(e, sql.ErrNoRows) {
		return s.taskOrMissing(ctx, actor, scope, projectID)
	}
	if e != nil {
		return Task{}, e
	}
	if scope == OwnerScope && currentOwner != actor.UserID {
		return Task{}, domain.E("NOT_FOUND", "作品不存在或无权访问")
	}
	if !deleted.Valid {
		return Task{}, domain.E("CONFLICT", "只有回收站中的作品可以彻底删除")
	}
	if task, ok, e := s.lockTaskByProject(ctx, tx, actor, scope, projectID); e != nil {
		return Task{}, e
	} else if ok {
		return task, nil
	}
	var activeExport string
	e = tx.QueryRowContext(ctx, "SELECT id FROM export_jobs WHERE project_id=? AND state IN ('queued','running') ORDER BY id LIMIT 1 FOR UPDATE", projectID).Scan(&activeExport)
	if e == nil {
		return Task{}, domain.E("CONFLICT", "该作品有导出任务尚未结束，请等待完成后再删除")
	}
	if !errors.Is(e, sql.ErrNoRows) {
		return Task{}, e
	}
	taskID := domain.ID()
	var deletedAt any
	if deleted.Valid {
		deletedAt = deleted.Time
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO project_deletions(id,project_id,owner_id,actor_id,title,width,height,deleted_at,state,next_attempt_at) VALUES(?,?,?,?,?,?,?,?,'pending',UTC_TIMESTAMP(6))", taskID, projectID, currentOwner, actor.UserID, title, width, height, deletedAt); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, `INSERT INTO project_deletion_assets(task_id,asset_id,asset_version,original_key,normalized_key,preview_key,state)
		SELECT ?,ref.asset_id,ref.asset_version,v.original_key,v.normalized_key,v.preview_key,'pending'
		FROM (SELECT DISTINCT asset_id,asset_version FROM asset_refs
			WHERE (owner_kind IN ('project','project-history') AND owner_id=?)
			   OR (owner_kind='export' AND owner_id IN (SELECT id FROM export_jobs WHERE project_id=?))) ref
		JOIN asset_versions v ON v.asset_id=ref.asset_id AND v.version=ref.asset_version`, taskID, projectID, projectID); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, `INSERT IGNORE INTO project_deletion_files(task_id,file_key,state,source)
		SELECT ?,work.file_key,'pending',work.source FROM (
			SELECT original_key AS file_key,'asset-original' AS source FROM project_deletion_assets WHERE task_id=? AND original_key<>''
			UNION ALL SELECT normalized_key,'asset-normalized' FROM project_deletion_assets WHERE task_id=? AND normalized_key<>''
			UNION ALL SELECT preview_key,'asset-preview' FROM project_deletion_assets WHERE task_id=? AND preview_key<>''
			UNION ALL SELECT result_key,'export-result' FROM export_jobs WHERE project_id=? AND result_key IS NOT NULL AND result_key<>''
			UNION ALL SELECT preview_key,'export-preview' FROM export_jobs WHERE project_id=? AND preview_key IS NOT NULL AND preview_key<>''
		) work`, taskID, taskID, taskID, taskID, projectID, projectID); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind='export' AND owner_id IN (SELECT id FROM export_jobs WHERE project_id=?)", projectID); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM export_jobs WHERE project_id=?", projectID); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind IN ('project','project-history') AND owner_id=?", projectID); e != nil {
		return Task{}, e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM projects WHERE id=?", projectID); e != nil {
		return Task{}, e
	}
	if scope == AdminScope {
		if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,'project.permanent-delete',?,'success')", domain.ID(), actor.UserID, projectID); e != nil {
			return Task{}, e
		}
	}
	task, e := scanTask(tx.QueryRowContext(ctx, "SELECT "+taskColumns+" FROM project_deletions WHERE id=?", taskID))
	if e != nil {
		return Task{}, e
	}
	if e = tx.Commit(); e != nil {
		return Task{}, e
	}
	return task, nil
}
