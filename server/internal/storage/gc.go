package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"
)

const DefaultGCGrace = 24 * time.Hour

type GC struct {
	DB     *sql.DB
	Store  FileStore
	Root   string
	Grace  time.Duration
	DryRun bool
}

type GCReport struct {
	DryRun          bool  `json:"dryRun"`
	ScannedFiles    int   `json:"scannedFiles"`
	ReferencedFiles int   `json:"referencedFiles"`
	RecentFiles     int   `json:"recentFiles"`
	DeletedFiles    int   `json:"deletedFiles"`
	FreedBytes      int64 `json:"freedBytes"`
	ExpiredExports  int   `json:"expiredExports"`
	ExpiredUploads  int   `json:"expiredUploads"`
}

func (g *GC) Run(ctx context.Context, now time.Time) (GCReport, error) {
	var report GCReport
	if g.DB == nil || g.Store == nil || g.Root == "" {
		return report, errors.New("gc requires database, storage and data directory")
	}
	if now.IsZero() {
		now = time.Now().UTC()
	} else {
		now = now.UTC()
	}
	grace := g.Grace
	if grace <= 0 {
		grace = DefaultGCGrace
	}
	report.DryRun = g.DryRun
	if e := g.expireUploads(ctx, now, grace, &report); e != nil {
		return report, e
	}
	if e := g.expireExports(ctx, now, &report); e != nil {
		return report, e
	}
	referenced := map[string]struct{}{}
	if e := g.loadReferences(ctx, now, referenced); e != nil {
		return report, e
	}
	report.ReferencedFiles = len(referenced)
	if e := g.collect(ctx, now, grace, referenced, &report); e != nil {
		return report, e
	}
	return report, nil
}

func (g *GC) fileInfo(ctx context.Context, key Key) (bool, int64, error) {
	if e := validate(key); e != nil {
		return false, 0, e
	}
	r, e := g.Store.Open(ctx, key)
	if errors.Is(e, fs.ErrNotExist) {
		return false, 0, nil
	}
	if e != nil {
		return false, 0, e
	}
	defer r.Close()
	statter, ok := r.(interface{ Stat() (fs.FileInfo, error) })
	if !ok {
		return false, 0, fmt.Errorf("storage file cannot report size: %s", key)
	}
	info, e := statter.Stat()
	if e != nil {
		return false, 0, e
	}
	if !info.Mode().IsRegular() {
		return false, 0, fmt.Errorf("storage key is not a regular file: %s", key)
	}
	return true, info.Size(), nil
}

func (g *GC) expireUploads(ctx context.Context, now time.Time, grace time.Duration, report *GCReport) error {
	cutoff := now.Add(-grace)
	rows, e := g.DB.QueryContext(ctx, "SELECT file_key FROM staged_uploads WHERE state IN ('staged','claimed') AND expires_at<=?", cutoff)
	if e != nil {
		return e
	}
	var keys []Key
	for rows.Next() {
		var key string
		if e = rows.Scan(&key); e != nil {
			rows.Close()
			return e
		}
		keys = append(keys, Key(key))
	}
	if e = rows.Close(); e != nil {
		return e
	}
	for _, key := range keys {
		exists, size, e := g.fileInfo(ctx, key)
		if e != nil {
			return e
		}
		if exists {
			report.DeletedFiles++
			report.FreedBytes += size
			if !g.DryRun {
				if e = g.Store.Delete(ctx, key); e != nil && !errors.Is(e, fs.ErrNotExist) {
					return e
				}
			}
		}
		if !g.DryRun {
			if _, e = g.DB.ExecContext(ctx, "DELETE FROM staged_uploads WHERE file_key=? AND state IN ('staged','claimed') AND expires_at<=?", string(key), cutoff); e != nil {
				return e
			}
		}
		report.ExpiredUploads++
	}
	return nil
}

