package projects

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type Project struct {
	ID, OwnerID, Title, Revision string
	Document                     document.Document
	UpdatedAt                    time.Time
	DeletedAt                    *time.Time
}
type Service struct {
	DB    *sql.DB
	Store storage.FileStore
}

func NewService(db *sql.DB, store storage.FileStore) *Service { return &Service{DB: db, Store: store} }
func validateTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > 120 || strings.ContainsFunc(title, unicode.IsControl) {
		return "", domain.E("INVALID_INPUT", "作品名称须为 1 至 120 个字符")
	}
	return title, nil
}
func parseRevision(raw string) (uint64, error) {
	v, e := strconv.ParseUint(raw, 10, 64)
	if e != nil || v == 0 || strconv.FormatUint(v, 10) != raw {
		return 0, domain.E("INVALID_INPUT", "作品版本无效")
	}
	return v, nil
}
func validateInput(title string, d document.Document) (string, []byte, error) {
	title, e := validateTitle(title)
	if e != nil {
		return "", nil, e
	}
	if e = document.Validate(d); e != nil {
		return "", nil, domain.E("INVALID_INPUT", "作品文档无效，请检查画布和文字设置")
	}
	raw, e := json.Marshal(d)
	if e != nil || len(raw) > 2<<20 {
		return "", nil, domain.E("INVALID_INPUT", "作品文档过大或无效")
	}
	return title, raw, nil
}
func missing() error { return domain.E("NOT_FOUND", "作品不存在或无权访问") }
func conflict() error {
	return domain.E("REVISION_CONFLICT", "云端作品已更新，请加载云端版本或将本地另存为作品")
}
func scanProject(row interface{ Scan(...any) error }) (Project, error) {
	var p Project
	var raw []byte
	var rev uint64
	var deleted sql.NullTime
	e := row.Scan(&p.ID, &p.OwnerID, &p.Title, &raw, &rev, &p.UpdatedAt, &deleted)
	if errors.Is(e, sql.ErrNoRows) {
		return p, missing()
	}
	if e != nil {
		return p, e
	}
	p.Revision = strconv.FormatUint(rev, 10)
	p.Document, e = document.Parse(raw)
	if deleted.Valid {
		p.DeletedAt = &deleted.Time
	}
	return p, e
}

const columns = "id,owner_id,title,document,revision,updated_at,deleted_at"

