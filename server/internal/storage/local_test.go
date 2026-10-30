package storage

import (
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
)

type failingReader struct{ started bool }

func (f *failingReader) Read(p []byte) (int, error) {
	if f.started {
		return 0, syscall.ENOSPC
	}
	f.started = true
	return copy(p, "incomplete"), nil
}
func TestPutOpenRoundTrip(t *testing.T) {
	s, e := NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	info, e := s.Put(ctx, "originals/a", strings.NewReader("poster"))
	if e != nil {
		t.Fatal(e)
	}
	if info.Size != 6 || info.SHA256 != "293b9207228b7854bc3ccb2959ebea1583e066d41983124a5b381d6fdf6575f8" {
		t.Fatalf("invalid metadata %+v", info)
	}
	r, e := s.Open(ctx, "originals/a")
	if e != nil {
		t.Fatal(e)
	}
	defer r.Close()
	b, _ := io.ReadAll(r)
	if string(b) != "poster" {
		t.Fatal("corrupt read")
	}
}
func TestInterruptedPutPublishesNothing(t *testing.T) {
	root := t.TempDir()
	s, _ := NewLocal(root)
	_, e := s.Put(context.Background(), "originals/a", &failingReader{})
	if !errors.Is(e, syscall.ENOSPC) {
		t.Fatalf("expected ENOSPC: %v", e)
	}
	if _, e = s.Open(context.Background(), "originals/a"); e == nil {
		t.Fatal("partial file published")
	}
	entries, _ := os.ReadDir(root + "/tmp")
	if len(entries) != 0 {
		t.Fatal("temporary file leaked")
	}
}
func TestRejectTraversalAndSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	os.Symlink(outside, root+"/escape")
	s, _ := NewLocal(root)
	for _, key := range []Key{"../outside", "/etc/passwd", "a/../../escape", "escape/file", "a\\b"} {
		if _, e := s.Put(context.Background(), key, strings.NewReader("bad")); e == nil {
			t.Errorf("unsafe key accepted: %s", key)
		}
	}
	if _, e := os.Stat(outside + "/file"); !os.IsNotExist(e) {
		t.Fatal("escaped root")
	}
}
func TestNoOverwriteImmutableKey(t *testing.T) {
	s, _ := NewLocal(t.TempDir())
	ctx := context.Background()
	s.Put(ctx, "exports/result", strings.NewReader("first"))
	if _, e := s.Put(ctx, "exports/result", strings.NewReader("second")); !errors.Is(e, os.ErrExist) {
		t.Fatalf("want exists: %v", e)
	}
	r, _ := s.Open(ctx, "exports/result")
	defer r.Close()
	b, _ := io.ReadAll(r)
	if string(b) != "first" {
		t.Fatal("file overwritten")
	}
}
func TestConcurrentImmutablePublication(t *testing.T) {
	s, _ := NewLocal(t.TempDir())
	var wg sync.WaitGroup
	var successes atomic.Int32
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, e := s.Put(context.Background(), "exports/result", strings.NewReader("complete")); e == nil {
				successes.Add(1)
			}
		}()
	}
	wg.Wait()
	if successes.Load() != 1 {
		t.Fatalf("published %d times", successes.Load())
	}
}
