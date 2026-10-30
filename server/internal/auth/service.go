package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fastposter/server/internal/domain"
	"github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
	"golang.org/x/text/unicode/norm"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type User struct {
	ID                 string
	Username           string
	Role               string
	Disabled           bool
	MustChangePassword bool
	CreatedAt          time.Time
}
type Principal struct {
	UserID             string
	Role               string
	SessionID          string
	MustChangePassword bool
}
type SessionToken struct {
	Token string
	User  User
}
type Service struct {
	db                                   *sql.DB
	dummyHash                            string
	passwordVerifier                     func(string, string) bool
	accountLimit, ipLimit, registerLimit *Limiter
}
type ipKey struct{}

func WithClientIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, ipKey{}, ip)
}
func clientIP(ctx context.Context) string {
	if s, ok := ctx.Value(ipKey{}).(string); ok && s != "" {
		return s
	}
	return "local"
}
func NewService(db *sql.DB, client *redis.Client) (*Service, error) {
	dummy, e := HashPassword("dummy password for uniform authentication cost")
	if e != nil {
		return nil, e
	}
	return &Service{db: db, dummyHash: dummy, passwordVerifier: VerifyPassword, accountLimit: NewLimiter(client, 10, time.Minute, 2048), ipLimit: NewLimiter(client, 100, time.Minute, 2048), registerLimit: NewLimiter(client, 20, 10*time.Minute, 2048)}, nil
}
func normalizeUsername(name string) (string, string, error) {
	display := norm.NFKC.String(strings.TrimSpace(name))
	if n := utf8.RuneCountInString(display); n < 2 || n > 32 {
		return "", "", domain.E("INVALID_INPUT", "用户名需要 2–32 个字符")
	}
	for _, r := range display {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' && r != '.' {
			return "", "", domain.E("INVALID_INPUT", "用户名仅支持文字、数字、下划线、短横线和点")
		}
	}
	return display, strings.ToLower(display), nil
}
func (s *Service) Register(ctx context.Context, username, password string) (User, error) {
	allowed, e := s.registerLimit.Allow(ctx, "register:ip:"+clientIP(ctx))
	if e != nil {
		return User{}, e
	}
	if !allowed {
		return User{}, domain.E("RATE_LIMITED", "注册过于频繁，请稍后重试")
	}
	return s.createUser(ctx, username, password, "user")
}
func (s *Service) CreateAdmin(ctx context.Context, username, password string) (User, error) {
	return s.createUser(ctx, username, password, "admin")
}
func (s *Service) createUser(ctx context.Context, username, password, role string) (User, error) {
	display, normalized, e := normalizeUsername(username)
	if e != nil {
		return User{}, e
	}
	hash, e := HashPassword(password)
	if e != nil {
		return User{}, e
	}
	id := domain.ID()
	_, e = s.db.ExecContext(ctx, "INSERT INTO users(id,username,username_normalized,password_hash,role) VALUES(?,?,?,?,?)", id, display, normalized, hash, role)
	if e != nil {
		var duplicate *mysql.MySQLError
		if errors.As(e, &duplicate) && duplicate.Number == 1062 {
			return User{}, domain.E("USERNAME_TAKEN", "该用户名已被使用")
		}
		return User{}, e
	}
	return s.GetUser(ctx, id)
}
func (s *Service) GetUser(ctx context.Context, id string) (User, error) {
	var u User
	e := s.db.QueryRowContext(ctx, "SELECT id,username,role,disabled,must_change_password,created_at FROM users WHERE id=?", id).Scan(&u.ID, &u.Username, &u.Role, &u.Disabled, &u.MustChangePassword, &u.CreatedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return u, domain.E("NOT_FOUND", "用户不存在")
	}
	return u, e
}
func invalidLogin() error { return domain.E("INVALID_CREDENTIALS", "用户名或密码不正确") }
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func randomToken() (string, error) {
	var b [32]byte
	if _, e := rand.Read(b[:]); e != nil {
		return "", e
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}
func (s *Service) Login(ctx context.Context, username, password string) (SessionToken, error) {
	_, normalized, _ := normalizeUsername(username)
	for _, pair := range []struct {
		limit *Limiter
		key   string
	}{{s.accountLimit, "login:user:" + normalized}, {s.ipLimit, "login:ip:" + clientIP(ctx)}} {
		allowed, e := pair.limit.Allow(ctx, pair.key)
		if e != nil {
			return SessionToken{}, e
		}
		if !allowed {
			return SessionToken{}, domain.E("RATE_LIMITED", "登录尝试过于频繁，请稍后重试")
		}
	}
	var id, hash string
	var disabled bool
	e := s.db.QueryRowContext(ctx, "SELECT id,password_hash,disabled FROM users WHERE username_normalized=?", normalized).Scan(&id, &hash, &disabled)
	if e != nil && !errors.Is(e, sql.ErrNoRows) {
		return SessionToken{}, e
	}
	if e != nil {
		hash = s.dummyHash
	}
	valid := s.passwordVerifier(hash, password)
	if e != nil || !valid || disabled {
		return SessionToken{}, invalidLogin()
	}
	token, e := randomToken()
	if e != nil {
		return SessionToken{}, e
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return SessionToken{}, e
	}
	defer tx.Rollback()
	var currentHash string
	var currentlyDisabled bool
	if e = tx.QueryRowContext(ctx, "SELECT password_hash,disabled FROM users WHERE id=? FOR UPDATE", id).Scan(&currentHash, &currentlyDisabled); e != nil {
		return SessionToken{}, e
	}
	if currentlyDisabled || currentHash != hash {
		return SessionToken{}, invalidLogin()
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)", domain.ID(), id, tokenHash(token), time.Now().UTC().Add(30*24*time.Hour)); e != nil {
		return SessionToken{}, e
	}
	if e = tx.Commit(); e != nil {
		return SessionToken{}, e
	}
	user, e := s.GetUser(ctx, id)
	return SessionToken{Token: token, User: user}, e
}
func (s *Service) ResolveSession(ctx context.Context, token string) (Principal, error) {
	var p Principal
	if token == "" || len(token) > 128 {
		return p, domain.E("AUTH_REQUIRED", "请先登录")
	}
	e := s.db.QueryRowContext(ctx, "SELECT s.id,u.id,u.role,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0", tokenHash(token), time.Now().UTC()).Scan(&p.SessionID, &p.UserID, &p.Role, &p.MustChangePassword)
	if errors.Is(e, sql.ErrNoRows) {
		return p, domain.E("AUTH_REQUIRED", "登录已失效，请重新登录")
	}
	return p, e
}
func (s *Service) Revoke(ctx context.Context, sessionID string) error {
	_, e := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE id=?", sessionID)
	return e
}
func RequireAdmin(p Principal) error {
	if p.Role != "admin" {
		return domain.E("FORBIDDEN", "需要管理员权限")
	}
	return RequireUsable(p)
}
func RequireUsable(p Principal) error {
	if p.UserID == "" {
		return domain.E("AUTH_REQUIRED", "请先登录")
	}
	if p.MustChangePassword {
		return domain.E("PASSWORD_CHANGE_REQUIRED", "请先修改密码")
	}
	return nil
}
func (s *Service) SetDisabled(ctx context.Context, actor Principal, id string, disabled bool) error {
	if e := RequireAdmin(actor); e != nil {
		return e
	}
	if actor.UserID == id {
		return domain.E("INVALID_INPUT", "不能禁用当前管理员账号")
	}
	tx, e := s.db.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	result, e := tx.ExecContext(ctx, "UPDATE users SET disabled=? WHERE id=?", disabled, id)
	if e != nil {
		return e
	}
	if n, _ := result.RowsAffected(); n == 0 {
		var count int
		tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE id=?", id).Scan(&count)
		if count == 0 {
			return domain.E("NOT_FOUND", "用户不存在")
		}
	}
	if disabled {
		if _, e = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=?", id); e != nil {
			return e
		}
	}
	action := "enable-user"
	if disabled {
		action = "disable-user"
	}
	if _, e = tx.ExecContext(ctx, "INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,?,?,?)", domain.ID(), actor.UserID, action, id, "success"); e != nil {
		return e
	}
	return tx.Commit()
}
