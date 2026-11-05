package assets

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func builtinFontFixture(t *testing.T) (*Service, *sql.DB) {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	return NewService(db, store, nil, t.TempDir()), db
}

func seedRestorableFont(t *testing.T, db *sql.DB, content []byte) (storage.Key, string, string) {
	t.Helper()
	sum := sha256.Sum256(content)
	hash := hex.EncodeToString(sum[:])
	key := storage.NewKey("fonts")
	if _, e := db.Exec("INSERT INTO assets(id,kind,name) VALUES('builtin-test','font','test.ttf')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,mime,original_size,normalized_size,original_sha256,normalized_sha256) VALUES('builtin-test',1,?,?,'font/ttf',?,?,?,?)", string(key), string(key), len(content), len(content), hash, hash); e != nil {
		t.Fatal(e)
	}
	source := filepath.Join(t.TempDir(), "source.ttf")
	if e := os.WriteFile(source, content, 0600); e != nil {
		t.Fatal(e)
	}
	return key, hash, source
}

func TestRestoreBuiltinFontFilesReusesRecordedKey(t *testing.T) {
	svc, db := builtinFontFixture(t)
	ctx := context.Background()
	content := []byte("exact builtin font bytes")
	key, hash, source := seedRestorableFont(t, db, content)
	conn, e := db.Conn(ctx)
	if e != nil {
		t.Fatal(e)
	}
	defer conn.Close()
	if e = svc.restoreBuiltinFontFiles(ctx, conn, "builtin-test", map[string]string{hash: source}); e != nil {
		t.Fatal(e)
	}
	reader, e := svc.Store.Open(ctx, key)
	if e != nil {
		t.Fatalf("restored file is missing at the recorded key: %v", e)
	}
	defer reader.Close()
	restored, e := io.ReadAll(reader)
	if e != nil {
		t.Fatal(e)
	}
	if !bytes.Equal(restored, content) {
		t.Fatal("restored bytes differ from the recorded version")
	}
}

func TestRestoreBuiltinFontFilesStopsWhenRetirementWins(t *testing.T) {
	svc, db := builtinFontFixture(t)
	ctx := context.Background()
	content := []byte("retired builtin font bytes")
	key, hash, source := seedRestorableFont(t, db, content)
	conn, e := db.Conn(ctx)
	if e != nil {
		t.Fatal(e)
	}
	defer conn.Close()
	retirement, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer retirement.Rollback()
	for _, statement := range []string{
		"SELECT 1 FROM assets WHERE id='builtin-test' FOR UPDATE",
		"SELECT 1 FROM asset_versions WHERE asset_id='builtin-test' AND version=1 FOR UPDATE",
	} {
		if _, e = retirement.ExecContext(ctx, statement); e != nil {
			t.Fatal(e)
		}
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM asset_versions WHERE asset_id='builtin-test' AND version=1"); e != nil {
		t.Fatal(e)
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM assets WHERE id='builtin-test'"); e != nil {
		t.Fatal(e)
	}
	restored := make(chan error, 1)
	go func() {
		restored <- svc.restoreBuiltinFontFiles(ctx, conn, "builtin-test", map[string]string{hash: source})
	}()
	select {
	case e = <-restored:
		t.Fatalf("restore ignored an in-flight retirement: %v", e)
	case <-time.After(250 * time.Millisecond):
	}
	if e = retirement.Commit(); e != nil {
		t.Fatal(e)
	}
	select {
	case e = <-restored:
		var known *domain.Error
		if !errors.As(e, &known) || known.Code != "MISSING_FONT" {
			t.Fatalf("restore after retirement = %v, want MISSING_FONT", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("restore did not observe the retirement commit")
	}
	if _, e = svc.Store.Open(ctx, key); !errors.Is(e, os.ErrNotExist) {
		t.Fatalf("retired font file was recreated: %v", e)
	}
}
