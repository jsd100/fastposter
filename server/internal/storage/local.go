package storage

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type Local struct{ root *os.Root }

func NewLocal(dir string) (FileStore, error) {
	abs, e := filepath.Abs(dir)
	if e != nil {
		return nil, e
	}
	if abs == string(filepath.Separator) {
		return nil, errors.New("unsafe storage root")
	}
	if e = os.MkdirAll(abs, 0700); e != nil {
		return nil, e
	}
	r, e := os.OpenRoot(abs)
	if e != nil {
		return nil, e
	}
	if e = r.MkdirAll("tmp", 0700); e != nil {
		r.Close()
		return nil, e
	}
	return &Local{r}, nil
}
func validate(k Key) error {
	s := string(k)
	if s == "" || s == "." || path.IsAbs(s) || path.Clean(s) != s || strings.Contains(s, "\\") || strings.HasPrefix(s, "../") || strings.ContainsRune(s, 0) {
		return errors.New("invalid storage key")
	}
	return nil
}
func NewKey(prefix string) Key {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		panic(e)
	}
	return Key(prefix + "/" + hex.EncodeToString(b[:]))
}

type contextReader struct {
	ctx context.Context
	r   io.Reader
}

func (r contextReader) Read(p []byte) (int, error) {
	if e := r.ctx.Err(); e != nil {
		return 0, e
	}
	return r.r.Read(p)
}
func (s *Local) Put(ctx context.Context, k Key, src io.Reader) (FileInfo, error) {
	if e := validate(k); e != nil {
		return FileInfo{}, e
	}
	if e := ctx.Err(); e != nil {
		return FileInfo{}, e
	}
	tmp := string(NewKey("tmp"))
	f, e := s.root.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return FileInfo{}, e
	}
	defer s.root.Remove(tmp)
	defer f.Close()
	h := sha256.New()
	n, e := io.Copy(io.MultiWriter(f, h), contextReader{ctx, src})
	if e != nil {
		return FileInfo{}, fmt.Errorf("write file: %w", e)
	}
	if e = f.Sync(); e != nil {
		return FileInfo{}, e
	}
	if e = f.Close(); e != nil {
		return FileInfo{}, e
	}
	if e = ctx.Err(); e != nil {
		return FileInfo{}, e
	}
	if e = s.root.MkdirAll(path.Dir(string(k)), 0700); e != nil {
		return FileInfo{}, e
	}
	// A same-filesystem hard link publishes a fully synced file without replacing
	// an immutable destination. Root enforces traversal safety including symlinks.
	if e = s.root.Link(tmp, string(k)); e != nil {
		return FileInfo{}, e
	}
	parent, e := s.root.Open(path.Dir(string(k)))
	if e == nil {
		e = parent.Sync()
		parent.Close()
	}
	if e != nil {
		return FileInfo{}, e
	}
	return FileInfo{k, n, hex.EncodeToString(h.Sum(nil))}, nil
}
func (s *Local) Open(ctx context.Context, k Key) (io.ReadCloser, error) {
	if e := ctx.Err(); e != nil {
		return nil, e
	}
	if e := validate(k); e != nil {
		return nil, e
	}
	f, e := s.root.Open(string(k))
	if e != nil {
		return nil, e
	}
	st, e := f.Stat()
	if e != nil || !st.Mode().IsRegular() {
		f.Close()
		return nil, errors.New("not a regular file")
	}
	return f, nil
}
func (s *Local) Stat(ctx context.Context, k Key) (FileInfo, error) {
	r, e := s.Open(ctx, k)
	if e != nil {
		return FileInfo{}, e
	}
	defer r.Close()
	h := sha256.New()
	n, e := io.Copy(h, contextReader{ctx, r})
	if e != nil {
		return FileInfo{}, e
	}
	return FileInfo{k, n, hex.EncodeToString(h.Sum(nil))}, nil
}
func (s *Local) Delete(ctx context.Context, k Key) error {
	if e := ctx.Err(); e != nil {
		return e
	}
	if e := validate(k); e != nil {
		return e
	}
	return s.root.Remove(string(k))
}
func (s *Local) Close() error { return s.root.Close() }
