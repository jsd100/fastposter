package integration_test

import (
	"context"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/testutil"
	"testing"
)

func TestAuthRegisterLoginRevoke(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	user, e := service.Register(ctx, "海报用户", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	if user.Role != "user" {
		t.Fatal("registration gained admin role")
	}
	session, e := service.Login(ctx, "海报用户", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	var storedToken string
	if e = db.QueryRow("SELECT token_hash FROM sessions WHERE user_id=?", user.ID).Scan(&storedToken); e != nil || storedToken == session.Token || len(storedToken) != 64 {
		t.Fatal("raw session credential persisted")
	}
	p, e := service.ResolveSession(ctx, session.Token)
	if e != nil || p.UserID != user.ID {
		t.Fatal("session did not resolve")
	}
	if e = service.Revoke(ctx, p.SessionID); e != nil {
		t.Fatal(e)
	}
	if _, e = service.ResolveSession(ctx, session.Token); e == nil {
		t.Fatal("revoked session remained valid")
	}
}
func TestAuthDisableRevokesAllSessions(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	admin, _ := service.Register(ctx, "administrator", "correct horse battery")
	db.Exec("UPDATE users SET role='admin' WHERE id=?", admin.ID)
	user, _ := service.Register(ctx, "poster-user", "correct horse battery")
	first, _ := service.Login(ctx, "poster-user", "correct horse battery")
	second, _ := service.Login(ctx, "poster-user", "correct horse battery")
	actor := auth.Principal{UserID: admin.ID, Role: "admin"}
	if e = service.SetDisabled(ctx, actor, user.ID, true); e != nil {
		t.Fatal(e)
	}
	for _, token := range []string{first.Token, second.Token} {
		if _, e = service.ResolveSession(ctx, token); e == nil {
			t.Fatal("disabled session valid")
		}
	}
	if e = service.SetDisabled(ctx, actor, user.ID, false); e != nil {
		t.Fatal(e)
	}
	if _, e = service.ResolveSession(ctx, first.Token); e == nil {
		t.Fatal("re-enable revived revoked session")
	}
}
func TestAuthLoginErrorsDoNotRevealAccount(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	service.Register(ctx, "exists-user", "correct horse battery")
	_, a := service.Login(ctx, "exists-user", "wrong password")
	_, b := service.Login(ctx, "missing-user", "wrong password")
	if a == nil || b == nil || a.Error() != b.Error() {
		t.Fatal("login leaks account existence")
	}
}

func TestAuthResetTokenOneUse(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := auth.NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	admin, e := service.CreateAdmin(ctx, "admin-reset", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	user, e := service.Register(ctx, "reset-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	old, e := service.Login(ctx, "reset-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	token, e := service.ResetPassword(ctx, auth.Principal{UserID: admin.ID, Role: "admin"}, user.ID)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = service.ResolveSession(ctx, old.Token); e == nil {
		t.Fatal("reset did not revoke session")
	}
	if _, e = service.Login(ctx, "reset-user", "correct horse battery"); e == nil {
		t.Fatal("old password remains usable")
	}
	if e = service.ChangePassword(ctx, auth.Principal{}, "", "new correct password", token, "reset-user"); e != nil {
		t.Fatal(e)
	}
	if e = service.ChangePassword(ctx, auth.Principal{}, "", "another new password", token, "reset-user"); e == nil {
		t.Fatal("reset token reused")
	}
	if _, e = service.Login(ctx, "reset-user", "new correct password"); e != nil {
		t.Fatal(e)
	}
}
