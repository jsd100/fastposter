package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"strconv"
	"strings"
	"unicode/utf8"
)

type Filter struct {
	Page, PageSize                        int
	Keyword, CategoryID, ParentID, UserID string
}
type ResourceInput struct {
	ID, Kind, Title, CategoryID, ParentID, AssetID, Document, Body, Family, Style, License string
	Weight, SortOrder                                                                      int
	Published                                                                              bool
}
type Resource struct {
	ID, Kind, Title, Version, CategoryID, ParentID, AssetID, AssetVersion, Document, Body, Family, Style, License string
	Weight, SortOrder                                                                                             int
	Published                                                                                                     bool
}
type Service struct {
	DB     *sql.DB
	Store  storage.FileStore
	Assets *assets.Service
}

func NewService(db *sql.DB, store storage.FileStore, images *assets.Service) *Service {
	return &Service{DB: db, Store: store, Assets: images}
}
func validKind(kind string) bool {
	switch kind {
	case "background", "font", "template", "copy", "background-category", "font-category", "template-category", "copy-category":
		return true
	}
	return false
}
func pagination(f Filter) (int, int, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PageSize < 1 {
		f.PageSize = 24
	}
	if f.PageSize > 100 {
		f.PageSize = 100
	}
	if f.Page > 100000 || utf8.RuneCountInString(f.Keyword) > 120 {
		return 0, 0, domain.E("INVALID_INPUT", "查询参数无效")
	}
	return f.Page, f.PageSize, nil
}
func catalogMissing() error { return domain.E("NOT_FOUND", "素材不存在或无权访问") }

const resourceColumns = "r.id,r.kind,r.title,r.current_version,r.category_id,r.parent_id,r.sort_order,r.published,v.asset_id,v.asset_version,v.document,v.body,v.metadata"

