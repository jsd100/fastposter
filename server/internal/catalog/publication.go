package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"strconv"
)

// SetPublished changes only the publication state of an existing resource.
// It carries a versioned intent (published + expectedVersion); every piece of
// content is copied from the locked current version row inside one
// transaction, so the server never consumes a client-side content snapshot.
func (s *Service) SetPublished(ctx context.Context, p auth.Principal, id string, published bool, expectedVersion string) (Resource, error) {
	// Defense 1/3: the admin check runs before version parsing or row locking,
	// so an ordinary caller never learns the current version or triggers a write.
	if e := auth.RequireAdmin(p); e != nil {
		return Resource{}, e
	}
	// Defense 2/3: parse the version unconditionally (no bypass path).
	expected, e := parseExpectedVersion(expectedVersion)
	if e != nil {
		return Resource{}, e
	}
	tx, e := s.DB.BeginTx(ctx, nil)
	if e != nil {
		return Resource{}, e
	}
	defer tx.Rollback()

	// Lock the target row first; the version comparison is done under the lock.
	var current uint64
	var currentPublished bool
	e = tx.QueryRowContext(ctx,
		"SELECT current_version,published FROM resources WHERE id=? AND deleted_at IS NULL FOR UPDATE",
		id).Scan(&current, &currentPublished)
	if errors.Is(e, sql.ErrNoRows) {
		return Resource{}, catalogMissing()
	}
	if e != nil {
		return Resource{}, e
	}
	// Version comparison MUST happen before any state comparison: a stale
	// request conflicts even when the target state already matches.
	if current != expected {
		return Resource{}, domain.E("REVISION_CONFLICT", "资源已被其他操作更新，请刷新后重试")
	}

	// The response comes from this transaction's own snapshot, never from a
	// post-commit re-read that could observe another concurrent write.
	snapshot := func() (Resource, error) {
		return scanResource(tx.QueryRowContext(ctx,
			"SELECT "+resourceColumns+" FROM resources r JOIN resource_versions v ON v.resource_id=r.id AND v.version=r.current_version WHERE r.id=?", id))
	}

	// Legal version with an identical target state: success, zero write (no
	// new version row, no UPDATE, no audit).
	if currentPublished == published {
		r, e := snapshot()
		if e != nil {
			return Resource{}, e
		}
		if e = tx.Commit(); e != nil {
			return Resource{}, e
		}
		return r, nil
	}

	version := current + 1

	// Lock the asset versions the current version depends on, in a stable
	// (asset_id, version) order, before copying any reference.
	locks := []storage.AssetVersionRef{}
	rows, e := tx.QueryContext(ctx,
		"SELECT asset_id,asset_version FROM asset_refs WHERE owner_kind='resource-version' AND owner_id=?",
		id+":"+strconv.FormatUint(current, 10))
	if e != nil {
		return Resource{}, e
	}
	for rows.Next() {
		var assetID string
		var assetVersion uint64
		if e = rows.Scan(&assetID, &assetVersion); e != nil {
			rows.Close()
			return Resource{}, e
		}
		locks = append(locks, storage.AssetVersionRef{AssetID: assetID, Version: assetVersion})
	}
	if e = rows.Err(); e != nil {
		rows.Close()
		return Resource{}, e
	}
	rows.Close()
	var assetID sql.NullString
	var assetVersion sql.NullInt64
	if e = tx.QueryRowContext(ctx,
		"SELECT asset_id,asset_version FROM resource_versions WHERE resource_id=? AND version=?", id, current).Scan(&assetID, &assetVersion); e != nil {
		return Resource{}, e
	}
	if assetID.Valid && assetVersion.Valid {
		locks = append(locks, storage.AssetVersionRef{AssetID: assetID.String, Version: uint64(assetVersion.Int64)})
	}
	if e = storage.LockAssetVersions(ctx, tx, locks); e != nil {
		if errors.Is(e, storage.ErrAssetVersionMissing) {
			return Resource{}, domain.E("NOT_FOUND", "引用素材不存在或无权使用")
		}
		return Resource{}, e
	}

	// Copy the locked current version row: title-independent metadata, the
	// asset version, document and body are inherited unchanged.
	if _, e = tx.ExecContext(ctx,
		"INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,document,body,metadata) SELECT resource_id,?,asset_id,asset_version,document,body,metadata FROM resource_versions WHERE resource_id=? AND version=?",
		version, id, current); e != nil {
		return Resource{}, e
	}

	// Copy both owner kinds of asset_refs: the resource-version-specific
	// dependencies get a fresh owner for the new version, and the
	// resource-level references are re-asserted (idempotent, owner_id = id).
	if _, e = tx.ExecContext(ctx,
		"INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) SELECT 'resource-version',?,asset_id,asset_version FROM asset_refs WHERE owner_kind='resource-version' AND owner_id=?",
		id+":"+strconv.FormatUint(version, 10), id+":"+strconv.FormatUint(current, 10)); e != nil {
		return Resource{}, e
	}
	if _, e = tx.ExecContext(ctx,
		"INSERT IGNORE INTO asset_refs(owner_kind,owner_id,asset_id,asset_version) SELECT 'resource',?,asset_id,asset_version FROM asset_refs WHERE owner_kind='resource' AND owner_id=?",
		id, id); e != nil {
		return Resource{}, e
	}

	// Publication changes only published + current_version (+ updated_at).
	if _, e = tx.ExecContext(ctx,
		"UPDATE resources SET published=?,current_version=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
		published, version, id); e != nil {
		return Resource{}, e
	}
	if _, e = tx.ExecContext(ctx,
		"INSERT INTO admin_audit_logs(id,actor_id,action,target_id,result) VALUES(?,?,?,?,'success')",
		domain.ID(), p.UserID, "resource.publish", id); e != nil {
		return Resource{}, e
	}

	r, e := snapshot()
	if e != nil {
		return Resource{}, e
	}
	if e = tx.Commit(); e != nil {
		return Resource{}, e
	}
	return r, nil
}
