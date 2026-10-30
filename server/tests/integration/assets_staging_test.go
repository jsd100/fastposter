package integration_test

import (
	"context"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"strings"
	"testing"
)

func TestAssetStagingOwnershipAndSingleClaim(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled'),('u2','two','two','disabled')"); e != nil {
		t.Fatal(e)
	}
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	svc := assets.NewService(db, store, nil, t.TempDir())
	ctx := context.Background()
	owner := auth.Principal{UserID: "u1", Role: "user"}
	other := auth.Principal{UserID: "u2", Role: "user"}
	key, e := svc.BeginStage(ctx, owner, "images")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = store.Put(ctx, key, strings.NewReader("complete file")); e != nil {
		t.Fatal(e)
	}
	if _, e = svc.ClaimStage(ctx, other, key, "images"); e == nil {
		t.Fatal("another user claimed staged bytes")
	}
	if _, e = svc.ClaimStage(ctx, owner, key, "fonts"); e == nil {
		t.Fatal("wrong-purpose stage accepted")
	}
	r, e := svc.ClaimStage(ctx, owner, key, "images")
	if e != nil {
		t.Fatal(e)
	}
	r.Close()
	if _, e = svc.ClaimStage(ctx, owner, key, "images"); e == nil {
		t.Fatal("stage claimed twice")
	}
	expired, e := svc.BeginStage(ctx, owner, "images")
	if e != nil {
		t.Fatal(e)
	}
	db.Exec("UPDATE staged_uploads SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE file_key=?", string(expired))
	if _, e = svc.ClaimStage(ctx, owner, expired, "images"); e == nil {
		t.Fatal("expired stage claimed")
	}
	if _, e = svc.BeginStage(ctx, owner, "fonts"); e == nil {
		t.Fatal("nonadmin font upload allowed")
	}
}