func scanResource(row interface{ Scan(...any) error }) (Resource, error) {
	var r Resource
	var version uint64
	var category, parent, asset, assetVersion, doc, body, metadata sql.NullString
	e := row.Scan(&r.ID, &r.Kind, &r.Title, &version, &category, &parent, &r.SortOrder, &r.Published, &asset, &assetVersion, &doc, &body, &metadata)
	if errors.Is(e, sql.ErrNoRows) {
		return r, catalogMissing()
	}
	r.Version = strconv.FormatUint(version, 10)
	r.CategoryID = category.String
	r.ParentID = parent.String
	r.AssetID = asset.String
	r.AssetVersion = assetVersion.String
	r.Document = doc.String
	r.Body = body.String
	if metadata.Valid {
		var info struct {
			Family, Style, License string
			Weight                 int
		}
		if err := json.Unmarshal([]byte(metadata.String), &info); err != nil {
			return r, err
		}
		r.Family = info.Family
		r.Weight = info.Weight
		r.Style = info.Style
		r.License = info.License
	}
	return r, e
}
func (s *Service) List(ctx context.Context, p auth.Principal, kind string, f Filter, admin bool) ([]Resource, int, error) {
	if e := auth.RequireUsable(p); e != nil {
		return nil, 0, e
	}
	if admin {
		if e := auth.RequireAdmin(p); e != nil {
			return nil, 0, e
		}
	}
	if !validKind(kind) {
		return nil, 0, domain.E("INVALID_INPUT", "素材类型无效")
	}
	page, size, e := pagination(f)
	if e != nil {
		return nil, 0, e
	}
	where := "r.kind=? AND r.deleted_at IS NULL"
	args := []any{kind}
	if !admin {
		where += " AND r.published=1"
	}
	if f.CategoryID != "" {
		where += " AND r.category_id=?"
		args = append(args, f.CategoryID)
	}
	if f.ParentID != "" {
		where += " AND COALESCE(r.parent_id,'')=?"
		parent := f.ParentID
		if parent == "root" {
			parent = ""
		}
		args = append(args, parent)
	}
	if f.Keyword != "" {
		where += " AND (r.title LIKE ? OR v.body LIKE ?)"
		pattern := "%" + f.Keyword + "%"
		args = append(args, pattern, pattern)
	}
	from := " FROM resources r JOIN resource_versions v ON v.resource_id=r.id AND v.version=r.current_version WHERE " + where
	var total int
	if e = s.DB.QueryRowContext(ctx, "SELECT COUNT(*)"+from, args...).Scan(&total); e != nil {
		return nil, 0, e
	}
	args = append(args, size, (page-1)*size)
	rows, e := s.DB.QueryContext(ctx, "SELECT "+resourceColumns+from+" ORDER BY r.sort_order,r.updated_at DESC,r.id LIMIT ? OFFSET ?", args...)
	if e != nil {
		return nil, 0, e
	}
	defer rows.Close()
	out := []Resource{}
	for rows.Next() {
		r, e := scanResource(rows)
		if e != nil {
			return nil, 0, e
		}
		out = append(out, r)
	}
	return out, total, rows.Err()
}
func (s *Service) Get(ctx context.Context, p auth.Principal, id string, admin bool) (Resource, error) {
	if e := auth.RequireUsable(p); e != nil {
		return Resource{}, e
	}
	where := "r.id=? AND r.deleted_at IS NULL"
	if admin {
		if e := auth.RequireAdmin(p); e != nil {
			return Resource{}, e
		}
	} else {
		where += " AND r.published=1"
	}
	return scanResource(s.DB.QueryRowContext(ctx, "SELECT "+resourceColumns+" FROM resources r JOIN resource_versions v ON v.resource_id=r.id AND v.version=r.current_version WHERE "+where, id))
}
func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func (s *Service) Save(ctx context.Context, p auth.Principal, input ResourceInput) (Resource, error) {
	if e := auth.RequireAdmin(p); e != nil {
		return Resource{}, e
	}
	input.Title = strings.TrimSpace(input.Title)
	if !validKind(input.Kind) || input.Title == "" || utf8.RuneCountInString(input.Title) > 120 || input.SortOrder < 0 || input.SortOrder > 100000 {
		return Resource{}, domain.E("INVALID_INPUT", "请检查素材类型、名称与排序")
	}
	if utf8.RuneCountInString(input.Body) > 10000 || len(input.License) > 4000 {
		return Resource{}, domain.E("INVALID_INPUT", "素材文案或授权说明过长")
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return Resource{}, e
	}
	defer tx.Rollback()
	id, version := input.ID, uint64(1)
	if id != "" {
		var kind string
		e = tx.QueryRowContext(ctx, "SELECT kind,current_version FROM resources WHERE id=? AND deleted_at IS NULL FOR UPDATE", id).Scan(&kind, &version)
		if errors.Is(e, sql.ErrNoRows) {
			return Resource{}, catalogMissing()
		}
		if e != nil {
			return Resource{}, e
		}
		if kind != input.Kind {
			return Resource{}, domain.E("INVALID_INPUT", "不能更改素材类型")
		}
		version++
	} else {
		id = domain.ID()
	}
	for _, categoryID := range []string{input.CategoryID, input.ParentID} {
		if categoryID == "" {
			continue
		}
		if categoryID == id {
			return Resource{}, domain.E("INVALID_INPUT", "分类不能包含自身")
		}
		var kind string
		if e = tx.QueryRowContext(ctx, "SELECT kind FROM resources WHERE id=? AND deleted_at IS NULL FOR SHARE", categoryID).Scan(&kind); e != nil {
			return Resource{}, catalogMissing()
		}
		want := strings.TrimSuffix(input.Kind, "-category") + "-category"
		if kind != want {
			return Resource{}, domain.E("INVALID_INPUT", "分类类型不匹配")
		}
	}
	if strings.HasSuffix(input.Kind, "-category") {
		if e = s.validateParent(ctx, tx, id, input.ParentID, input.Kind); e != nil {
			return Resource{}, e
		}
	}
	assetVersion := ""
	metadata := map[string]any{}
	if input.Kind == "background" || input.Kind == "font" {
		asset, e := s.Assets.Get(ctx, p, input.AssetID)
		if e != nil {
			return Resource{}, e
		}
		want := "image"
		if input.Kind == "font" {
			want = "font"
		}
		if asset.Kind != want {
			return Resource{}, domain.E("INVALID_INPUT", "素材文件类型不匹配")
		}
		assetVersion = asset.Version
		if want == "font" {
			if e = json.Unmarshal(asset.Metadata, &metadata); e != nil {
				return Resource{}, e
			}
			if input.Family != "" && input.Family != metadata["family"] {
				return Resource{}, domain.E("INVALID_INPUT", "字体家族必须与上传版本一致")
			}
		}
	}
	if input.Kind == "template" {
		return Resource{}, domain.E("NOT_READY", "模板依赖服务尚未初始化")
	}

	if input.Kind == "copy" && strings.TrimSpace(input.Body) == "" {
		return Resource{}, domain.E("INVALID_INPUT", "文案正文不能为空")
	}
	if input.License != "" {
		metadata["license"] = input.License
	}
	raw, e := json.Marshal(metadata)
	if e != nil {
		return Resource{}, e
	}
	if input.ID == "" {
		_, e = tx.ExecContext(ctx, "INSERT INTO resources(id,kind,title,category_id,parent_id,sort_order,published,current_version,created_by) VALUES(?,?,?,?,?,?,?,?,?)", id, input.Kind, input.Title, nullString(input.CategoryID), nullString(input.ParentID), input.SortOrder, input.Published, version, p.UserID)
	} else {
		_, e = tx.ExecContext(ctx, "UPDATE resources SET title=?,category_id=?,parent_id=?,sort_order=?,published=?,current_version=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?", input.Title, nullString(input.CategoryID), nullString(input.ParentID), input.SortOrder, input.Published, version, id)
	}
	if e != nil {
		return Resource{}, e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,document,body,metadata) VALUES(?,?,?,?,?,?,?)", id, version, nullString(input.AssetID), nullString(assetVersion), nullString(input.Document), nullString(input.Body), raw); e != nil {
		return Resource{}, e
	}
	if input.AssetID != "" {
		if _, e = tx.ExecContext(ctx, "INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('resource',?,?,?)", id, input.AssetID, assetVersion); e != nil {
			return Resource{}, e
		}
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,?,?,'success')", domain.ID(), p.UserID, "resource.save", id); e != nil {
		return Resource{}, e
	}
	if e = tx.Commit(); e != nil {
		return Resource{}, e
	}
	return s.Get(ctx, p, id, true)
}
func (s *Service) validateParent(ctx context.Context, tx *sql.Tx, id, parent, kind string) error {
	seen := map[string]bool{id: true}
	depth := 1
	for parent != "" {
		if seen[parent] || depth >= 5 {
			return domain.E("INVALID_INPUT", "分类最多 5 层且不能循环")
		}
		seen[parent] = true
		var next sql.NullString
		var parentKind string
		if e := tx.QueryRowContext(ctx, "SELECT parent_id,kind FROM resources WHERE id=? AND deleted_at IS NULL", parent).Scan(&next, &parentKind); e != nil {
			return catalogMissing()
		}
		if parentKind != kind {
			return domain.E("INVALID_INPUT", "分类类型不匹配")
		}
		parent = next.String
		depth++
	}
	return nil
}
func (s *Service) Delete(ctx context.Context, p auth.Principal, id string) error {
	if e := auth.RequireAdmin(p); e != nil {
		return e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var exists string
	if e = tx.QueryRowContext(ctx, "SELECT id FROM resources WHERE id=? AND deleted_at IS NULL FOR UPDATE", id).Scan(&exists); e != nil {
		return catalogMissing()
	}
	var count int
	e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resource_versions v JOIN asset_refs ref ON ref.asset_id=v.asset_id AND ref.asset_version=v.asset_version WHERE v.resource_id=? AND NOT(ref.owner_kind='resource' AND ref.owner_id=?)", id, id).Scan(&count)
	if e != nil {
		return e
	}
	if count > 0 {
		return domain.E("CONFLICT", "素材已有作品或模板引用，请下架保留历史版本")
	}
	if e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL AND (category_id=? OR parent_id=?)", id, id).Scan(&count); e != nil {
		return e
	}
	if count > 0 {
		return domain.E("CONFLICT", "请先移动分类下的素材或子分类")
	}
	if _, e = tx.ExecContext(ctx, "UPDATE resources SET deleted_at=UTC_TIMESTAMP(6),published=0 WHERE id=?", id); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,'resource.delete',?,'success')", domain.ID(), p.UserID, id); e != nil {
		return e
	}
	return tx.Commit()
}