func (g *GC) expireExports(ctx context.Context, now time.Time, report *GCReport) error {
	rows, e := g.DB.QueryContext(ctx, "SELECT id,result_key,preview_key FROM export_jobs WHERE expires_at IS NOT NULL AND expires_at<=? AND ((result_key IS NOT NULL AND result_key<>'') OR (preview_key IS NOT NULL AND preview_key<>''))", now)
	if e != nil {
		return e
	}
	type expired struct {
		id   string
		keys []Key
	}
	var jobs []expired
	for rows.Next() {
		var id string
		var result, preview sql.NullString
		if e = rows.Scan(&id, &result, &preview); e != nil {
			rows.Close()
			return e
		}
		job := expired{id: id}
		for _, key := range []string{result.String, preview.String} {
			if key != "" {
				job.keys = append(job.keys, Key(key))
			}
		}
		jobs = append(jobs, job)
	}
	if e = rows.Close(); e != nil {
		return e
	}
	for _, job := range jobs {
		seen := map[Key]bool{}
		for _, key := range job.keys {
			if seen[key] {
				continue
			}
			seen[key] = true
			exists, size, e := g.fileInfo(ctx, key)
			if e != nil {
				return e
			}
			if !exists {
				continue
			}
			report.DeletedFiles++
			report.FreedBytes += size
			if !g.DryRun {
				if e = g.Store.Delete(ctx, key); e != nil && !errors.Is(e, fs.ErrNotExist) {
					return e
				}
			}
		}
		if !g.DryRun {
			if _, e = g.DB.ExecContext(ctx, "UPDATE export_jobs SET result_key=NULL,preview_key=NULL,result_size=0 WHERE id=? AND expires_at IS NOT NULL AND expires_at<=?", job.id, now); e != nil {
				return e
			}
			if _, e = g.DB.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind='export' AND owner_id=?", job.id); e != nil {
				return e
			}
		}
		report.ExpiredExports++
	}
	return nil
}

func (g *GC) loadReferences(ctx context.Context, now time.Time, out map[string]struct{}) error {
	collect := func(query string, args ...any) error {
		rows, e := g.DB.QueryContext(ctx, query, args...)
		if e != nil {
			return e
		}
		defer rows.Close()
		for rows.Next() {
			var key sql.NullString
			if e = rows.Scan(&key); e != nil {
				return e
			}
			if key.Valid && key.String != "" {
				out[key.String] = struct{}{}
			}
		}
		return rows.Err()
	}
	if e := collect("SELECT file_key FROM staged_uploads WHERE state IN ('staged','claimed')"); e != nil {
		return e
	}
	for _, query := range []string{
		"SELECT original_key FROM asset_versions",
		"SELECT normalized_key FROM asset_versions",
		"SELECT preview_key FROM asset_versions",
	} {
		if e := collect(query); e != nil {
			return e
		}
	}
	for _, query := range []string{
		"SELECT result_key FROM export_jobs WHERE result_key IS NOT NULL AND result_key<>'' AND (expires_at IS NULL OR expires_at>?)",
		"SELECT preview_key FROM export_jobs WHERE preview_key IS NOT NULL AND preview_key<>'' AND (expires_at IS NULL OR expires_at>?)",
	} {
		if e := collect(query, now); e != nil {
			return e
		}
	}
	return nil
}

func (g *GC) collect(ctx context.Context, now time.Time, grace time.Duration, referenced map[string]struct{}, report *GCReport) error {
	root, e := filepath.Abs(g.Root)
	if e != nil {
		return e
	}
	cutoff := now.Add(-grace)
	return filepath.WalkDir(root, func(p string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if p == root {
			return nil
		}
		rel, e := filepath.Rel(root, p)
		if e != nil {
			return e
		}
		key := filepath.ToSlash(rel)
		if entry.IsDir() {
			if key == ".work" {
				return fs.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(entry.Name(), MaintenanceGateName) {
			return nil
		}
		if entry.Type()&fs.ModeSymlink != 0 || !entry.Type().IsRegular() {
			return nil
		}
		report.ScannedFiles++
		if _, ok := referenced[key]; ok {
			return nil
		}
		info, e := entry.Info()
		if e != nil {
			return e
		}
		if info.ModTime().After(cutoff) {
			report.RecentFiles++
			return nil
		}
		if !g.DryRun {
			if e = g.Store.Delete(ctx, Key(key)); e != nil && !errors.Is(e, fs.ErrNotExist) {
				return e
			}
		}
		report.DeletedFiles++
		report.FreedBytes += info.Size()
		return nil
	})
}
