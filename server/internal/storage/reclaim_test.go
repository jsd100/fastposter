package storage_test

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"fastposter/server/internal/storage"
)

func retireOne(t *testing.T, db *sql.DB, ref storage.AssetVersionRef) storage.ReclaimResult {
	t.Helper()
	ctx := context.Background()
	tx, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	result, e := storage.RetireUnreferencedVersion(ctx, tx, ref)
	if e != nil {
		tx.Rollback()
		t.Fatal(e)
	}
	if e = tx.Commit(); e != nil {
		t.Fatal(e)
	}
	return result
}

func TestRetirePreservesEveryReferenceKind(t *testing.T) {
	db, store, dir := gcFixture(t)
	if _, e := db.Exec("INSERT INTO projects(id,owner_id,title,document,revision,width,height) VALUES('p-retire','u1','t',JSON_OBJECT(),1,10,10)"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key) VALUES('j-retire','u1','p-retire',1,JSON_OBJECT(),'v1','h','i')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO resources(id,kind,title,created_by,current_version) VALUES('r-retire','copy','r','u1',1)"); e != nil {
		t.Fatal(e)
	}
	cases := []struct {
		name string
		ref  func(asset string)
	}{
		{"project", func(asset string) {
			mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project','p-retire',?,1)", asset)
		}},
		{"project-history", func(asset string) {
			mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project-history','p-retire',?,1)", asset)
		}},
		{"export", func(asset string) {
			mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('export','j-retire',?,1)", asset)
		}},
		{"resource", func(asset string) {
			mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('resource','r-retire',?,1)", asset)
		}},
		{"resource-version-ref", func(asset string) {
			mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('resource-version','r-retire:1',?,1)", asset)
		}},
		{"resource-version-only", func(asset string) {
			mustExec(t, db, "INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,body) VALUES('r-retire',1,?,1,'body')", asset)
		}},
	}
	for i, tc := range cases {
		id := fmt.Sprintf("a-ref-%d", i)
		asset := seedAsset(t, db, store, dir, id, "u1", 0)
		tc.ref(id)
		result := retireOne(t, db, storage.AssetVersionRef{AssetID: id, Version: 1})
		if result.Retired {
			t.Fatalf("%s: referenced asset version was retired", tc.name)
		}
		for _, key := range []storage.Key{asset.original, asset.normalized, asset.preview} {
			if !fileExists(t, store, key) {
				t.Fatalf("%s: referenced file was removed: %s", tc.name, key)
			}
		}
	}
}

func TestRetireOnlyOneVersion(t *testing.T) {
	db, store, dir := gcFixture(t)
	seedProjectRow(t, db, "p-two", "u1")
	asset := seedAsset(t, db, store, dir, "a-two", "u1", 0)
	ctx := context.Background()
	put := func(content string) (storage.Key, int64, string) {
		key := storage.NewKey("test-assets/v2")
		info, e := store.Put(ctx, key, strings.NewReader(content))
		if e != nil {
			t.Fatal(e)
		}
		return key, info.Size, info.SHA256
	}
	original, originalSize, originalHash := put("v2-original")
	normalized, normalizedSize, normalizedHash := put("v2-normalized")
	preview, previewSize, previewHash := put("v2-preview")
	mustExec(t, db, "INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,width,height,original_size,normalized_size,preview_size,original_sha256,normalized_sha256,metadata) VALUES('a-two',2,?,?,?,'image/png',1200,1600,?,?,?,?,?,'{}')",
		string(original), string(normalized), string(preview), originalSize, normalizedSize, previewSize, originalHash, normalizedHash)
	_ = previewHash
	mustExec(t, db, "INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project','p-two','a-two',1)")

	result := retireOne(t, db, storage.AssetVersionRef{AssetID: "a-two", Version: 2})
	if !result.Retired {
		t.Fatal("unreferenced version was not retired")
	}
	want := map[storage.Key]bool{original: true, normalized: true, preview: true}
	if len(result.Keys) != len(want) {
		t.Fatalf("retired keys = %v, want 3 unique keys", result.Keys)
	}
	for _, key := range result.Keys {
		if !want[key] {
			t.Fatalf("unexpected retired key %s", key)
		}
	}
	var versions, parents int
	db.QueryRow("SELECT COUNT(*) FROM asset_versions WHERE asset_id='a-two'").Scan(&versions)
	db.QueryRow("SELECT COUNT(*) FROM assets WHERE id='a-two'").Scan(&parents)
	if versions != 1 || parents != 1 {
		t.Fatalf("retiring one version changed others: versions=%d parents=%d", versions, parents)
	}
	if !fileExists(t, store, asset.normalized) {
		t.Fatal("version 1 file was removed")
	}

	mustExec(t, db, "DELETE FROM asset_refs WHERE owner_kind='project' AND owner_id='p-two'")
	result = retireOne(t, db, storage.AssetVersionRef{AssetID: "a-two", Version: 1})
	if !result.Retired {
		t.Fatal("last unreferenced version was not retired")
	}
	db.QueryRow("SELECT COUNT(*) FROM assets WHERE id='a-two'").Scan(&parents)
	if parents != 0 {
		t.Fatalf("parent asset survived its last version: %d", parents)
	}
}

