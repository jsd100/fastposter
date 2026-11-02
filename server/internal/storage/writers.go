package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

const WriterLockName = ".fastposter-writers.lock"

var ErrWritersPaused = errors.New("storage writes are paused for maintenance")

type WriterGate struct{ dir string }

type WriterLease struct{ lock *os.File }

func NewWriterGate(dir string) *WriterGate {
	abs, e := filepath.Abs(dir)
	if e != nil {
		return &WriterGate{dir: dir}
	}
	return &WriterGate{dir: abs}
}

func openWriterLock(dir string) (*os.File, error) {
	if e := os.MkdirAll(dir, 0700); e != nil {
		return nil, e
	}
	return os.OpenFile(filepath.Join(dir, WriterLockName), os.O_CREATE|os.O_RDWR, 0600)
}

// TryAcquire registers an in-flight write so a concurrent backup waits for it.
// It fails immediately with ErrWritersPaused while maintenance holds the
// exclusive side of the lock.
func (g *WriterGate) TryAcquire() (*WriterLease, error) {
	if g == nil {
		return &WriterLease{}, nil
	}
	lock, e := openWriterLock(g.dir)
	if e != nil {
		return nil, e
	}
	if e = syscall.Flock(int(lock.Fd()), syscall.LOCK_SH|syscall.LOCK_NB); e != nil {
		lock.Close()
		if errors.Is(e, syscall.EWOULDBLOCK) || errors.Is(e, syscall.EAGAIN) {
			return nil, ErrWritersPaused
		}
		return nil, e
	}
	return &WriterLease{lock: lock}, nil
}

func (l *WriterLease) Release() error {
	if l == nil || l.lock == nil {
		return nil
	}
	syscall.Flock(int(l.lock.Fd()), syscall.LOCK_UN)
	e := l.lock.Close()
	l.lock = nil
	return e
}

// PauseWriters blocks new writes and waits until every write admitted before
// the maintenance gate was published has finished. On success the exclusive
// lock is held until Close, so no writer can slip in while files and MySQL are
// being dumped.
func (m *Maintenance) PauseWriters(ctx context.Context, timeout time.Duration) error {
	if m == nil || m.lock == nil {
		return errors.New("maintenance is not active")
	}
	if m.writers != nil {
		return nil
	}
	lock, e := openWriterLock(m.dir)
	if e != nil {
		return e
	}
	deadline := time.Now().Add(timeout)
	for {
		if e = syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); e == nil {
			m.writers = lock
			return nil
		}
		if !errors.Is(e, syscall.EWOULDBLOCK) && !errors.Is(e, syscall.EAGAIN) {
			lock.Close()
			return e
		}
		if timeout <= 0 || time.Now().After(deadline) {
			lock.Close()
			return errors.New("timed out waiting for in-flight writes; retry when requests or exports finish")
		}
		timer := time.NewTimer(100 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			lock.Close()
			return ctx.Err()
		case <-timer.C:
		}
	}
}
