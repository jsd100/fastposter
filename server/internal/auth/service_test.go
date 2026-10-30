package auth

import (
	"context"
	"github.com/redis/go-redis/v9"
	"strings"
	"testing"
	"time"
)

func TestPasswordHashAndUniformLoginError(t *testing.T) {
	hash, e := HashPassword("correct horse battery")
	if e != nil {
		t.Fatal(e)
	}
	if hash == "correct horse battery" || !strings.HasPrefix(hash, "$argon2id$") || !VerifyPassword(hash, "correct horse battery") || VerifyPassword(hash, "wrong password") {
		t.Fatal("password verification contract failed")
	}
	for _, bad := range []string{"", "$argon2id$v=19$m=999999999,t=3,p=1$invalid$invalid"} {
		if VerifyPassword(bad, "password") {
			t.Fatal("invalid hash accepted")
		}
	}
}
func TestRedisOutageUsesBoundedLimiter(t *testing.T) {
	client := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", MaxRetries: -1, DialTimeout: 5 * time.Millisecond, ReadTimeout: 5 * time.Millisecond, WriteTimeout: 5 * time.Millisecond})
	defer client.Close()
	limit := NewLimiter(client, 2, time.Minute, 2)
	for i := range 3 {
		ok, e := limit.Allow(context.Background(), "same-user")
		if e != nil || ok != (i < 2) {
			t.Fatalf("unexpected fallback rate decision %d: %v %v", i, ok, e)
		}
	}
	memory := NewLimiter(nil, 2, time.Minute, 2)
	memory.Allow(context.Background(), "a")
	memory.Allow(context.Background(), "b")
	if ok, _ := memory.Allow(context.Background(), "c"); ok {
		t.Fatal("fallback exceeded bounded key capacity")
	}
}
