package exports

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"strconv"
	"time"
)

type Job struct {
	ID, UserID, ProjectID, Revision, State, ContentHash, RendererVersion, ErrorCode, ErrorMessage string
	Snapshot                                                                                      []byte
	Attempts                                                                                      int
	ResultKey, PreviewKey                                                                         storage.Key
	ResultSize                                                                                    int64
	CreatedAt, UpdatedAt                                                                          time.Time
	ExpiresAt                                                                                     *time.Time
}
type Lease struct {
	Job   Job
	Token string
	Until time.Time
}
type Service struct {
	DB       *sql.DB
	Store    storage.FileStore
	Projects *projects.Service
}

func NewService(db *sql.DB, store storage.FileStore, projects *projects.Service) *Service {
	return &Service{DB: db, Store: store, Projects: projects}
}
func exportMissing() error {
	return domain.E("NOT_FOUND", "导出任务不存在、已过期或无权访问")
}

const jobColumns = "id,user_id,project_id,revision,state,attempts,renderer_version,content_hash,error_code,error_message,result_key,preview_key,result_size,created_at,updated_at,expires_at"

func scanJob(row interface{ Scan(...any) error }, snapshot bool) (Job, error) {
	var j Job
	var rev uint64
	var code, message, result, preview sql.NullString
	var expires sql.NullTime
	values := []any{&j.ID, &j.UserID, &j.ProjectID, &rev, &j.State, &j.Attempts, &j.RendererVersion, &j.ContentHash, &code, &message, &result, &preview, &j.ResultSize, &j.CreatedAt, &j.UpdatedAt, &expires}
	if snapshot {
		values = append(values, &j.Snapshot)
	}
	e := row.Scan(values...)
	if errors.Is(e, sql.ErrNoRows) {
		return j, exportMissing()
	}
	j.Revision = strconv.FormatUint(rev, 10)
	j.ErrorCode = code.String
	j.ErrorMessage = message.String
	j.ResultKey = storage.Key(result.String)
	j.PreviewKey = storage.Key(preview.String)
	if expires.Valid {
		j.ExpiresAt = &expires.Time
	}
	return j, e
}
func (s *Service) Get(ctx context.Context, p auth.Principal, id string) (Job, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Job{}, e
	}
	return scanJob(s.DB.QueryRowContext(ctx, "SELECT "+jobColumns+" FROM export_jobs WHERE id=? AND user_id=? AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP(6))", id, p.UserID), false)
}
func (s *Service) Create(ctx context.Context, p auth.Principal, projectID, revision, idempotency string) (Job, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Job{}, e
	}
	if len(idempotency) < 1 || len(idempotency) > 128 {
		return Job{}, domain.E("INVALID_INPUT", "导出请求标识无效")
	}
	snapshot, e := s.Projects.ResolveSnapshot(ctx, p, projectID, revision)
	if e != nil {
		return Job{}, e
	}
	if e = validateFontFaces(snapshot.Document); e != nil {
		return Job{}, domain.E("MISSING_FONT", "缺少所需字体字重或斜体版本，请重新选择字体")
	}
	raw, e := json.Marshal(snapshot)
	if e != nil {
		return Job{}, e
	}
	sum := sha256.Sum256(raw)
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return Job{}, e
	}
	defer tx.Rollback()
	var user string
	if e = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id=? FOR UPDATE", p.UserID).Scan(&user); e != nil {
		return Job{}, e
	}
	existing, e := scanJob(tx.QueryRowContext(ctx, "SELECT "+jobColumns+" FROM export_jobs WHERE user_id=? AND idempotency_key=?", p.UserID, idempotency), false)
	if e == nil {
		if existing.ProjectID != projectID || existing.Revision != revision {
			return Job{}, domain.E("CONFLICT", "导出请求标识已用于其他版本")
		}
		return existing, nil
	}
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "NOT_FOUND" {
		return Job{}, e
	}
	var queued int
	if e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE user_id=? AND state='queued'", p.UserID).Scan(&queued); e != nil {
		return Job{}, e
	}
	if queued >= 2 {
		return Job{}, domain.E("RATE_LIMITED", "已有两个导出任务排队，请等待完成后再试")
	}
	id := domain.ID()
	_, e = tx.ExecContext(ctx, "INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,expires_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6)+INTERVAL 7 DAY)", id, p.UserID, projectID, revision, raw, snapshot.RendererVersion, hex.EncodeToString(sum[:]), idempotency)
	if e != nil {
		return Job{}, e
	}
	refs := []struct{ id, version string }{{snapshot.Background.AssetID, snapshot.Background.Version}}
	for _, font := range snapshot.Fonts {
		refs = append(refs, struct{ id, version string }{font.AssetID, font.Version})
	}
	for _, ref := range refs {
		if _, e = tx.ExecContext(ctx, "INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('export',?,?,?)", id, ref.id, ref.version); e != nil {
			return Job{}, e
		}
	}
	job, e := scanJob(tx.QueryRowContext(ctx, "SELECT "+jobColumns+",snapshot FROM export_jobs WHERE id=?", id), true)
	if e != nil {
		return Job{}, e
	}
	if e = tx.Commit(); e != nil {
		return Job{}, e
	}
	return job, nil
}
func (s *Service) Claim(ctx context.Context, workerID string, now time.Time) (*Lease, error) {
	if _, e := s.DB.ExecContext(ctx, "UPDATE export_jobs SET state='failed',error_code='ATTEMPTS_EXHAUSTED',error_message='导出进程多次中断，请重新发起导出',lease_token=NULL,lease_until=NULL WHERE state='running' AND lease_until<=? AND attempts>=2", now); e != nil {
		return nil, e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback()
	query := "SELECT " + jobColumns + ",snapshot FROM export_jobs j WHERE ((state='queued' AND available_at<=?) OR (state='running' AND lease_until<=? AND attempts<2)) AND NOT EXISTS(SELECT 1 FROM export_jobs active WHERE active.user_id=j.user_id AND active.state='running' AND active.lease_until>? AND active.id<>j.id) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED"
	job, e := scanJob(tx.QueryRowContext(ctx, query, now, now, now), true)
	if e != nil {
		var known *domain.Error
		if errors.As(e, &known) && known.Code == "NOT_FOUND" {
			return nil, nil
		}
		return nil, e
	}
	var user string
	if e = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id=? FOR UPDATE", job.UserID).Scan(&user); e != nil {
		return nil, e
	}
	var active int
	if e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE user_id=? AND state='running' AND lease_until>? AND id<>?", job.UserID, now, job.ID).Scan(&active); e != nil {
		return nil, e
	}
	if active > 0 {
		return nil, nil
	}
	token := domain.ID()
	until := now.Add(30 * time.Second)
	_, e = tx.ExecContext(ctx, "UPDATE export_jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=?,error_code=NULL,error_message=NULL WHERE id=?", token, until, job.ID)
	if e != nil {
		return nil, e
	}
	job.State = "running"
	job.Attempts++
	if e = tx.Commit(); e != nil {
		return nil, e
	}
	return &Lease{Job: job, Token: token, Until: until}, nil
}
func affected(result sql.Result, e error) error {
	if e != nil {
		return e
	}
	n, e := result.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return domain.E("LEASE_LOST", "导出任务租约已失效")
	}
	return nil
}
func (s *Service) Renew(ctx context.Context, lease Lease, now time.Time) error {
	r, e := s.DB.ExecContext(ctx, "UPDATE export_jobs SET lease_until=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>?", now.Add(30*time.Second), lease.Job.ID, lease.Token, now)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n == 1 {
		return nil
	}
	var valid int
	e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE id=? AND state='running' AND lease_token=? AND lease_until>?", lease.Job.ID, lease.Token, now).Scan(&valid)
	if e != nil {
		return e
	}
	if valid == 1 {
		return nil
	}
	return domain.E("LEASE_LOST", "导出任务租约已失效")
}
func (s *Service) Complete(ctx context.Context, lease Lease, result, preview storage.Key, size int64, now time.Time) error {
	if result == "" || preview == "" || size < 1 {
		return domain.E("INVALID_INPUT", "导出结果不完整")
	}
	r, e := s.DB.ExecContext(ctx, "UPDATE export_jobs SET state='succeeded',result_key=?,preview_key=?,result_size=?,lease_token=NULL,lease_until=NULL,expires_at=? WHERE id=? AND state='running' AND lease_token=? AND lease_until>?", string(result), string(preview), size, now.Add(7*24*time.Hour), lease.Job.ID, lease.Token, now)
	return affected(r, e)
}
func (s *Service) Fail(ctx context.Context, lease Lease, code, message string, now time.Time) error {
	if len(code) > 64 {
		code = "EXPORT_FAILED"
	}
	if len([]rune(message)) > 500 {
		message = string([]rune(message)[:500])
	}
	r, e := s.DB.ExecContext(ctx, "UPDATE export_jobs SET state='failed',error_code=?,error_message=?,lease_token=NULL,lease_until=NULL WHERE id=? AND state='running' AND lease_token=? AND lease_until>?", code, message, lease.Job.ID, lease.Token, now)
	return affected(r, e)
}
func (s *Service) Read(ctx context.Context, p auth.Principal, id string, preview bool) (storage.Key, string, error) {
	j, e := s.Get(ctx, p, id)
	if e != nil {
		return "", "", e
	}
	if j.State != "succeeded" {
		return "", "", domain.E("CONFLICT", "导出图片尚未生成")
	}
	key := j.ResultKey
	// The final preview serves the exact result PNG; CSS scales its display.
	// PreviewKey is a separate thumbnail for lists, not the final approval image.
	_ = preview
	if key == "" {
		return "", "", exportMissing()
	}
	return key, "FastPoster-" + j.ID + ".png", nil
}
