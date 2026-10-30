package storage

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUsageCountsActualBytesWithoutFollowingSymlinks(t *testing.T) {
	root := t.TempDir()
	s, e := NewLocal(root)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	ctx := context.Background()
	s.Put(ctx, Key("originals/a"), strings.NewReader("abc"))
	s.Put(ctx, Key("exports/b"), strings.NewReader("12345"))
	outside := filepath.Join(t.TempDir(), "outside")
	os.WriteFile(outside, []byte(strings.Repeat("x", 101)), 0600)
	if e = os.Symlink(outside, filepath.Join(root, "external")); e != nil {
		t.Fatal(e)
	}
	bytes, e := Usage(ctx, s)
	if e != nil || bytes != 8 {
		t.Fatalf("actual managed bytes %d %v", bytes, e)
	}
}
