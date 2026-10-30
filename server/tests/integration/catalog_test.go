package integration_test

import (
	"context"
	"encoding/json"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/storage"
	"testing"
)

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
