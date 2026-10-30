package assets

import (
	"context"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"io"
	"strings"
)

func (s *Service) BeginStage(ctx context.Context, p auth.Principal, purpose string) (storage.Key, error) {
	if e := auth.RequireUsable(p); e != nil {
		return "", e
	}
	switch purpose {
	case "images", "templates":
	case "fonts", "admin-templates":
		if e := auth.RequireAdmin(p); e != nil {
			return "", e
		}
	default:
		return "", domain.E("INVALID_INPUT", "不支持的上传类型")
	}
	key := storage.NewKey("staging/" + purpose)
	_, e := s.DB.ExecContext(ctx, "INSERT INTO staged_uploads(file_key,user_id,state,expires_at) VALUES(?,?,'staged',UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE)", string(key), p.UserID)
	return key, e
}
func (s *Service) ClaimStage(ctx context.Context, p auth.Principal, key storage.Key, purpose string) (io.ReadCloser, error) {
	if e := auth.RequireUsable(p); e != nil {
		return nil, e
	}
	if !strings.HasPrefix(string(key), "staging/"+purpose+"/") {
		return nil, domain.E("NOT_FOUND", "上传已失效或无权访问")
	}
	result, e := s.DB.ExecContext(ctx, "UPDATE staged_uploads SET state='claimed' WHERE file_key=? AND user_id=? AND state='staged' AND expires_at>UTC_TIMESTAMP(6)", string(key), p.UserID)
	if e != nil {
		return nil, e
	}
	n, e := result.RowsAffected()
	if e != nil {
		return nil, e
	}
	if n != 1 {
		return nil, domain.E("NOT_FOUND", "上传已失效或无权访问")
	}
	r, e := s.Store.Open(ctx, key)
	if e != nil {
		s.EndStage(ctx, p, key, false)
		return nil, domain.E("NOT_FOUND", "上传文件不完整，请重试")
	}
	return r, nil
}
func (s *Service) EndStage(ctx context.Context, p auth.Principal, key storage.Key, success bool) error {
	state := "failed"
	if success {
		state = "complete"
	}
	result, e := s.DB.ExecContext(ctx, "UPDATE staged_uploads SET state=? WHERE file_key=? AND user_id=? AND state IN ('staged','claimed')", state, string(key), p.UserID)
	if e != nil {
		return e
	}
	n, e := result.RowsAffected()
	if e != nil {
		return e
	}
	if n == 1 {
		return s.Store.Delete(ctx, key)
	}
	return nil
}