func TestRetireUsesCurrentReferences(t *testing.T) {
	db, store, dir := gcFixture(t)
	seedProjectRow(t, db, "p-late", "u1")
	seedAsset(t, db, store, dir, "a-late", "u1", 0)
	ctx := context.Background()
	tx, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback()
	var seen int
	if e = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM asset_refs WHERE asset_id='a-late' AND asset_version=1").Scan(&seen); e != nil {
		t.Fatal(e)
	}
	if seen != 0 {
		t.Fatalf("unexpected initial references: %d", seen)
	}
	if _, e = db.Exec("INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project','p-late','a-late',1)"); e != nil {
		t.Fatal(e)
	}
	result, e := storage.RetireUnreferencedVersion(ctx, tx, storage.AssetVersionRef{AssetID: "a-late", Version: 1})
	if e != nil {
		t.Fatal(e)
	}
	if result.Retired {
		t.Fatal("retirement read a stale snapshot and ignored a committed reference")
	}
}

func TestSharedStorageKeyStaysLive(t *testing.T) {
	db, store, _ := gcFixture(t)
	seedProjectRow(t, db, "p-key", "u1")
	ctx := context.Background()
	shared := storage.NewKey("test-assets/shared")
	if _, e := store.Put(ctx, shared, strings.NewReader("shared")); e != nil {
		t.Fatal(e)
	}
	only := storage.NewKey("test-assets/only")
	if _, e := store.Put(ctx, only, strings.NewReader("only")); e != nil {
		t.Fatal(e)
	}
	// Asset A owns a unique original and the shared normalized file.
	if _, e := db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES('a-shared','u1','image','a'),('b-shared','u1','image','b')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,original_size,normalized_size,original_sha256,normalized_sha256) VALUES('a-shared',1,?,?,'','image/png',1,1,REPEAT('a',64),REPEAT('b',64))", string(only), string(shared)); e != nil {
		t.Fatal(e)
	}
	// Asset B uses the same key for original and normalized; duplicates must not repeat in the result.
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,preview_key,mime,original_size,normalized_size,original_sha256,normalized_sha256) VALUES('b-shared',1,?,?,'','image/png',1,1,REPEAT('c',64),REPEAT('d',64))", string(shared), string(shared)); e != nil {
		t.Fatal(e)
	}
	result := retireOne(t, db, storage.AssetVersionRef{AssetID: "a-shared", Version: 1})
	if !result.Retired {
		t.Fatal("unreferenced version was not retired")
	}
	if len(result.Keys) != 2 || result.Keys[0] != only || result.Keys[1] != shared {
		t.Fatalf("retired keys = %v, want [%s %s]", result.Keys, only, shared)
	}
	tx, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback()
	referenced, e := storage.StorageKeyReferenced(ctx, tx, shared)
	if e != nil {
		t.Fatal(e)
	}
	if !referenced {
		t.Fatal("shared key still used by another version was reported free")
	}
	referenced, e = storage.StorageKeyReferenced(ctx, tx, only)
	if e != nil {
		t.Fatal(e)
	}
	if referenced {
		t.Fatal("retired key still reported referenced")
	}
	mustExec(t, db, "INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,result_key) SELECT 'j-key','u1',id,1,JSON_OBJECT(),'v1','h','i','exports/key' FROM projects LIMIT 1")
	referenced, e = storage.StorageKeyReferenced(ctx, tx, "exports/key")
	if e != nil {
		t.Fatal(e)
	}
	if !referenced {
		t.Fatal("export result key was reported free")
	}
	if !fileExists(t, store, shared) {
		t.Fatal("shared file was removed")
	}
}

func mustExec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, e := db.Exec(query, args...); e != nil {
		t.Fatalf("%s: %v", query, e)
	}
}
