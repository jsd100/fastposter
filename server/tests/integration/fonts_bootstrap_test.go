package integration_test

import (
	"context"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"testing"
)

func TestBuiltinFontsBootstrapIsImmutableAndReadable(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	svc := assets.NewService(db, store, nil, t.TempDir())
	ctx := context.Background()
	if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
		t.Fatal(e)
	}
	if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
		t.Fatal(e)
	}
	list, e := svc.ListFonts(ctx, auth.Principal{UserID: "reader", Role: "user"})
	if e != nil || len(list) != 11 {
		t.Fatalf("builtin faces %d %v", len(list), e)
	}
	for _, f := range list {
		key, e := svc.AuthorizeRead(ctx, auth.Principal{UserID: "reader", Role: "user"}, f.AssetID, f.Version)
		if e != nil {
			t.Fatal(e)
		}
		r, e := store.Open(ctx, key)
		if e != nil {
			t.Fatal(e)
		}
		r.Close()
	}
	var references int
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='resource'").Scan(&references); e != nil || references != 11 {
		t.Fatalf("builtin resource refs %d %v", references, e)
	}
	var users int
	db.QueryRow("SELECT COUNT(*) FROM users WHERE disabled=0").Scan(&users)
	if users != 0 {
		t.Fatal("bootstrap created a login account")
	}
	if _, e = db.Exec("UPDATE resources SET published=0 WHERE id=?", list[0].AssetID); e != nil {
		t.Fatal(e)
	}
	if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
		t.Fatal(e)
	}
	list, e = svc.ListFonts(ctx, auth.Principal{UserID: "reader", Role: "user"})
	if e != nil || len(list) != 10 {
		t.Fatal("restart republished a disabled font")
	}
}
