package testutil

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fastposter/server/internal/app"
	"fastposter/server/migrations"
	"github.com/go-sql-driver/mysql"
	"os"
	"strings"
	"testing"
	"time"
)

func ValidateTestDSN(dsn string) (*mysql.Config, error) {
	cfg, e := mysql.ParseDSN(dsn)
	if e != nil || !strings.HasPrefix(cfg.DBName, "fastposter_test_") {
		return nil, errors.New("tests require FASTPOSTER_TEST_MYSQL_DSN pointing to fastposter_test_* database")
	}
	return cfg, nil
}
func MySQL(t *testing.T) (*sql.DB, func()) {
	t.Helper()
	dsn := os.Getenv("FASTPOSTER_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("FASTPOSTER_TEST_MYSQL_DSN not configured; real database integration not run")
	}
	cfg, e := ValidateTestDSN(dsn)
	if e != nil {
		t.Fatal(e)
	}
	var b [8]byte
	rand.Read(b[:])
	name := "fastposter_test_" + hex.EncodeToString(b[:])
	cfg.DBName = ""
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	admin, e := app.OpenMySQL(ctx, cfg.FormatDSN())
	if e != nil {
		t.Fatal(e)
	}
	if _, e = admin.ExecContext(ctx, "CREATE DATABASE `"+name+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); e != nil {
		admin.Close()
		t.Fatal(e)
	}
	cfg.DBName = name
	db, e := app.OpenMySQL(ctx, cfg.FormatDSN())
	cleanup := func() {
		if db != nil {
			db.Close()
		}
		admin.Exec("DROP DATABASE `" + name + "`")
		admin.Close()
	}
	if e != nil {
		cleanup()
		t.Fatal(e)
	}
	if e = migrations.Up(ctx, db); e != nil {
		cleanup()
		t.Fatal(e)
	}
	return db, cleanup
}