func (s *Service) Create(ctx context.Context, p auth.Principal, title string, d document.Document) (Project, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Project{}, e
	}
	title, raw, e := validateInput(title, d)
	if e != nil {
		return Project{}, e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return Project{}, e
	}
	defer tx.Rollback()
	if _, e = s.resolveRefs(ctx, tx, p, d); e != nil {
		return Project{}, e
	}
	id := domain.ID()
	_, e = tx.ExecContext(ctx, "INSERT INTO projects(id,owner_id,title,document,revision,width,height) VALUES(?,?,?,?,1,?,?)", id, p.UserID, title, raw, d.Canvas.Width, d.Canvas.Height)
	if e != nil {
		return Project{}, e
	}
	if e = s.writeRevision(ctx, tx, id, 1, raw, d); e != nil {
		return Project{}, e
	}
	out, e := scanProject(tx.QueryRowContext(ctx, "SELECT "+columns+" FROM projects WHERE id=?", id))
	if e != nil {
		return Project{}, e
	}
	if e = tx.Commit(); e != nil {
		return Project{}, e
	}
	return out, nil
}
func (s *Service) Save(ctx context.Context, p auth.Principal, id, expected, title string, d document.Document) (Project, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Project{}, e
	}
	want, e := parseRevision(expected)
	if e != nil {
		return Project{}, e
	}
	title, raw, e := validateInput(title, d)
	if e != nil {
		return Project{}, e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return Project{}, e
	}
	defer tx.Rollback()
	current, e := scanProject(tx.QueryRowContext(ctx, "SELECT "+columns+" FROM projects WHERE id=? AND owner_id=? AND deleted_at IS NULL FOR UPDATE", id, p.UserID))
	if e != nil {
		return Project{}, e
	}
	rev, _ := parseRevision(current.Revision)
	if rev != want || rev == math.MaxUint64 {
		return Project{}, conflict()
	}
	if _, e = s.resolveRefs(ctx, tx, p, d); e != nil {
		return Project{}, e
	}
	result, e := tx.ExecContext(ctx, "UPDATE projects SET title=?,document=?,revision=revision+1,width=?,height=?,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL", title, raw, d.Canvas.Width, d.Canvas.Height, id, p.UserID, want)
	if e != nil {
		return Project{}, e
	}
	n, e := result.RowsAffected()
	if e != nil {
		return Project{}, e
	}
	if n != 1 {
		return Project{}, conflict()
	}
	if e = s.writeRevision(ctx, tx, id, rev+1, raw, d); e != nil {
		return Project{}, e
	}
	out, e := scanProject(tx.QueryRowContext(ctx, "SELECT "+columns+" FROM projects WHERE id=?", id))
	if e != nil {
		return Project{}, e
	}
	if e = tx.Commit(); e != nil {
		return Project{}, e
	}
	return out, nil
}
func (s *Service) Get(ctx context.Context, p auth.Principal, id string) (Project, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Project{}, e
	}
	return scanProject(s.DB.QueryRowContext(ctx, "SELECT "+columns+" FROM projects WHERE id=? AND owner_id=? AND deleted_at IS NULL", id, p.UserID))
}
func (s *Service) List(ctx context.Context, p auth.Principal, page, size int, trash bool, keyword string) ([]Project, int, error) {
	if e := auth.RequireUsable(p); e != nil {
		return nil, 0, e
	}
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 24
	}
	if size > 100 {
		size = 100
	}
	if page > 100000 || utf8.RuneCountInString(keyword) > 120 {
		return nil, 0, domain.E("INVALID_INPUT", "查询参数无效")
	}
	where := "owner_id=? AND deleted_at IS NULL"
	if trash {
		where = "owner_id=? AND deleted_at>UTC_TIMESTAMP(6)-INTERVAL 30 DAY"
	}
	where += " AND title LIKE ?"
	pattern := "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(keyword) + "%"
	var total int
	if e := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM projects WHERE "+where, p.UserID, pattern).Scan(&total); e != nil {
		return nil, 0, e
	}
	rows, e := s.DB.QueryContext(ctx, "SELECT "+columns+" FROM projects WHERE "+where+" ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?", p.UserID, pattern, size, (page-1)*size)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []Project{}
	for rows.Next() {
		v, e := scanProject(rows)
		if e != nil {
			return nil, 0, e
		}
		out = append(out, v)
	}
	return out, total, rows.Err()
}
func (s *Service) Clone(ctx context.Context, p auth.Principal, id string) (Project, error) {
	a, e := s.Get(ctx, p, id)
	if e != nil {
		return Project{}, e
	}
	title := []rune(a.Title)
	if len(title) > 115 {
		title = title[:115]
	}
	return s.Create(ctx, p, string(title)+" 副本", a.Document)
}
func (s *Service) SoftDelete(ctx context.Context, p auth.Principal, id string) error {
	if e := auth.RequireUsable(p); e != nil {
		return e
	}
	r, e := s.DB.ExecContext(ctx, "UPDATE projects SET deleted_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=? AND owner_id=? AND deleted_at IS NULL", id, p.UserID)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return missing()
	}
	return nil
}
func (s *Service) Restore(ctx context.Context, p auth.Principal, id string) (Project, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Project{}, e
	}
	r, e := s.DB.ExecContext(ctx, "UPDATE projects SET deleted_at=NULL,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND owner_id=? AND deleted_at>UTC_TIMESTAMP(6)-INTERVAL 30 DAY", id, p.UserID)
	if e != nil {
		return Project{}, e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return Project{}, e
	}
	if n != 1 {
		return Project{}, missing()
	}
	return s.Get(ctx, p, id)
}
