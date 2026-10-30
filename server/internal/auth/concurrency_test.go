package auth

import (
	"context"
	"fastposter/server/internal/testutil"
	"testing"
)

func TestPasswordRotationDuringLoginCannotIssueOldSession(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	service, e := NewService(db, nil)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	user, e := service.Register(ctx, "concurrent-user", "correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	verified, resume := make(chan struct{}), make(chan struct{})
	service.passwordVerifier = func(hash, password string) bool {
		valid := VerifyPassword(hash, password)
		close(verified)
		<-resume
		return valid
	}
	done := make(chan error, 1)
	go func() { _, e := service.Login(ctx, "concurrent-user", "correct horse battery"); done <- e }()
	<-verified
	newHash, e := HashPassword("replacement password")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE users SET password_hash=? WHERE id=?", newHash, user.ID); e != nil {
		t.Fatal(e)
	}
	close(resume)
	if e = <-done; e == nil {
		t.Fatal("login issued a session using a password rotated during verification")
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM sessions WHERE user_id=?", user.ID).Scan(&count)
	if count != 0 {
		t.Fatal("stale login session persisted")
	}
}
