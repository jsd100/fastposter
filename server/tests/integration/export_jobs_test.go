package integration_test

import (
	"context"
	"encoding/json"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projectdeletions"
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

func deletionCode(err error) string {
	var known *domain.Error
	if errors.As(err, &known) {
		return known.Code
	}
	return ""
}

func TestAcceptVersusRestore(t *testing.T) {
	_, p, id := exportService(t)
	ctx := context.Background()
	if e := p.SoftDelete(ctx, projectOwner(), id); e != nil {
		t.Fatal(e)
	}
	deletions := projectdeletions.NewService(p.DB, p.Store)
	barrier, e := p.DB.Begin()
	if e != nil {
		t.Fatal(e)
	}
	defer barrier.Rollback()
	var locked string
	if e = barrier.QueryRow("SELECT id FROM projects WHERE id=? FOR UPDATE", id).Scan(&locked); e != nil {
		t.Fatal(e)
	}
	type deletionOutcome struct {
		task projectdeletions.Task
		err  error
	}
	start := make(chan struct{})
	acceptCh := make(chan deletionOutcome, 1)
	restoreCh := make(chan error, 1)
	go func() {
		<-start
		task, e := deletions.Accept(ctx, projectOwner(), projectdeletions.OwnerScope, id)
		acceptCh <- deletionOutcome{task, e}
	}()
	go func() {
		<-start
		_, e := p.Restore(ctx, projectOwner(), id)
		restoreCh <- e
	}()
	close(start)
	time.Sleep(150 * time.Millisecond)
	if e = barrier.Commit(); e != nil {
		t.Fatal(e)
	}
	accepted, restoreErr := <-acceptCh, <-restoreCh
	if accepted.err == nil && restoreErr == nil {
		t.Fatal("accept and restore both succeeded")
	}
	if accepted.err != nil && restoreErr != nil {
		t.Fatalf("neither accept nor restore succeeded: accept=%v restore=%v", accepted.err, restoreErr)
	}
	var nProjects, nTasks, nRevisions int
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM projects WHERE id=?", id).Scan(&nProjects); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM project_deletions WHERE project_id=?", id).Scan(&nTasks); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM project_revisions WHERE project_id=?", id).Scan(&nRevisions); e != nil {
		t.Fatal(e)
	}
	var restored int
	if nProjects == 1 {
		if e = p.DB.QueryRow("SELECT deleted_at IS NULL FROM projects WHERE id=?", id).Scan(&restored); e != nil {
			t.Fatal(e)
		}
	}
	if accepted.err == nil {
		if deletionCode(restoreErr) != "NOT_FOUND" {
			t.Fatalf("restore lost the race but returned %v", restoreErr)
		}
		if nProjects != 0 || nTasks != 1 || nRevisions != 0 {
			t.Fatalf("deleted project left fragments: projects=%d tasks=%d revisions=%d", nProjects, nTasks, nRevisions)
		}
	} else {
		if deletionCode(accepted.err) != "CONFLICT" {
			t.Fatalf("accept lost the race but returned %v", accepted.err)
		}
		if nProjects != 1 || nTasks != 0 || nRevisions != 1 || restored != 1 {
			t.Fatalf("won restore left fragments: projects=%d tasks=%d revisions=%d restored=%d", nProjects, nTasks, nRevisions, restored)
		}
	}
}

