package migrations_test

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"fastposter/server/internal/testutil"
	"fastposter/server/migrations"
)

func applyV1(t *testing.T, db *sql.DB) {
	t.Helper()
	raw, e := os.ReadFile("000001_initial.up.sql")
	if e != nil {
		t.Fatal(e)
	}
	for _, statement := range strings.Split(string(raw), ";") {
		if sql := strings.TrimSpace(statement); sql != "" {
			if _, e = db.Exec(sql); e != nil {
				t.Fatalf("apply v1 schema: %v", e)
			}
		}
	}
	if _, e = db.Exec("CREATE TABLE IF NOT EXISTS _schema_migrations (version INT PRIMARY KEY, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO _schema_migrations(version) VALUES(1)"); e != nil {
		t.Fatal(e)
	}
}

func schemaVersion(t *testing.T, db *sql.DB) int {
	t.Helper()
	var version int
	if e := db.QueryRow("SELECT COALESCE(MAX(version),0) FROM _schema_migrations").Scan(&version); e != nil {
		t.Fatal(e)
	}
	return version
}

func tableExists(t *testing.T, db *sql.DB, name string) bool {
	t.Helper()
	var count int
	if e := db.QueryRow("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", name).Scan(&count); e != nil {
		t.Fatal(e)
	}
	return count == 1
}

func TestUpV1ToV2PreservesProjects(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	ctx := context.Background()
	if e := migrations.Down(ctx, db); e != nil {
		t.Fatal(e)
	}
	applyV1(t, db)
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('m-u1','migration','migration','hash')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO projects(id,owner_id,title,document,width,height,deleted_at) VALUES('m-p1','m-u1','kept',JSON_OBJECT('schemaVersion',1),1200,1600,UTC_TIMESTAMP(6))"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO project_revisions(project_id,revision,document) VALUES('m-p1',1,JSON_OBJECT('schemaVersion',1))"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO assets(id,owner_id,kind,name) VALUES('m-a1','m-u1','image','bg')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,mime,original_size,normalized_size,original_sha256,normalized_sha256) VALUES('m-a1',1,'k','k','image/png',1,1,REPEAT('a',64),REPEAT('a',64))"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) VALUES('project','m-p1','m-a1',1)"); e != nil {
		t.Fatal(e)
	}
	if e := migrations.Up(ctx, db); e != nil {
		t.Fatal(e)
	}
	version := schemaVersion(t, db)
	var projectCount, revisionCount, refCount int
	if e := db.QueryRow("SELECT COUNT(*) FROM projects").Scan(&projectCount); e != nil {
		t.Fatal(e)
	}
	if e := db.QueryRow("SELECT COUNT(*) FROM project_revisions").Scan(&revisionCount); e != nil {
		t.Fatal(e)
	}
	if e := db.QueryRow("SELECT COUNT(*) FROM asset_refs").Scan(&refCount); e != nil {
		t.Fatal(e)
	}
	if version != migrations.CurrentVersion || projectCount != 1 || revisionCount != 1 || refCount != 1 {
		t.Fatalf("migration lost existing project: version=%d projects=%d revisions=%d refs=%d", version, projectCount, revisionCount, refCount)
	}
	for _, table := range []string{"project_deletions", "project_deletion_assets", "project_deletion_files"} {
		if !tableExists(t, db, table) {
			t.Fatalf("schema v2 table missing after upgrade: %s", table)
		}
	}
}

func TestUpV2Idempotent(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	ctx := context.Background()
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('m-u1','migration','migration','hash')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO project_deletions(id,project_id,owner_id,actor_id,title,state) VALUES('m-d1','m-p1','m-u1','m-u1','pending task','pending')"); e != nil {
		t.Fatal(e)
	}
	for range 2 {
		if e := migrations.Up(ctx, db); e != nil {
			t.Fatalf("repeat up: %v", e)
		}
	}
	version := schemaVersion(t, db)
	var migrationRows, taskRows int
	if e := db.QueryRow("SELECT COUNT(*) FROM _schema_migrations").Scan(&migrationRows); e != nil {
		t.Fatal(e)
	}
	if e := db.QueryRow("SELECT COUNT(*) FROM project_deletions").Scan(&taskRows); e != nil {
		t.Fatal(e)
	}
	if version != migrations.CurrentVersion || migrationRows != migrations.CurrentVersion || taskRows != 1 {
		t.Fatalf("repeated migration changed state: version=%d rows=%d tasks=%d", version, migrationRows, taskRows)
	}
}

func TestDownRemovesDeletionTablesBeforeAssets(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	ctx := context.Background()
	for _, table := range []string{"users", "projects", "project_deletions"} {
		if !tableExists(t, db, table) {
			t.Fatalf("expected table before down: %s", table)
		}
	}
	if e := migrations.Down(ctx, db); e != nil {
		t.Fatalf("down with deletion tables: %v", e)
	}
	for _, table := range []string{
		"project_deletions", "project_deletion_assets", "project_deletion_files",
		"projects", "project_revisions", "assets", "asset_versions", "asset_refs", "users", "_schema_migrations",
	} {
		if tableExists(t, db, table) {
			t.Fatalf("down left table behind: %s", table)
		}
	}
}
