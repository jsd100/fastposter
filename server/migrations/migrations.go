package migrations

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"strings"
)

//go:embed *.sql
var files embed.FS

func run(ctx context.Context, db *sql.DB, name string) error {
	data, e := files.ReadFile(name)
	if e != nil {
		return e
	}
	for _, statement := range strings.Split(string(data), ";") {
		if sql := strings.TrimSpace(statement); sql != "" {
			if _, e = db.ExecContext(ctx, sql); e != nil {
				return fmt.Errorf("migration %s failed: %w", name, e)
			}
		}
	}
	return nil
}
func Up(ctx context.Context, db *sql.DB) error {
	if _, e := db.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS _schema_migrations (version INT PRIMARY KEY, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB"); e != nil {
		return e
	}
	var count int
	if e := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM _schema_migrations WHERE version=1").Scan(&count); e != nil {
		return e
	}
	if count > 0 {
		return nil
	}
	if e := run(ctx, db, "000001_initial.up.sql"); e != nil {
		return e
	}
	_, e := db.ExecContext(ctx, "INSERT INTO _schema_migrations(version) VALUES(1)")
	return e
}
func Down(ctx context.Context, db *sql.DB) error {
	if e := run(ctx, db, "000001_initial.down.sql"); e != nil {
		return e
	}
	_, e := db.ExecContext(ctx, "DROP TABLE IF EXISTS _schema_migrations")
	return e
}
