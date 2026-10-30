package integration_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fastposter/server/internal/testutil"
	"fastposter/server/migrations"
	"sync"
	"sync/atomic"
	"testing"
)

func TestMigrationRoundTripAndEmojiJSON(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	ctx := context.Background()
	if e := migrations.Up(ctx, db); e != nil {
		t.Fatal(e)
	}
	_, e := db.Exec("INSERT INTO users (id,username,username_normalized,password_hash) VALUES ('u1','海报🙂','poster','not-a-real-hash')")
	if e != nil {
		t.Fatal(e)
	}
	var name string
	if e = db.QueryRow("SELECT username FROM users WHERE id='u1'").Scan(&name); e != nil || name != "海报🙂" {
		t.Fatal("utf8mb4 roundtrip failed")
	}
	if _, e = db.Exec("INSERT INTO projects (id,owner_id,title,document,width,height) VALUES ('json1','u1','JSON',?,1200,1600)", `{"note":"海报🙂"}`); e != nil {
		t.Fatal(e)
	}
	var encoded string
	if e = db.QueryRow("SELECT document FROM projects WHERE id='json1'").Scan(&encoded); e != nil {
		t.Fatal(e)
	}
	var decoded map[string]string
	if e = json.Unmarshal([]byte(encoded), &decoded); e != nil || decoded["note"] != "海报🙂" {
		t.Fatal("JSON unicode changed")
	}
	if e = migrations.Down(ctx, db); e != nil {
		t.Fatal(e)
	}
	if e = migrations.Up(ctx, db); e != nil {
		t.Fatal(e)
	}
}
func seedProject(t *testing.T, db *sql.DB) {
	t.Helper()
	if _, e := db.Exec("INSERT INTO users (id,username,username_normalized,password_hash) VALUES ('u1','test','test','not-a-real-hash')"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("INSERT INTO projects (id,owner_id,title,document,revision,width,height) VALUES ('p1','u1','test',JSON_OBJECT('schemaVersion',1),1,1200,1600)"); e != nil {
		t.Fatal(e)
	}
}
func TestConcurrentRevisionCAS(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	seedProject(t, db)
	var wg sync.WaitGroup
	var wins atomic.Int32
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, e := db.Exec("UPDATE projects SET revision=revision+1 WHERE id='p1' AND revision=1")
			if e != nil {
				t.Error(e)
				return
			}
			n, _ := res.RowsAffected()
			wins.Add(int32(n))
		}()
	}
	wg.Wait()
	if wins.Load() != 1 {
		t.Fatalf("CAS won %d times", wins.Load())
	}
}
func TestQueueClaimSkipsLockedRows(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	seedProject(t, db)
	for _, id := range []string{"j1", "j2"} {
		if _, e := db.Exec("INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key) VALUES(?,'u1','p1',1,JSON_OBJECT(),'v1','hash',?)", id, id); e != nil {
			t.Fatal(e)
		}
	}
	ctx := context.Background()
	a, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer a.Rollback()
	b, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer b.Rollback()
	query := "SELECT id FROM export_jobs WHERE state='queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED"
	var x, y string
	if e = a.QueryRowContext(ctx, query).Scan(&x); e != nil {
		t.Fatal(e)
	}
	if e = b.QueryRowContext(ctx, query).Scan(&y); e != nil {
		t.Fatal(e)
	}
	if x == y || x != "j1" || y != "j2" {
		t.Fatalf("not skipped: %s %s", x, y)
	}
}
