package auth

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/domain"
	"time"
)

func (s *Service) ResetPassword(ctx context.Context, actor Principal, id string) (string, error) {
	if e := RequireAdmin(actor); e != nil {
		return "", e
	}
	if actor.UserID == id {
		return "", domain.E("INVALID_INPUT", "请在个人设置中修改自己的密码")
	}
	token, e := randomToken()
	if e != nil {
		return "", e
	}
	discard, e := randomToken()
	if e != nil {
		return "", e
	}
	hash, e := HashPassword(discard)
	if e != nil {
		return "", e
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return "", e
	}
	defer tx.Rollback()
	result, e := tx.ExecContext(ctx, "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?", hash, id)
	if e != nil {
		return "", e
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return "", domain.E("NOT_FOUND", "用户不存在")
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=?", id); e != nil {
		return "", e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM password_reset_tokens WHERE user_id=?", id); e != nil {
		return "", e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)", domain.ID(), id, tokenHash(token), time.Now().UTC().Add(30*time.Minute)); e != nil {
		return "", e
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,?,?,?)", domain.ID(), actor.UserID, "reset-password", id, "success"); e != nil {
		return "", e
	}
	if e = tx.Commit(); e != nil {
		return "", e
	}
	return token, nil
}
func (s *Service) ChangePassword(ctx context.Context, p Principal, current, next, resetToken, username string) error {
	if resetToken == "" && p.UserID == "" {
		return domain.E("AUTH_REQUIRED", "请先登录")
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	id := p.UserID
	if resetToken != "" {
		_, normalized, err := normalizeUsername(username)
		if err != nil {
			return domain.E("RESET_INVALID", "重置凭证无效或已过期")
		}
		var tokenID string
		e = tx.QueryRowContext(ctx, "SELECT t.id,u.id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.used=0 AND t.expires_at>? AND u.username_normalized=? AND u.disabled=0 FOR UPDATE", tokenHash(resetToken), time.Now().UTC(), normalized).Scan(&tokenID, &id)
		if errors.Is(e, sql.ErrNoRows) {
			return domain.E("RESET_INVALID", "重置凭证无效或已过期")
		}
		if e != nil {
			return e
		}
		if _, e = tx.ExecContext(ctx, "UPDATE password_reset_tokens SET used=1 WHERE id=?", tokenID); e != nil {
			return e
		}
	} else {
		if id == "" {
			return domain.E("AUTH_REQUIRED", "请先登录")
		}
		var previous string
		e = tx.QueryRowContext(ctx, "SELECT password_hash FROM users WHERE id=? AND disabled=0 FOR UPDATE", id).Scan(&previous)
		if e != nil {
			return e
		}
		if !VerifyPassword(previous, current) {
			return domain.E("INVALID_CREDENTIALS", "当前密码不正确")
		}
	}
	hash, e := HashPassword(next)
	if e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?", hash, id); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=?", id); e != nil {
		return e
	}
	return tx.Commit()
}
