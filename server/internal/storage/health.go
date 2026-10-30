package storage

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
)

type DiskHealth struct {
	Path       string `json:"path"`
	Writable   bool   `json:"writable"`
	FreeBytes  uint64 `json:"freeBytes"`
	TotalBytes uint64 `json:"totalBytes"`
}

func CheckHealth(ctx context.Context, dir string) (DiskHealth, error) {
	abs, e := filepath.Abs(dir)
	if e != nil {
		return DiskHealth{}, e
	}
	if abs == string(filepath.Separator) {
		return DiskHealth{}, errors.New("unsafe storage root")
	}
	if e = os.MkdirAll(abs, 0700); e != nil {
		return DiskHealth{}, e
	}
	if e = ctx.Err(); e != nil {
		return DiskHealth{}, e
	}
	probe, e := os.CreateTemp(abs, ".health-*")
	if e != nil {
		return DiskHealth{}, e
	}
	name := probe.Name()
	defer os.Remove(name)
	if _, e = probe.Write([]byte("fastposter")); e != nil {
		probe.Close()
		return DiskHealth{}, e
	}
	if e = probe.Sync(); e != nil {
		probe.Close()
		return DiskHealth{}, e
	}
	if e = probe.Close(); e != nil {
		return DiskHealth{}, e
	}
	if e = os.Remove(name); e != nil {
		return DiskHealth{}, e
	}
	var stat syscall.Statfs_t
	if e = syscall.Statfs(abs, &stat); e != nil {
		return DiskHealth{}, e
	}
	return DiskHealth{Path: abs, Writable: true, FreeBytes: uint64(stat.Bavail) * uint64(stat.Bsize), TotalBytes: uint64(stat.Blocks) * uint64(stat.Bsize)}, nil
}

type FileCheck struct {
	UniqueFiles int      `json:"uniqueFiles"`
	Missing     []string `json:"missing"`
	Mismatched  []string `json:"mismatched"`
}

func (c FileCheck) Healthy() bool { return len(c.Missing) == 0 && len(c.Mismatched) == 0 }

func VerifyFiles(ctx context.Context, db *sql.DB, store FileStore) (FileCheck, error) {
	check := FileCheck{Missing: []string{}, Mismatched: []string{}}
	if db == nil || store == nil {
		return check, errors.New("file verification requires database and storage")
	}
	missing := map[string]bool{}
	mismatch := map[string]bool{}
	hashed := map[string]bool{}
	present := map[string]bool{}
	markMissing := func(key string) {
		if key != "" && !missing[key] {
			missing[key] = true
			check.Missing = append(check.Missing, key)
		}
	}
	markMismatch := func(key string) {
		if key != "" && !mismatch[key] {
			mismatch[key] = true
			check.Mismatched = append(check.Mismatched, key)
		}
	}
	exists := func(key string) (bool, error) {
		if present[key] {
			return true, nil
		}
		r, e := store.Open(ctx, Key(key))
		if errors.Is(e, fs.ErrNotExist) {
			return false, nil
		}
		if e != nil {
			return false, e
		}
		r.Close()
		present[key] = true
		return true, nil
	}
	rows, e := db.QueryContext(ctx, "SELECT original_key,normalized_key,preview_key,normalized_sha256,normalized_size FROM asset_versions")
	if e != nil {
		return check, e
	}
	for rows.Next() {
		var original, normalized, preview string
		var sha string
		var size int64
		if e = rows.Scan(&original, &normalized, &preview, &sha, &size); e != nil {
			rows.Close()
			return check, e
		}
		for _, key := range []string{original, preview} {
			if key == "" {
				continue
			}
			ok, e := exists(key)
			if e != nil {
				rows.Close()
				return check, e
			}
			if !ok {
				markMissing(key)
			}
		}
		if normalized == "" {
			continue
		}
		if !hashed[normalized] {
			info, e := store.Stat(ctx, Key(normalized))
			if errors.Is(e, fs.ErrNotExist) {
				markMissing(normalized)
			} else if e != nil {
				rows.Close()
				return check, e
			} else if info.SHA256 != sha || info.Size != size {
				markMismatch(normalized)
			}
			hashed[normalized] = true
			check.UniqueFiles++
		}
	}
	if e = rows.Close(); e != nil {
		return check, e
	}
	exports, e := db.QueryContext(ctx, "SELECT result_key,result_size,preview_key FROM export_jobs WHERE (expires_at IS NULL OR expires_at>UTC_TIMESTAMP(6)) AND ((result_key IS NOT NULL AND result_key<>'') OR (preview_key IS NOT NULL AND preview_key<>''))")
	if e != nil {
		return check, e
	}
	defer exports.Close()
	for exports.Next() {
		var result, preview sql.NullString
		var size int64
		if e = exports.Scan(&result, &size, &preview); e != nil {
			return check, e
		}
		if result.Valid && result.String != "" {
			info, e := store.Stat(ctx, Key(result.String))
			if errors.Is(e, fs.ErrNotExist) {
				markMissing(result.String)
			} else if e != nil {
				return check, e
			} else if info.Size != size {
				markMismatch(result.String)
			}
		}
		if preview.Valid && preview.String != "" {
			ok, e := exists(preview.String)
			if e != nil {
				return check, e
			}
			if !ok {
				markMissing(preview.String)
			}
		}
	}
	return check, exports.Err()
}
