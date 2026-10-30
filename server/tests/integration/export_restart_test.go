package integration_test

import (
	"context"
	"encoding/json"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func nativeExportRestart(t *testing.T, s *exports.Service, job exports.Job, root string) {
	t.Helper()
	ctx := context.Background()
	directory := t.TempDir()
	store, e := storage.NewLocal(directory)
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	var frozen projects.RenderSnapshot
	if e = json.Unmarshal(job.Snapshot, &frozen); e != nil {
		t.Fatal(e)
	}
	keys := []storage.Key{frozen.Background.Key}
	for _, font := range frozen.Fonts {
		keys = append(keys, font.Key)
	}
	for _, key := range keys {
		r, e := s.Store.Open(ctx, key)
		if e != nil {
			t.Fatal(e)
		}
		_, e = store.Put(ctx, key, r)
		r.Close()
		if e != nil {
			t.Fatal(e)
		}
	}
	config, e := testutil.ValidateTestDSN(os.Getenv("FASTPOSTER_TEST_MYSQL_DSN"))
	if e != nil {
		t.Fatal(e)
	}
	var dbName string
	if e = s.DB.QueryRow("SELECT DATABASE()").Scan(&dbName); e != nil {
		t.Fatal(e)
	}
	config.DBName = dbName
	binary := filepath.Join(t.TempDir(), "export-worker")
	build := exec.Command("go", "build", "-o", binary, "./server/cmd/export-worker")
	build.Dir = root
	if output, e := build.CombinedOutput(); e != nil {
		t.Fatalf("worker build failed: %v %s", e, output)
	}
	start := func() (*exec.Cmd, chan error) {
		t.Helper()
		cmd := exec.Command(binary)
		cmd.Dir = root
		cmd.Env = append(os.Environ(), "MYSQL_DSN="+config.FormatDSN(), "APP_DATA_DIR="+directory)
		if e = cmd.Start(); e != nil {
			t.Fatal(e)
		}
		done := make(chan error, 1)
		go func() { done <- cmd.Wait() }()
		return cmd, done
	}
	first, firstDone := start()
	firstStopped := false
	defer func() {
		if !firstStopped {
			first.Process.Kill()
			<-firstDone
		}
	}()
	deadline := time.Now().Add(10 * time.Second)
	for {
		current, e := s.Get(ctx, projectOwner(), job.ID)
		if e != nil {
			t.Fatal(e)
		}
		if current.State == "running" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("native worker never claimed job")
		}
		time.Sleep(time.Millisecond)
	}
	if e = first.Process.Signal(os.Interrupt); e != nil {
		t.Fatal(e)
	}
	select {
	case e = <-firstDone:
		firstStopped = true
		if e != nil {
			t.Fatal(e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not stop")
	}
	interrupted, e := s.Get(ctx, projectOwner(), job.ID)
	if e != nil || interrupted.State != "running" {
		t.Fatalf("interrupted job should retain recoverable lease: %s %v", interrupted.State, e)
	}
	if _, e = s.DB.Exec("UPDATE export_jobs SET lease_until=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?", job.ID); e != nil {
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
		current, e := s.Get(ctx, projectOwner(), job.ID)
		if e != nil {
			t.Fatal(e)
		}
		if current.State == "succeeded" {
			if current.Attempts != 2 {
				t.Fatal("restart did not use a new attempt")
			}
			return
		}
		if current.State == "failed" || time.Now().After(deadline) {
			t.Fatalf("restart did not recover export: %s %s", current.State, current.ErrorMessage)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
