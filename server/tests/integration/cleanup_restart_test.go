package integration_test

import (
	"context"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCleanupRestartCompletesDurableTask(t *testing.T) {
	ctx := context.Background()
	root := repoRoot(t)
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	config, e := testutil.ValidateTestDSN(os.Getenv("FASTPOSTER_TEST_MYSQL_DSN"))
	if e != nil {
		t.Fatal(e)
	}
	var dbName string
	if e = db.QueryRow("SELECT DATABASE()").Scan(&dbName); e != nil {
		t.Fatal(e)
	}
	config.DBName = dbName
	owner := auth.Principal{UserID: "cleanup-u1", Role: "user"}
	if _, e = db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES('cleanup-u1','cleanup one','cleanup one','disabled')"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO projects(id,owner_id,title,document,revision,width,height,deleted_at) VALUES('cleanup-p1','cleanup-u1','待清理作品','{}',1,1200,1600,UTC_TIMESTAMP(6))"); e != nil {
		t.Fatal(e)
	}
	dataDir := t.TempDir()
	store, e := storage.NewLocal(dataDir)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	resultKey := storage.NewKey("exports")
	if _, e = store.Put(ctx, resultKey, strings.NewReader("cleanup result")); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("INSERT INTO export_jobs(id,user_id,project_id,revision,snapshot,renderer_version,content_hash,idempotency_key,state,result_key,result_size) VALUES('cleanup-j1','cleanup-u1','cleanup-p1',1,'{}','test',?,'cleanup-key','succeeded',?,14)", strings.Repeat("a", 64), string(resultKey)); e != nil {
		t.Fatal(e)
	}
	deletions := projectdeletions.NewService(db, store)
	task, e := deletions.Accept(ctx, owner, projectdeletions.OwnerScope, "cleanup-p1")
	if e != nil {
		t.Fatal(e)
	}
	var files int
	if e = db.QueryRow("SELECT COUNT(*) FROM project_deletion_files WHERE task_id=?", task.ID).Scan(&files); e != nil || files != 1 {
		t.Fatalf("accept did not capture the export file: %d %v", files, e)
	}
	binary := filepath.Join(t.TempDir(), "cleanup-worker")
	build := exec.Command("go", "build", "-o", binary, "./server/cmd/cleanup-worker")
	build.Dir = root
	if output, e := build.CombinedOutput(); e != nil {
		t.Fatalf("cleanup worker build failed: %v %s", e, output)
	}
	exportsDir := filepath.Join(dataDir, "exports")
	start := func() (*exec.Cmd, chan error) {
		t.Helper()
		cmd := exec.Command(binary)
		cmd.Dir = root
		cmd.Env = recoveryEnv(map[string]string{"MYSQL_DSN": config.FormatDSN(), "APP_DATA_DIR": dataDir})
		if e = cmd.Start(); e != nil {
			t.Fatal(e)
		}
		done := make(chan error, 1)
		go func() { done <- cmd.Wait() }()
		return cmd, done
	}
	stop := func(cmd *exec.Cmd, done chan error) {
		t.Helper()
		if e = cmd.Process.Signal(os.Interrupt); e != nil {
			t.Fatal(e)
		}
		select {
		case e = <-done:
			if e != nil {
				t.Fatal(e)
			}
		case <-time.After(5 * time.Second):
			cmd.Process.Kill()
			<-done
			t.Fatal("cleanup worker did not stop")
		}
	}
	// A failed unlink must be persisted as a retryable task instead of being
	// lost, so the restarted worker can finish the same durable work.
	if e = os.Chmod(exportsDir, 0500); e != nil {
		t.Fatal(e)
	}
	first, firstDone := start()
	firstStopped := false
	defer func() {
		if !firstStopped {
			first.Process.Kill()
			<-firstDone
		}
	}()
	deadline := time.Now().Add(15 * time.Second)
	for {
		var state, code string
		if e = db.QueryRow("SELECT state,COALESCE(safe_error_code,'') FROM project_deletions WHERE id=?", task.ID).Scan(&state, &code); e != nil {
			t.Fatal(e)
		}
		if state == "retry_wait" {
			if code != "CLEANUP_FAILED" {
				t.Fatalf("unexpected cleanup error code: %s", code)
			}
			break
		}
		if state == "completed" {
			t.Fatal("cleanup unexpectedly succeeded despite the read-only directory")
		}
		if time.Now().After(deadline) {
			t.Fatalf("cleanup worker never recorded a retry: %s", state)
		}
		time.Sleep(20 * time.Millisecond)
	}
	stop(first, firstDone)
	firstStopped = true
	if _, e = store.Stat(ctx, resultKey); e != nil {
		t.Fatalf("failed cleanup removed the file: %v", e)
	}
	if e = os.Chmod(exportsDir, 0700); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE project_deletions SET next_attempt_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?", task.ID); e != nil {
		t.Fatal(e)
	}
	second, secondDone := start()
	defer func() {
		second.Process.Signal(os.Interrupt)
		select {
		case <-secondDone:
		case <-time.After(5 * time.Second):
			second.Process.Kill()
			<-secondDone
		}
	}()
	deadline = time.Now().Add(15 * time.Second)
	for {
		var state, message string
		var attempts int
		var titleCleared bool
		if e = db.QueryRow("SELECT state,attempts,title IS NULL,COALESCE(internal_error,'') FROM project_deletions WHERE id=?", task.ID).Scan(&state, &attempts, &titleCleared, &message); e != nil {
			t.Fatal(e)
		}
		if state == "completed" {
			if attempts != 2 {
				t.Fatalf("restart did not use a new attempt: %d", attempts)
			}
			if !titleCleared {
				t.Fatal("completed cleanup kept the deleted project title")
			}
			break
		}
		if (state == "retry_wait" && attempts >= 2) || state == "failed" || time.Now().After(deadline) {
			t.Fatalf("restarted cleanup did not complete: %s %s", state, message)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, e = store.Stat(ctx, resultKey); !errors.Is(e, os.ErrNotExist) {
		t.Fatalf("restarted cleanup did not remove the file: %v", e)
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM project_deletion_files WHERE task_id=?", task.ID).Scan(&files); e != nil || files != 0 {
		t.Fatalf("completed cleanup kept file work: %d %v", files, e)
	}
}
