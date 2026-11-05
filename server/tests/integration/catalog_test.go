package integration_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"strconv"
	"testing"
	"time"
)

func retireVersion(t *testing.T, db *sql.DB, assetID, version string) storage.ReclaimResult {
	t.Helper()
	number, e := strconv.ParseUint(version, 10, 64)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	tx, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback()
	result, e := storage.RetireUnreferencedVersion(ctx, tx, storage.AssetVersionRef{AssetID: assetID, Version: number})
	if e != nil {
		t.Fatal(e)
	}
	if e = tx.Commit(); e != nil {
		t.Fatal(e)
	}
	return result
}

func TestCatalogUnpublishKeepsReferencedVersionReadable(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	if _, e := db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	if _, e := db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "共享背景", AssetID: "bg-1", Published: true})
	if e != nil {
		t.Fatal(e)
	}
	a, e := p.Create(ctx, projectOwner(), "引用背景", doc)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = c.Save(ctx, admin, catalog.ResourceInput{ID: r.ID, Kind: "background", Title: r.Title, AssetID: "bg-1", Published: false}); e != nil {
		t.Fatal(e)
	}
	images := assets.NewService(db, p.Store, nil, t.TempDir())
	if _, e = images.AuthorizeRead(ctx, projectOwner(), "bg-1", "1"); e != nil {
		t.Fatal("existing project lost background", e)
	}
	if _, e = p.ResolveSnapshot(ctx, projectOwner(), a.ID, "1"); e != nil {
		t.Fatal(e)
	}
	if e = c.Delete(ctx, admin, r.ID); e == nil {
		t.Fatal("referenced file could be deleted")
	}
	if _, e = c.Save(ctx, projectOwner(), catalog.ResourceInput{Kind: "background", Title: "forged", AssetID: "bg-1"}); e == nil {
		t.Fatal("normal user managed catalog")
	}
}
func TestCatalogAdminProjectListContainsMetadataOnly(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	if _, e := p.Create(ctx, projectOwner(), "private", doc); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	items, _, e := c.AdminProjects(ctx, auth.Principal{UserID: "u2", Role: "admin"}, catalog.Filter{})
	if e != nil {
		t.Fatal(e)
	}
	raw, e := json.Marshal(items)
	if e != nil {
		t.Fatal(e)
	}
	var rows []map[string]any
	if e = json.Unmarshal(raw, &rows); e != nil {
		t.Fatal(e)
	}
	if len(rows) != 1 {
		t.Fatal("missing metadata")
	}
	for key := range rows[0] {
		if key == "document" || key == "textBlocks" || key == "fonts" || key == "background" {
			t.Fatal("private poster exposed in metadata", key)
		}
	}
}
func TestCatalogAdminStatsCountActualStorage(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	o, e := c.Overview(ctx, auth.Principal{UserID: "u2", Role: "admin"})
	if e != nil {
		t.Fatal(e)
	}
	actual, e := storage.Usage(ctx, p.Store)
	if e != nil || o.StorageBytes != actual {
		t.Fatalf("storage bytes %d %d %v", o.StorageBytes, actual, e)
	}
}
func TestPublishedResourceAndOtherTrashProtectAssetFromRetirement(t *testing.T) {
	p, db, doc := projectService(t)
	ctx := context.Background()
	project, e := p.Create(ctx, projectOwner(), "待彻底删除", doc)
	if e != nil {
		t.Fatal(e)
	}
	if e = p.SoftDelete(ctx, projectOwner(), project.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "公开背景", AssetID: "bg-1", Published: true})
	if e != nil {
		t.Fatal(e)
	}
	if result := retireVersion(t, db, "bg-1", "1"); result.Retired {
		t.Fatal("asset referenced by a trashed project was retired")
	}
	if _, e = db.Exec("DELETE FROM asset_refs WHERE owner_kind IN ('project','project-history') AND owner_id=?", project.ID); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("DELETE FROM projects WHERE id=?", project.ID); e != nil {
		t.Fatal(e)
	}
	if result := retireVersion(t, db, "bg-1", "1"); result.Retired {
		t.Fatal("asset referenced by a published resource was retired")
	}
	if _, e = db.Exec("DELETE FROM asset_refs WHERE owner_kind IN ('resource','resource-version') AND (owner_id=? OR owner_id LIKE ?)", r.ID, r.ID+":%"); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec("DELETE FROM resources WHERE id=?", r.ID); e != nil {
		t.Fatal(e)
	}
	result := retireVersion(t, db, "bg-1", "1")
	if !result.Retired || len(result.Keys) == 0 {
		t.Fatalf("unreferenced asset version was not retired: %+v", result)
	}
	for _, key := range result.Keys {
		if _, e = p.Store.Stat(ctx, key); e != nil {
			t.Fatalf("retirement deleted files before commit: %s %v", key, e)
		}
	}
}