func TestAcceptVersusExportCreate(t *testing.T) {
	s, p, id := exportService(t)
	ctx := context.Background()
	deletions := projectdeletions.NewService(p.DB, p.Store)
	barrier, e := p.DB.Begin()
	if e != nil {
		t.Fatal(e)
	}
	defer barrier.Rollback()
	var locked string
	if e = barrier.QueryRow("SELECT id FROM users WHERE id='u1' FOR UPDATE").Scan(&locked); e != nil {
		t.Fatal(e)
	}
	if e = p.SoftDelete(ctx, projectOwner(), id); e != nil {
		t.Fatal(e)
	}
	start := make(chan struct{})
	createCh := make(chan error, 1)
	acceptCh := make(chan error, 1)
	go func() {
		<-start
		_, e := s.Create(ctx, projectOwner(), id, "1", "racing-export")
		createCh <- e
	}()
	go func() {
		<-start
		_, e := deletions.Accept(ctx, projectOwner(), projectdeletions.OwnerScope, id)
		acceptCh <- e
	}()
	close(start)
	time.Sleep(150 * time.Millisecond)
	if e = barrier.Commit(); e != nil {
		t.Fatal(e)
	}
	createErr, acceptErr := <-createCh, <-acceptCh
	if deletionCode(createErr) != "NOT_FOUND" {
		t.Fatalf("export created for a trashed project: %v", createErr)
	}
	if acceptErr != nil {
		t.Fatalf("accept did not win after the project was trashed: %v", acceptErr)
	}
	var nProjects, nJobs, nRefs int
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM projects WHERE id=?", id).Scan(&nProjects); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM export_jobs WHERE project_id=?", id).Scan(&nJobs); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_id=?", id).Scan(&nRefs); e != nil {
		t.Fatal(e)
	}
	if nProjects != 0 || nJobs != 0 || nRefs != 0 {
		t.Fatalf("deleted project kept export data: projects=%d jobs=%d refs=%d", nProjects, nJobs, nRefs)
	}
}

func TestAcceptVersusClaim(t *testing.T) {
	s, p, id := exportService(t)
	ctx := context.Background()
	deletions := projectdeletions.NewService(p.DB, p.Store)
	job, e := s.Create(ctx, projectOwner(), id, "1", "racing-claim")
	if e != nil {
		t.Fatal(e)
	}
	if e = p.SoftDelete(ctx, projectOwner(), id); e != nil {
		t.Fatal(e)
	}
	barrier, e := p.DB.Begin()
	if e != nil {
		t.Fatal(e)
	}
	defer barrier.Rollback()
	var locked string
	if e = barrier.QueryRow("SELECT id FROM users WHERE id='u1' FOR UPDATE").Scan(&locked); e != nil {
		t.Fatal(e)
	}
	now := time.Now().UTC()
	start := make(chan struct{})
	claimCh := make(chan *exports.Lease, 1)
	claimErrCh := make(chan error, 1)
	acceptCh := make(chan error, 1)
	go func() {
		<-start
		lease, e := s.Claim(ctx, "racing-worker", now)
		claimCh <- lease
		claimErrCh <- e
	}()
	go func() {
		<-start
		_, e := deletions.Accept(ctx, projectOwner(), projectdeletions.OwnerScope, id)
		acceptCh <- e
	}()
	close(start)
	time.Sleep(150 * time.Millisecond)
	if e = barrier.Commit(); e != nil {
		t.Fatal(e)
	}
	lease, claimErr, acceptErr := <-claimCh, <-claimErrCh, <-acceptCh
	if claimErr != nil || lease == nil || lease.Job.ID != job.ID {
		t.Fatalf("claim lost its job: lease=%v err=%v", lease, claimErr)
	}
	if deletionCode(acceptErr) != "CONFLICT" {
		t.Fatalf("accept ran while a claim was active: %v", acceptErr)
	}
	var nTasks, nJobs, nProjects int
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM project_deletions WHERE project_id=?", id).Scan(&nTasks); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM export_jobs WHERE id=?", job.ID).Scan(&nJobs); e != nil {
		t.Fatal(e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM projects WHERE id=?", id).Scan(&nProjects); e != nil {
		t.Fatal(e)
	}
	if nTasks != 0 || nJobs != 1 || nProjects != 1 {
		t.Fatalf("claim race left inconsistent rows: tasks=%d jobs=%d projects=%d", nTasks, nJobs, nProjects)
	}
	if e = s.Complete(ctx, *lease, "results/race", "previews/race", 10, now.Add(time.Second)); e != nil {
		t.Fatal(e)
	}
	if _, e = deletions.Accept(ctx, projectOwner(), projectdeletions.OwnerScope, id); e != nil {
		t.Fatalf("accept after completed export failed: %v", e)
	}
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM export_jobs WHERE id=?", job.ID).Scan(&nJobs); e != nil {
		t.Fatal(e)
	}
	var nRefs int
	if e = p.DB.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE owner_id=?", job.ID).Scan(&nRefs); e != nil {
		t.Fatal(e)
	}
	if nJobs != 0 || nRefs != 0 {
		t.Fatalf("completed export survived permanent deletion: jobs=%d refs=%d", nJobs, nRefs)
	}
}
