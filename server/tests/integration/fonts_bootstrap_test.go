package integration_test

import (
	"bytes"
	"context"
	"errors"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"io"
	"os"
	"reflect"
	"strings"
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
	if e != nil || len(list) != 15 {
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
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_kind='resource'").Scan(&references); e != nil || references != 15 {
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
	if e != nil || len(list) != 14 {
		t.Fatal("restart republished a disabled font")
	}
}

func TestBuiltinFontsRestoreMissingRuntimeCopiesWithoutChangingVersions(t *testing.T) {
	svc, ctx := builtinService(t)
	reader := auth.Principal{UserID: "reader", Role: "user"}
	before, e := svc.ListFonts(ctx, reader)
	if e != nil {
		t.Fatal(e)
	}
	snapshots := map[storage.Key]storage.FileInfo{}
	for _, font := range before {
		key, e := svc.AuthorizeRead(ctx, reader, font.AssetID, font.Version)
		if e != nil {
			t.Fatal(e)
		}
		info, e := svc.Store.Stat(ctx, key)
		if e != nil {
			t.Fatal(e)
		}
		snapshots[key] = info
	}
	// A disabled resource must be repaired without being republished.
	if _, e = svc.DB.Exec("UPDATE resources SET published=0 WHERE id=?", before[0].AssetID); e != nil {
		t.Fatal(e)
	}
	expected, e := svc.ListFonts(ctx, reader)
	if e != nil {
		t.Fatal(e)
	}
	for key := range snapshots {
		if e = svc.Store.Delete(ctx, key); e != nil {
			t.Fatal(e)
		}
	}
	for range 2 {
		if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
			t.Fatal(e)
		}
	}
	for key, want := range snapshots {
		got, e := svc.Store.Stat(ctx, key)
		if e != nil {
			t.Fatalf("font runtime copy was not restored at its original key: %v", e)
		}
		if got.SHA256 != want.SHA256 || got.Size != want.Size {
			t.Fatalf("restored font differs from original: %s", key)
		}
	}
	after, e := svc.ListFonts(ctx, reader)
	if e != nil {
		t.Fatal(e)
	}
	if !reflect.DeepEqual(after, expected) {
		t.Fatal("recovery changed catalogue versions, URLs or publication state")
	}
	var versions int
	if e = svc.DB.QueryRow("SELECT COUNT(*) FROM asset_versions").Scan(&versions); e != nil || versions != len(before) {
		t.Fatalf("recovery added versions: %d %v", versions, e)
	}
}

func TestBuiltinFontsRecoveryRejectsAnUnavailableHistoricalHash(t *testing.T) {
	svc, ctx := builtinService(t)
	var key storage.Key
	if e := svc.DB.QueryRow("SELECT normalized_key FROM asset_versions WHERE asset_id='builtin-inter-400' AND version=1").Scan(&key); e != nil {
		t.Fatal(e)
	}
	if e := svc.Store.Delete(ctx, key); e != nil {
		t.Fatal(e)
	}
	// Simulate an old immutable version whose exact bytes are no longer bundled.
	unavailable := strings.Repeat("0", 64)
	if _, e := svc.DB.Exec("UPDATE asset_versions SET original_sha256=?,normalized_sha256=? WHERE asset_id='builtin-inter-400' AND version=1", unavailable, unavailable); e != nil {
		t.Fatal(e)
	}
	if e := svc.BootstrapFonts(ctx, repoRoot(t)); e == nil {
		t.Fatal("bootstrap silently accepted a missing font with no exact source")
	}
	if _, e := svc.Store.Open(ctx, key); !errors.Is(e, os.ErrNotExist) {
		t.Fatalf("bootstrap substituted different bytes for an immutable version: %v", e)
	}
	var sha string
	if e := svc.DB.QueryRow("SELECT normalized_sha256 FROM asset_versions WHERE asset_id='builtin-inter-400' AND version=1").Scan(&sha); e != nil || sha != unavailable {
		t.Fatal("bootstrap rewrote immutable metadata")
	}
}

func TestBuiltinFontsRecoveryDoesNotOverwriteAnExistingCorruptFile(t *testing.T) {
	svc, ctx := builtinService(t)
	var key storage.Key
	if e := svc.DB.QueryRow("SELECT normalized_key FROM asset_versions WHERE asset_id='builtin-inter-400' AND version=1").Scan(&key); e != nil {
		t.Fatal(e)
	}
	if e := svc.Store.Delete(ctx, key); e != nil {
		t.Fatal(e)
	}
	damaged := []byte("existing damaged font")
	if _, e := svc.Store.Put(ctx, key, bytes.NewReader(damaged)); e != nil {
		t.Fatal(e)
	}
	if e := svc.BootstrapFonts(ctx, repoRoot(t)); e == nil {
		t.Fatal("bootstrap failed to report font corruption")
	}
	r, e := svc.Store.Open(ctx, key)
	if e != nil {
		t.Fatal(e)
	}
	defer r.Close()
	got, e := io.ReadAll(r)
	if e != nil || !bytes.Equal(got, damaged) {
		t.Fatal("bootstrap overwrote an existing immutable file")
	}
}

func TestBuiltinFontsRecoveryRestoresReferencedOldVersions(t *testing.T) {
	svc, ctx := builtinService(t)
	var oldKey storage.Key
	if e := svc.DB.QueryRow("SELECT normalized_key FROM asset_versions WHERE asset_id='builtin-inter-400' AND version=1").Scan(&oldKey); e != nil {
		t.Fatal(e)
	}
	original, e := svc.Store.Stat(ctx, oldKey)
	if e != nil {
		t.Fatal(e)
	}
	r, e := svc.Store.Open(ctx, oldKey)
	if e != nil {
		t.Fatal(e)
	}
	newKey := storage.NewKey("fonts")
	_, e = svc.Store.Put(ctx, newKey, r)
	r.Close()
	if e != nil {
		t.Fatal(e)
	}
	// Current catalogue/asset version and old project references can diverge.
	if _, e = svc.DB.Exec(`INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,mime,original_size,normalized_size,original_sha256,normalized_sha256,metadata)
 SELECT asset_id,2,?,?,mime,original_size,normalized_size,original_sha256,normalized_sha256,metadata FROM asset_versions WHERE asset_id='builtin-inter-400' AND version=1`, newKey, newKey); e != nil {
		t.Fatal(e)
	}
	if _, e = svc.DB.Exec("UPDATE assets SET current_version=2 WHERE id='builtin-inter-400'"); e != nil {
		t.Fatal(e)
	}
	if e = svc.Store.Delete(ctx, oldKey); e != nil {
		t.Fatal(e)
	}
	if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
		t.Fatal(e)
	}
	restored, e := svc.Store.Stat(ctx, oldKey)
	if e != nil || restored.SHA256 != original.SHA256 {
		t.Fatalf("old project font version was not restored: %v", e)
	}
	var current int
	if e = svc.DB.QueryRow("SELECT current_version FROM assets WHERE id='builtin-inter-400'").Scan(&current); e != nil || current != 2 {
		t.Fatal("recovery changed the current font version")
	}
	if _, e = svc.Store.Stat(ctx, newKey); e != nil {
		t.Fatal("recovery removed the current font version")
	}
}