func TestCatalogSaveCannotPublishRetiredVersion(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	if _, e := db.Exec("UPDATE users SET role='admin' WHERE id='u2'"); e != nil {
		t.Fatal(e)
	}
	if _, e := db.Exec("UPDATE assets SET owner_id='u2' WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	admin := auth.Principal{UserID: "u2", Role: "admin"}
	retirement, e := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if e != nil {
		t.Fatal(e)
	}
	defer retirement.Rollback()
	for _, statement := range []string{
		"SELECT 1 FROM assets WHERE id='bg-1' FOR UPDATE",
		"SELECT 1 FROM asset_versions WHERE asset_id='bg-1' AND version=1 FOR UPDATE",
	} {
		if _, e = retirement.ExecContext(ctx, statement); e != nil {
			t.Fatal(e)
		}
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM asset_versions WHERE asset_id='bg-1' AND version=1"); e != nil {
		t.Fatal(e)
	}
	if _, e = retirement.ExecContext(ctx, "DELETE FROM assets WHERE id='bg-1'"); e != nil {
		t.Fatal(e)
	}
	saved := make(chan error, 1)
	go func() {
		_, err := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "race", AssetID: "bg-1"})
		saved <- err
	}()
	select {
	case e = <-saved:
		t.Fatalf("catalog save bypassed an in-flight retirement: %v", e)
	case <-time.After(250 * time.Millisecond):
	}
	if e = retirement.Commit(); e != nil {
		t.Fatal(e)
	}
	select {
	case e = <-saved:
		var known *domain.Error
		if !errors.As(e, &known) || known.Code != "NOT_FOUND" {
			t.Fatalf("catalog save after retirement = %v, want NOT_FOUND", e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("catalog save did not observe the retirement commit")
	}
	var count int
	if e = db.QueryRow("SELECT COUNT(*) FROM resources WHERE title='race'").Scan(&count); e != nil || count != 0 {
		t.Fatalf("retired version was published: %d %v", count, e)
	}
	if e = db.QueryRow("SELECT COUNT(*) FROM asset_refs WHERE asset_id='bg-1'").Scan(&count); e != nil || count != 0 {
		t.Fatalf("retired version gained references: %d %v", count, e)
	}
}

func TestCatalogDeletesUnreferencedResourceVersionWithoutDeletingFile(t *testing.T) {
	p, db, _ := projectService(t)
	ctx := context.Background()
	admin := auth.Principal{UserID: "u1", Role: "admin"}
	c := catalog.NewService(db, p.Store, assets.NewService(db, p.Store, nil, t.TempDir()))
	r, e := c.Save(ctx, admin, catalog.ResourceInput{Kind: "background", Title: "unused", AssetID: "bg-1"})
	if e != nil {
		t.Fatal(e)
	}
	if e = c.Delete(ctx, admin, r.ID); e != nil {
		t.Fatal("own resource-version refs blocked unreferenced metadata deletion", e)
	}
	if _, e = c.Get(ctx, admin, r.ID, true); e == nil {
		t.Fatal("deleted resource still listed")
	}
}
