package projectdeletions

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"io/fs"
	"log"
	"time"
)

var errLeaseLost = errors.New("cleanup lease lost")

type Worker struct {
	Service *Service
	Writers *storage.WriterGate
	Paused  func() bool
	ID      string
}

func cleanupBackoff(attempts int) time.Duration {
	delay := 5 * time.Second
	for i := 1; i < attempts && delay < 5*time.Minute; i++ {
		delay *= 2
	}
	if delay > 5*time.Minute {
		delay = 5 * time.Minute
	}
	return delay
}

func (w *Worker) Run(ctx context.Context) error {
	for {
		if ctx.Err() != nil {
			return nil
		}
		ran, e := w.RunOnce(ctx, time.Now().UTC())
		if e != nil {
			if ctx.Err() != nil {
				return nil
			}
			log.Printf("project cleanup: %v", e)
		}
		if ran && e == nil {
			continue
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(time.Second):
		}
	}
}

// RunOnce executes at most one due task while holding a writer lease. It
// reports whether a task was executed; a persisted retry is still execution.
func (w *Worker) RunOnce(ctx context.Context, now time.Time) (bool, error) {
	if e := ctx.Err(); e != nil {
		return false, nil
	}
	if w.Paused != nil && w.Paused() {
		return false, nil
	}
	write, e := w.Writers.TryAcquire()
	if e != nil {
		if errors.Is(e, storage.ErrWritersPaused) {
			return false, nil
		}
		return false, e
	}
	defer write.Release()
	taskID, token, ok, e := w.claim(ctx, now)
	if e != nil || !ok {
		return false, e
	}
	if e = w.execute(ctx, taskID, token, now); e != nil {
		if errors.Is(e, errLeaseLost) || ctx.Err() != nil {
			return true, nil
		}
		if e = w.fail(ctx, taskID, token, e, now); e != nil && !errors.Is(e, errLeaseLost) {
			return true, e
		}
	}
	return true, nil
}

func (w *Worker) claim(ctx context.Context, now time.Time) (string, string, bool, error) {
	for attempt := 0; attempt < 5; attempt++ {
		var id string
		e := w.Service.DB.QueryRowContext(ctx, "SELECT id FROM project_deletions WHERE (state IN ('pending','retry_wait') AND next_attempt_at<=?) OR (state='running' AND lease_until<=?) ORDER BY next_attempt_at,created_at,id LIMIT 1", now, now).Scan(&id)
		if errors.Is(e, sql.ErrNoRows) {
			return "", "", false, nil
		}
		if e != nil {
			return "", "", false, e
		}
		tx, e := w.Service.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
		if e != nil {
			return "", "", false, e
		}
		var state string
		var next time.Time
		var lease sql.NullTime
		e = tx.QueryRowContext(ctx, "SELECT state,next_attempt_at,lease_until FROM project_deletions WHERE id=? FOR UPDATE", id).Scan(&state, &next, &lease)
		if errors.Is(e, sql.ErrNoRows) {
			tx.Rollback()
			continue
		}
		if e != nil {
			tx.Rollback()
			return "", "", false, e
		}
		due := (state == "pending" || state == "retry_wait") && !next.After(now)
		expired := state == "running" && (!lease.Valid || !lease.Time.After(now))
		if !due && !expired {
			tx.Rollback()
			continue
		}
		token := domain.ID()
		if _, e = tx.ExecContext(ctx, "UPDATE project_deletions SET state='running',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=?", token, now.Add(30*time.Second), id); e != nil {
			tx.Rollback()
			return "", "", false, e
		}
		if e = tx.Commit(); e != nil {
			return "", "", false, e
		}
		return id, token, true, nil
	}
	return "", "", false, nil
}

func (w *Worker) execute(ctx context.Context, taskID, token string, now time.Time) error {
	lastRenew := time.Now()
	renewIfDue := func() error {
		if time.Since(lastRenew) < 10*time.Second {
			return nil
		}
		if e := w.renew(ctx, taskID, token, time.Now().UTC()); e != nil {
			return e
		}
		lastRenew = time.Now()
		return nil
	}
	candidates, e := w.candidates(ctx, taskID)
	if e != nil {
		return e
	}
	for _, ref := range candidates {
		if e = renewIfDue(); e != nil {
			return e
		}
		if e = w.retireCandidate(ctx, taskID, token, ref); e != nil {
			return e
		}
	}
	files, e := w.files(ctx, taskID)
	if e != nil {
		return e
	}
	for _, key := range files {
		if e = renewIfDue(); e != nil {
			return e
		}
		if e = w.processFile(ctx, taskID, token, key); e != nil {
			return e
		}
	}
	return w.finish(ctx, taskID, token, now)
}

