package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
)

type AssetVersionRef struct {
	AssetID string
	Version uint64
}

type ReclaimResult struct {
	Retired bool
	Keys    []Key
}

var ErrAssetVersionMissing = errors.New("asset version no longer exists")

func sortedRefs(refs []AssetVersionRef) []AssetVersionRef {
	seen := make(map[AssetVersionRef]bool, len(refs))
	out := make([]AssetVersionRef, 0, len(refs))
	for _, ref := range refs {
		if ref.AssetID == "" || seen[ref] {
			continue
		}
		seen[ref] = true
		out = append(out, ref)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].AssetID != out[j].AssetID {
			return out[i].AssetID < out[j].AssetID
		}
		return out[i].Version < out[j].Version
	})
	return out
}

func keysOf(original, normalized, preview string) []Key {
	seen := map[Key]bool{}
	out := []Key{}
	for _, raw := range []string{original, normalized, preview} {
		key := Key(raw)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	return out
}

// LockAssetVersions takes shared row locks for every referenced version in a
// stable (asset_id, version) order. Reference writers call it inside their
// transaction before inserting asset_refs or resource_versions, so retirement
// cannot delete a version between validation and the reference commit.
func LockAssetVersions(ctx context.Context, tx *sql.Tx, refs []AssetVersionRef) error {
	for _, ref := range sortedRefs(refs) {
		var one int
		e := tx.QueryRowContext(ctx, "SELECT 1 FROM asset_versions WHERE asset_id=? AND version=? FOR SHARE", ref.AssetID, ref.Version).Scan(&one)
		if errors.Is(e, sql.ErrNoRows) {
			return fmt.Errorf("%w: %s:%d", ErrAssetVersionMissing, ref.AssetID, ref.Version)
		}
		if e != nil {
			return e
		}
	}
	return nil
}

// RetireUnreferencedVersion removes one asset version only when neither
// asset_refs nor resource_versions still reference it, deleting the parent
// asset row once its last version is gone. It only changes database state; the
// caller deletes the returned keys after commit. The transaction must use READ
// COMMITTED so the locking reference checks see the latest committed rows.
func RetireUnreferencedVersion(ctx context.Context, tx *sql.Tx, ref AssetVersionRef) (ReclaimResult, error) {
	var out ReclaimResult
	var one int
	e := tx.QueryRowContext(ctx, "SELECT 1 FROM assets WHERE id=? FOR UPDATE", ref.AssetID).Scan(&one)
	if errors.Is(e, sql.ErrNoRows) {
		return out, nil
	}
	if e != nil {
		return out, e
	}
	var original, normalized, preview string
	e = tx.QueryRowContext(ctx, "SELECT original_key,normalized_key,preview_key FROM asset_versions WHERE asset_id=? AND version=? FOR UPDATE", ref.AssetID, ref.Version).Scan(&original, &normalized, &preview)
	if errors.Is(e, sql.ErrNoRows) {
		return out, nil
	}
	if e != nil {
		return out, e
	}
	out.Keys = keysOf(original, normalized, preview)
	var reference string
	e = tx.QueryRowContext(ctx, "SELECT asset_id FROM asset_refs WHERE asset_id=? AND asset_version=? LIMIT 1 FOR SHARE", ref.AssetID, ref.Version).Scan(&reference)
	if e == nil {
		return out, nil
	}
	if !errors.Is(e, sql.ErrNoRows) {
		return out, e
	}
	e = tx.QueryRowContext(ctx, "SELECT asset_id FROM resource_versions WHERE asset_id=? AND asset_version=? LIMIT 1 FOR SHARE", ref.AssetID, ref.Version).Scan(&reference)
	if e == nil {
		return out, nil
	}
	if !errors.Is(e, sql.ErrNoRows) {
		return out, e
	}
	result, e := tx.ExecContext(ctx, "DELETE FROM asset_versions WHERE asset_id=? AND version=?", ref.AssetID, ref.Version)
	if e != nil {
		return out, e
	}
	affected, e := result.RowsAffected()
	if e != nil {
		return out, e
	}
	if affected != 1 {
		return out, nil
	}
	if _, e = tx.ExecContext(ctx, "DELETE FROM assets WHERE id=? AND NOT EXISTS (SELECT 1 FROM asset_versions WHERE asset_id=?)", ref.AssetID, ref.AssetID); e != nil {
		return out, e
	}
	out.Retired = true
	return out, nil
}

// StorageKeyReferenced reports whether any surviving asset version, export
// result, preview or staged upload still owns the physical key. Call it inside
// the same READ COMMITTED transaction that retired the metadata, before
// deleting files.
func StorageKeyReferenced(ctx context.Context, tx *sql.Tx, key Key) (bool, error) {
	if key == "" {
		return false, nil
	}
	var count int
	if e := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM asset_versions WHERE original_key=? OR normalized_key=? OR preview_key=?", string(key), string(key), string(key)).Scan(&count); e != nil {
		return false, e
	}
	if count > 0 {
		return true, nil
	}
	if e := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM export_jobs WHERE result_key=? OR preview_key=?", string(key), string(key)).Scan(&count); e != nil {
		return false, e
	}
	if count > 0 {
		return true, nil
	}
	if e := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM staged_uploads WHERE file_key=?", string(key)).Scan(&count); e != nil {
		return false, e
	}
	return count > 0, nil
}
