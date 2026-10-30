package integration_test

import (
	"context"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"testing"
	"time"
)

func exportService(t *testing.T) (*exports.Service, *projects.Service, string) {
	t.Helper()
	p, db, doc := projectService(t)
	a, e := p.Create(context.Background(), projectOwner(), "export", doc)
	if e != nil {
		t.Fatal(e)
	}
	return exports.NewService(db, p.Store, p), p, a.ID
}
func TestExportOneRunningTwoQueuedPerUser(t *testing.T) {
	s, _, id := exportService(t)
	ctx := context.Background()
	a, e := s.Create(ctx, projectOwner(), id, "1", "a")
	if e != nil {
		t.Fatal(e)
	}
	lease, e := s.Claim(ctx, "worker", time.Now().UTC())
	if e != nil || lease == nil || lease.Job.ID != a.ID {
		t.Fatal("claim failed", e)
	}
	for _, key := range []string{"b", "c"} {
		if _, e = s.Create(ctx, projectOwner(), id, "1", key); e != nil {
			t.Fatal(e)
		}
	}
	if _, e = s.Create(ctx, projectOwner(), id, "1", "d"); e == nil {
		t.Fatal("queue limit missing")
	}
	if next, e := s.Claim(ctx, "other", time.Now().UTC()); e != nil || next != nil {
		t.Fatal("second concurrent export for one user", e)
	}
	repeat, e := s.Create(ctx, projectOwner(), id, "1", "a")
	if e != nil || repeat.ID != a.ID {
		t.Fatal("idempotency failed", e)
	}
}
func TestExportStaleLeaseCannotPublishOrDeleteNewResult(t *testing.T) {
	s, _, id := exportService(t)
	ctx := context.Background()
	now := time.Now().UTC().Add(time.Second)
	job, e := s.Create(ctx, projectOwner(), id, "1", "a")
	if e != nil {
		t.Fatal(e)
	}
	old, e := s.Claim(ctx, "first", now)
	if e != nil {
		t.Fatal(e)
	}
	fresh, e := s.Claim(ctx, "second", now.Add(31*time.Second))
	if e != nil || fresh == nil || old.Token == fresh.Token {
		t.Fatal("expired lease not recovered", e)
	}
	if e = s.Complete(ctx, *old, "results/old", "previews/old", 100, now.Add(32*time.Second)); e == nil {
		t.Fatal("stale lease published")
	}
	if e = s.Complete(ctx, *fresh, "results/new", "previews/new", 120, now.Add(32*time.Second)); e != nil {
		t.Fatal(e)
	}
	current, e := s.Get(ctx, projectOwner(), job.ID)
	if e != nil || current.ResultKey != "results/new" || current.State != "succeeded" {
		t.Fatal("wrong result", e)
	}
	if e = s.Fail(ctx, *old, "FAILED", "old worker", now.Add(33*time.Second)); e == nil {
		t.Fatal("stale attempt changed current job")
	}
}
func TestExportCrashRecoveryAndMaxAttempts(t *testing.T) {
	s, _, id := exportService(t)
	ctx := context.Background()
	now := time.Now().UTC().Add(time.Second)
	job, e := s.Create(ctx, projectOwner(), id, "1", "crash")
	if e != nil {
		t.Fatal(e)
	}
	s.Claim(ctx, "one", now)
	s.Claim(ctx, "two", now.Add(31*time.Second))
	lease, e := s.Claim(ctx, "three", now.Add(62*time.Second))
	if e != nil || lease != nil {
		t.Fatal("third attempt allowed", e)
	}
	current, e := s.Get(ctx, projectOwner(), job.ID)
	if e != nil || current.State != "failed" || current.Attempts != 2 {
		t.Fatal("exhausted job not terminal", e)
	}
}
func TestExportSnapshotUnaffectedByLaterEdit(t *testing.T) {
	s, p, id := exportService(t)
	ctx := context.Background()
	job, e := s.Create(ctx, projectOwner(), id, "1", "snapshot")
	if e != nil {
		t.Fatal(e)
	}
	a, e := p.Get(ctx, projectOwner(), id)
	if e != nil {
		t.Fatal(e)
	}
	a.Document.TextBlocks[0].X = 100
	if _, e = p.Save(ctx, projectOwner(), id, "1", "new", a.Document); e != nil {
		t.Fatal(e)
	}
	var snapshot projects.RenderSnapshot
	if e = json.Unmarshal(job.Snapshot, &snapshot); e != nil || snapshot.Document.TextBlocks[0].X != 80 {
		t.Fatal("snapshot mutated", e)
	}
}
func TestExportPrivateDownloadAndSevenDayExpiry(t *testing.T) {
	s, _, id := exportService(t)
	ctx := context.Background()
	now := time.Now().UTC().Add(time.Second)
	job, e := s.Create(ctx, projectOwner(), id, "1", "private")
	if e != nil {
		t.Fatal(e)
	}
	lease, e := s.Claim(ctx, "worker", now)
	if e != nil {
		t.Fatal(e)
	}
	if e = s.Complete(ctx, *lease, "results/private", "previews/private", 10, now); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Get(ctx, auth.Principal{UserID: "u2", Role: "admin"}, job.ID); e == nil {
		t.Fatal("admin read another user's export")
	}
	s.DB.Exec("UPDATE export_jobs SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=?", job.ID)
	_, e = s.Get(ctx, projectOwner(), job.ID)
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "NOT_FOUND" {
		t.Fatal("expired result remained available", e)
	}
}
func TestExportRenewAcceptsUnchangedValidLeaseAndRejectsExpired(t *testing.T) {
	s, _, id := exportService(t)
	ctx := context.Background()
	if _, e := s.Create(ctx, projectOwner(), id, "1", "renew"); e != nil {
		t.Fatal(e)
	}
	now := time.Now().UTC().Truncate(time.Microsecond)
	lease, e := s.Claim(ctx, "worker", now)
	if e != nil || lease == nil {
		t.Fatal("claim failed", e)
	}
	if e = s.Renew(ctx, *lease, now); e != nil {
		t.Fatal("valid unchanged lease rejected", e)
	}
	if e = s.Renew(ctx, *lease, now.Add(31*time.Second)); e == nil {
		t.Fatal("expired lease renewed")
	}
}
