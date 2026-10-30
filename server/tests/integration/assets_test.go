package integration_test

import (
	"context"
	"errors"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/testutil"
	"io"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func assetFixture(t *testing.T) io.ReadCloser {
	t.Helper()
	f, e := os.Open(filepath.Join(repoRoot(t), "tests/fixtures/images/rgba.png"))
	if e != nil {
		t.Fatal(e)
	}
	return f
}
func TestAssetReadChecksOwnership(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled'),('u2','two','two','disabled')")
	store, e := storage.NewLocal(t.TempDir())
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	root := repoRoot(t)
	service := assets.NewService(db, store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	source := assetFixture(t)
	defer source.Close()
	owner := auth.Principal{UserID: "u1", Role: "user"}
	asset, e := service.Upload(context.Background(), owner, "poster.png", source)
	if e != nil {
		t.Fatal(e)
	}
	key, e := service.AuthorizeRead(context.Background(), owner, asset.ID, asset.Version)
	if e != nil {
		t.Fatal(e)
	}
	r, e := store.Open(context.Background(), key)
	if e != nil {
		t.Fatal(e)
	}
	r.Close()
	if _, e = service.AuthorizeRead(context.Background(), auth.Principal{UserID: "u2", Role: "user"}, asset.ID, asset.Version); e == nil {
		t.Fatal("another user could read private background")
	}
	original, e := store.Open(context.Background(), asset.OriginalKey)
	if e != nil {
		t.Fatal(e)
	}
	defer original.Close()
	raw, _ := io.ReadAll(original)
	want, _ := os.ReadFile(filepath.Join(root, "tests/fixtures/images/rgba.png"))
	if string(raw) != string(want) {
		t.Fatal("original upload bytes changed")
	}
}
func TestAssetDBFailureLeavesNoAvailableAsset(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled')")
	if _, e := db.Exec("ALTER TABLE assets ADD CONSTRAINT force_registration_failure CHECK (1=0)"); e != nil {
		t.Fatal(e)
	}
	store, _ := storage.NewLocal(t.TempDir())
	defer store.Close()
	root := repoRoot(t)
	service := assets.NewService(db, store, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	source := assetFixture(t)
	defer source.Close()
	if _, e := service.Upload(context.Background(), auth.Principal{UserID: "u1", Role: "user"}, "poster.png", source); e == nil {
		t.Fatal("database failure reported upload success")
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM assets").Scan(&count)
	if count != 0 {
		t.Fatal("half-registered asset remains available")
	}
}

type diskFullStore struct{ storage.FileStore }

func (s diskFullStore) Put(context.Context, storage.Key, io.Reader) (storage.FileInfo, error) {
	return storage.FileInfo{}, syscall.ENOSPC
}
func TestAssetDiskFullReturnsUploadFailure(t *testing.T) {
	db, cleanup := testutil.MySQL(t)
	defer cleanup()
	if _, e := db.Exec("INSERT INTO users(id,username,username_normalized,password_hash) VALUES ('u1','one','one','disabled')"); e != nil {
		t.Fatal(e)
	}
	store, _ := storage.NewLocal(t.TempDir())
	defer store.Close()
	root := repoRoot(t)
	service := assets.NewService(db, diskFullStore{store}, &assets.Normalizer{MagickPath: "magick", ProfilePath: filepath.Join(root, "assets/color/sRGB.icc"), PolicyDir: filepath.Join(root, "deploy/imagemagick")}, t.TempDir())
	source := assetFixture(t)
	defer source.Close()
	_, e := service.Upload(context.Background(), auth.Principal{UserID: "u1", Role: "user"}, "poster.png", source)
	var known *domain.Error
	if !errors.As(e, &known) || known.Code != "STORAGE_FULL" {
		t.Fatalf("disk failure not identified: %v", e)
	}
}
