package storage

import (
	"context"
	"errors"
	"io/fs"
	"os"
)

func Usage(ctx context.Context, store FileStore) (int64, error) {
	if local, ok := store.(interface {
		Usage(context.Context) (int64, error)
	}); ok {
		return local.Usage(ctx)
	}
	return 0, errors.New("storage usage is unavailable")
}
func (l *Local) Usage(ctx context.Context) (int64, error) {
	var total int64
	e := fs.WalkDir(l.root.FS(), ".", func(path string, entry fs.DirEntry, e error) error {
		if e != nil {
			if errors.Is(e, os.ErrNotExist) {
				return nil
			}
			return e
		}
		if e = ctx.Err(); e != nil {
			return e
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		info, e := entry.Info()
		if errors.Is(e, os.ErrNotExist) {
			return nil
		}
		if e != nil {
			return e
		}
		total += info.Size()
		return nil
	})
	return total, e
}
