package integration_test

import (
	"context"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"fmt"
	"strings"
	"testing"
)

var builtinFaceIDs = []string{
	"builtin-noto-sc-400", "builtin-noto-sc-700", "builtin-noto-sc-900",
	"builtin-noto-serif-sc-400", "builtin-noto-serif-sc-700", "builtin-noto-serif-sc-900",
	"builtin-lxgw-wenkai-400", "builtin-zcool-kuaile-400", "builtin-zcool-xiaowei-400",
	"builtin-inter-400", "builtin-inter-700",
	"builtin-mashanzheng-400", "builtin-longcang-400", "builtin-zcool-qingke-400", "builtin-liujianmaocao-400",
}

func builtinService(t *testing.T) (*assets.Service, context.Context) {
	t.Helper()
	db, cleanup := testutil.MySQL(t)
	t.Cleanup(cleanup)
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { store.Close() })
	svc := assets.NewService(db, store, nil, t.TempDir())
	ctx := context.Background()
	if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
		t.Fatal(e)
	}
	return svc, ctx
}

func TestBuiltinFontsUpgradeIsIdempotent(t *testing.T) {
	svc, ctx := builtinService(t)
	db := svc.DB
	legacy := map[string]bool{
		"builtin-noto-sc-400": true, "builtin-noto-sc-700": true,
		"builtin-inter-400": true, "builtin-inter-700": true,
	}
	var added []string
	for _, id := range builtinFaceIDs {
		if !legacy[id] {
			added = append(added, id)
		}
	}
	// Simulate an installation that shipped only the original four faces.
	for _, id := range added {
		for _, statement := range []string{
			"DELETE FROM asset_refs WHERE asset_id=?",
			"DELETE FROM resource_versions WHERE resource_id=?",
			"DELETE FROM resources WHERE id=?",
			"DELETE FROM assets WHERE id=?",
		} {
			if _, e := db.Exec(statement, id); e != nil {
				t.Fatal(e)
			}
		}
	}
	list, e := svc.ListFonts(ctx, auth.Principal{UserID: "reader", Role: "user"})
	if e != nil || len(list) != 4 {
		t.Fatalf("legacy install faces %d %v", len(list), e)
	}
	for range 2 {
		if e = svc.BootstrapFonts(ctx, repoRoot(t)); e != nil {
			t.Fatal(e)
		}
	}
	list, e = svc.ListFonts(ctx, auth.Principal{UserID: "reader", Role: "user"})
	if e != nil || len(list) != 15 {
		t.Fatalf("upgraded faces %d %v", len(list), e)
	}
	seen := map[string]int{}
	for _, f := range list {
		seen[f.AssetID]++
	}
	for _, id := range added {
		if seen[id] != 1 {
			t.Fatalf("upgraded face %s appears %d times", id, seen[id])
		}
	}
}

func TestBuiltinFontsRemainVisibleAtCatalogLimit(t *testing.T) {
	svc, ctx := builtinService(t)
	for i := range 105 {
		id := fmt.Sprintf("custom-font-%03d", i)
		metadata := fmt.Sprintf(`{"family":"自定义字体 %d","weight":400,"style":"normal"}`, i)
		zero := strings.Repeat("0", 64)
		if _, e := svc.DB.Exec("INSERT INTO assets(id,kind,name) VALUES(?,'font',?)", id, id); e != nil {
			t.Fatal(e)
		}
		if _, e := svc.DB.Exec("INSERT INTO asset_versions(asset_id,version,original_key,normalized_key,mime,original_size,normalized_size,original_sha256,normalized_sha256,metadata) VALUES(?,1,'key','key','font/ttf',1,1,?,?,?)", id, zero, zero, metadata); e != nil {
			t.Fatal(e)
		}
		if _, e := svc.DB.Exec("INSERT INTO resources(id,kind,title,published,created_by,sort_order) VALUES(?,'font',?,1,'system',0)", id, id); e != nil {
			t.Fatal(e)
		}
		if _, e := svc.DB.Exec("INSERT INTO resource_versions(resource_id,version,asset_id,asset_version,metadata) VALUES(?,1,?,1,?)", id, id, metadata); e != nil {
			t.Fatal(e)
		}
	}
	list, e := svc.ListFonts(ctx, auth.Principal{UserID: "reader", Role: "user"})
	if e != nil {
		t.Fatal(e)
	}
	if len(list) != 100 {
		t.Fatalf("catalog faces %d, want 100", len(list))
	}
	seen := map[string]bool{}
	for _, f := range list {
		seen[f.AssetID] = true
	}
	for _, id := range builtinFaceIDs {
		if !seen[id] {
			t.Fatalf("builtin face %s dropped at the catalog limit", id)
		}
	}
}