func (w *Worker) candidates(ctx context.Context, taskID string) ([]storage.AssetVersionRef, error) {
	rows, e := w.Service.DB.QueryContext(ctx, "SELECT asset_id,asset_version FROM project_deletion_assets WHERE task_id=? AND state='pending' ORDER BY asset_id,asset_version", taskID)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	refs := []storage.AssetVersionRef{}
	for rows.Next() {
		var ref storage.AssetVersionRef
		if e = rows.Scan(&ref.AssetID, &ref.Version); e != nil {
			return nil, e
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

func (w *Worker) files(ctx context.Context, taskID string) ([]storage.Key, error) {
	rows, e := w.Service.DB.QueryContext(ctx, "SELECT file_key FROM project_deletion_files WHERE task_id=? AND state='pending' ORDER BY file_key", taskID)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	keys := []storage.Key{}
	for rows.Next() {
		var key string
		if e = rows.Scan(&key); e != nil {
			return nil, e
		}
		keys = append(keys, storage.Key(key))
	}
	return keys, rows.Err()
}

func (w *Worker) renew(ctx context.Context, taskID, token string, now time.Time) error {
	r, e := w.Service.DB.ExecContext(ctx, "UPDATE project_deletions SET lease_until=? WHERE id=? AND state='running' AND lease_token=?", now.Add(30*time.Second), taskID, token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return nil
}

func (w *Worker) retireCandidate(ctx context.Context, taskID, token string, ref storage.AssetVersionRef) error {
	tx, e := w.Service.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return e
	}
	defer tx.Rollback()
	result, e := storage.RetireUnreferencedVersion(ctx, tx, ref)
	if e != nil {
		return e
	}
	state := "preserved"
	if result.Retired {
		state = "retired"
	} else {
		var one int
		e = tx.QueryRowContext(ctx, "SELECT 1 FROM asset_versions WHERE asset_id=? AND version=?", ref.AssetID, ref.Version).Scan(&one)
		if errors.Is(e, sql.ErrNoRows) {
			state = "retired"
		} else if e != nil {
			return e
		}
	}
	r, e := tx.ExecContext(ctx, "UPDATE project_deletion_assets a JOIN project_deletions d ON d.id=a.task_id SET a.state=? WHERE a.task_id=? AND a.asset_id=? AND a.asset_version=? AND a.state='pending' AND d.state='running' AND d.lease_token=?", state, taskID, ref.AssetID, ref.Version, token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return tx.Commit()
}

func (w *Worker) processFile(ctx context.Context, taskID, token string, key storage.Key) error {
	tx, e := w.Service.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return e
	}
	defer tx.Rollback()
	referenced, e := storage.StorageKeyReferenced(ctx, tx, key)
	if e != nil {
		return e
	}
	if referenced {
		if e = w.ackFile(ctx, tx, taskID, token, key); e != nil {
			return e
		}
		return tx.Commit()
	}
	if e = tx.Commit(); e != nil {
		return e
	}
	if e = w.Service.Store.Delete(ctx, key); e != nil && !errors.Is(e, fs.ErrNotExist) {
		return e
	}
	return w.ackFileDB(ctx, taskID, token, key)
}

func ackFileSQL() string {
	return "UPDATE project_deletion_files f JOIN project_deletions d ON d.id=f.task_id SET f.state='completed',f.internal_error=NULL WHERE f.task_id=? AND f.file_key=? AND f.state='pending' AND d.state='running' AND d.lease_token=?"
}

func (w *Worker) ackFile(ctx context.Context, tx *sql.Tx, taskID, token string, key storage.Key) error {
	r, e := tx.ExecContext(ctx, ackFileSQL(), taskID, string(key), token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return nil
}

func (w *Worker) ackFileDB(ctx context.Context, taskID, token string, key storage.Key) error {
	r, e := w.Service.DB.ExecContext(ctx, ackFileSQL(), taskID, string(key), token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return nil
}

func (w *Worker) finish(ctx context.Context, taskID, token string, now time.Time) error {
	tx, e := w.Service.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var state, current string
	e = tx.QueryRowContext(ctx, "SELECT state,COALESCE(lease_token,'') FROM project_deletions WHERE id=? FOR UPDATE", taskID).Scan(&state, &current)
	if errors.Is(e, sql.ErrNoRows) {
		return errLeaseLost
	}
	if e != nil {
		return e
	}
	if state != "running" || current != token {
		return errLeaseLost
	}
	var pending int
	if e = tx.QueryRowContext(ctx, "SELECT (SELECT COUNT(*) FROM project_deletion_files WHERE task_id=? AND state='pending')+(SELECT COUNT(*) FROM project_deletion_assets WHERE task_id=? AND state='pending')", taskID, taskID).Scan(&pending); e != nil {
		return e
	}
	if pending != 0 {
		return errors.New("cleanup still has pending work")
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM project_deletion_files WHERE task_id=?", taskID); e != nil {
		return e
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM project_deletion_assets WHERE task_id=?", taskID); e != nil {
		return e
	}
	r, e := tx.ExecContext(ctx, "UPDATE project_deletions SET state='completed',title=NULL,width=NULL,height=NULL,safe_error_code=NULL,internal_error=NULL,lease_token=NULL,lease_until=NULL,completed_at=? WHERE id=? AND state='running' AND lease_token=?", now, taskID, token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return tx.Commit()
}

func (w *Worker) fail(ctx context.Context, taskID, token string, cause error, now time.Time) error {
	tx, e := w.Service.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var state, current string
	var attempts int
	e = tx.QueryRowContext(ctx, "SELECT state,COALESCE(lease_token,''),attempts FROM project_deletions WHERE id=? FOR UPDATE", taskID).Scan(&state, &current, &attempts)
	if errors.Is(e, sql.ErrNoRows) {
		return errLeaseLost
	}
	if e != nil {
		return e
	}
	if state != "running" || current != token {
		return errLeaseLost
	}
	code := "CLEANUP_FAILED"
	var known *domain.Error
	if errors.As(cause, &known) && known.Code != "" {
		code = known.Code
	}
	message := []rune(cause.Error())
	if len(message) > 500 {
		message = message[:500]
	}
	r, e := tx.ExecContext(ctx, "UPDATE project_deletions SET state='retry_wait',safe_error_code=?,internal_error=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND state='running' AND lease_token=?", code, string(message), now.Add(cleanupBackoff(attempts)), taskID, token)
	if e != nil {
		return e
	}
	n, e := r.RowsAffected()
	if e != nil {
		return e
	}
	if n != 1 {
		return errLeaseLost
	}
	return tx.Commit()
}
