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
const DefaultRetention = 30 * 24 * time.Hour

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
	PurgedProjects  int   `json:"purgedProjects"`
	PurgedResources int   `json:"purgedResources"`
	ReclaimedAssets int   `json:"reclaimedAssets"`
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
	if e := g.expireExportRefs(ctx, now); e != nil {
		return report, e
	}
	if e := g.purgeDeletedProjects(ctx, now, &report); e != nil {
		return report, e
	}
	if e := g.purgeDeletedResources(ctx, now, &report); e != nil {
		return report, e
	}
	if e := g.pruneAssets(ctx, now, grace, &report); e != nil {
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

func (g *GC) expireExportRefs(ctx context.Context, now time.Time) error {
	if g.DryRun {
		return nil
	}
	_, e := g.DB.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind='export' AND owner_id IN (SELECT id FROM export_jobs WHERE expires_at IS NOT NULL AND expires_at<=?)", now)
	return e
}

func (g *GC) removeFiles(ctx context.Context, keys []Key, report *GCReport) error {
	seen := map[Key]bool{}
	for _, key := range keys {
		if key == "" || seen[key] {
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
	return nil
}

func (g *GC) purgeDeletedProjects(ctx context.Context, now time.Time, report *GCReport) error {
	cutoff := now.Add(-DefaultRetention)
	rows, e := g.DB.QueryContext(ctx, "SELECT id FROM projects WHERE deleted_at IS NOT NULL AND deleted_at<=?", cutoff)
	if e != nil {
		return e
	}
	var ids []string
	for rows.Next() {
		var id string
		if e = rows.Scan(&id); e != nil {
			rows.Close()
			return e
		}
		ids = append(ids, id)
	}
	if e = rows.Close(); e != nil {
		return e
	}
	for _, id := range ids {
		if g.DryRun {
			report.PurgedProjects++
			continue
		}
		tx, e := g.DB.BeginTx(ctx, nil)
		if e != nil {
			return e
		}
		if _, e = tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind='export' AND owner_id IN (SELECT id FROM export_jobs WHERE project_id=?)", id); e != nil {
			tx.Rollback()
			return e
		}
		if _, e = tx.ExecContext(ctx, "DELETE FROM export_jobs WHERE project_id=?", id); e != nil {
			tx.Rollback()
			return e
		}
		if _, e = tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE owner_kind IN ('project','project-history') AND owner_id=?", id); e != nil {
			tx.Rollback()
			return e
		}
		result, e := tx.ExecContext(ctx, "DELETE FROM projects WHERE id=? AND deleted_at IS NOT NULL AND deleted_at<=?", id, cutoff)
		if e != nil {
			tx.Rollback()
			return e
		}
		affected, e := result.RowsAffected()
		if e != nil {
			tx.Rollback()
			return e
		}
		if affected == 0 {
			tx.Rollback()
			continue
		}
		if e = tx.Commit(); e != nil {
			return e
		}
		report.PurgedProjects++
	}
	return nil
}

func (g *GC) purgeDeletedResources(ctx context.Context, now time.Time, report *GCReport) error {
	cutoff := now.Add(-DefaultRetention)
	rows, e := g.DB.QueryContext(ctx, "SELECT id FROM resources WHERE deleted_at IS NOT NULL AND deleted_at<=?", cutoff)
	if e != nil {
		return e
	}
	var ids []string
	for rows.Next() {
		var id string
		if e = rows.Scan(&id); e != nil {
			rows.Close()
			return e
		}
		ids = append(ids, id)
	}
	if e = rows.Close(); e != nil {
		return e
	}
	for _, id := range ids {
		if g.DryRun {
			report.PurgedResources++
			continue
		}
		tx, e := g.DB.BeginTx(ctx, nil)
		if e != nil {
			return e
		}
		if _, e = tx.ExecContext(ctx, "DELETE FROM asset_refs WHERE (owner_kind='resource' AND owner_id=?) OR (owner_kind='resource-version' AND SUBSTRING_INDEX(owner_id,':',1)=?)", id, id); e != nil {
			tx.Rollback()
			return e
		}
		result, e := tx.ExecContext(ctx, "DELETE FROM resources WHERE id=? AND deleted_at IS NOT NULL AND deleted_at<=?", id, cutoff)
		if e != nil {
			tx.Rollback()
			return e
		}
		affected, e := result.RowsAffected()
		if e != nil {
			tx.Rollback()
			return e
		}
		if affected == 0 {
			tx.Rollback()
			continue
		}
		if e = tx.Commit(); e != nil {
			return e
		}
		report.PurgedResources++
	}
	return nil
}

func (g *GC) pruneAssets(ctx context.Context, now time.Time, grace time.Duration, report *GCReport) error {
	cutoff := now.Add(-grace)
	const orphanQuery = `SELECT v.asset_id,v.version,v.original_key,v.normalized_key,v.preview_key
		FROM asset_versions v
		WHERE v.created_at<=?
		AND NOT EXISTS (SELECT 1 FROM asset_refs r WHERE r.asset_id=v.asset_id AND r.asset_version=v.version)
		AND NOT EXISTS (SELECT 1 FROM resource_versions rv WHERE rv.asset_id=v.asset_id AND rv.asset_version=v.version)`
	rows, e := g.DB.QueryContext(ctx, orphanQuery, cutoff)
	if e != nil {
		return e
	}
	type orphan struct {
		assetID string
		version uint64
		keys    []Key
	}
	var orphans []orphan
	for rows.Next() {
		var item orphan
		var original, normalized, preview string
		if e = rows.Scan(&item.assetID, &item.version, &original, &normalized, &preview); e != nil {
			rows.Close()
			return e
		}
		for _, key := range []string{original, normalized, preview} {
			if key != "" {
				item.keys = append(item.keys, Key(key))
			}
		}
		orphans = append(orphans, item)
	}
	if e = rows.Close(); e != nil {
		return e
	}
	for _, item := range orphans {
		if !g.DryRun {
			tx, e := g.DB.BeginTx(ctx, nil)
			if e != nil {
				return e
			}
			result, e := tx.ExecContext(ctx, `DELETE FROM asset_versions
				WHERE asset_id=? AND version=? AND created_at<=?
				AND NOT EXISTS (SELECT 1 FROM asset_refs r WHERE r.asset_id=? AND r.asset_version=?)
				AND NOT EXISTS (SELECT 1 FROM resource_versions rv WHERE rv.asset_id=? AND rv.asset_version=?)`,
				item.assetID, item.version, cutoff, item.assetID, item.version, item.assetID, item.version)
			if e != nil {
				tx.Rollback()
				return e
			}
			affected, e := result.RowsAffected()
			if e != nil {
				tx.Rollback()
				return e
			}
			if affected == 0 {
				tx.Rollback()
				continue
			}
			if _, e = tx.ExecContext(ctx, "DELETE FROM assets WHERE id=? AND NOT EXISTS (SELECT 1 FROM asset_versions WHERE asset_id=?)", item.assetID, item.assetID); e != nil {
				tx.Rollback()
				return e
			}
			if e = tx.Commit(); e != nil {
				return e
			}
		}
		if e = g.removeFiles(ctx, item.keys, report); e != nil {
			return e
		}
		report.ReclaimedAssets++
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
	for _, column := range []string{"original_key", "normalized_key", "preview_key"} {
		query := "SELECT v." + column + " FROM asset_versions v WHERE EXISTS (SELECT 1 FROM asset_refs r WHERE r.asset_id=v.asset_id AND r.asset_version=v.version) OR EXISTS (SELECT 1 FROM resource_versions rv WHERE rv.asset_id=v.asset_id AND rv.asset_version=v.version)"
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
		if strings.HasPrefix(entry.Name(), MaintenanceGateName) || strings.HasPrefix(entry.Name(), WriterLockName) {
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
