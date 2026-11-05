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

const CurrentVersion = 2

type step struct {
	version int
	up      string
	down    string
}

var steps = []step{
	{version: 1, up: "000001_initial.up.sql", down: "000001_initial.down.sql"},
	{version: 2, up: "000002_project_deletions.up.sql", down: "000002_project_deletions.down.sql"},
}

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

func ensureVersionTable(ctx context.Context, db *sql.DB) error {
	_, e := db.ExecContext(ctx, "CREATE TABLE IF NOT EXISTS _schema_migrations (version INT PRIMARY KEY, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB")
	return e
}

func applied(ctx context.Context, db *sql.DB, version int) (bool, error) {
	var count int
	if e := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM _schema_migrations WHERE version=?", version).Scan(&count); e != nil {
		return false, e
	}
	return count > 0, nil
}

func Up(ctx context.Context, db *sql.DB) error {
	if e := ensureVersionTable(ctx, db); e != nil {
		return e
	}
	for _, step := range steps {
		done, e := applied(ctx, db, step.version)
		if e != nil {
			return e
		}
		if done {
			continue
		}
		if e = run(ctx, db, step.up); e != nil {
			return e
		}
		if _, e = db.ExecContext(ctx, "INSERT INTO _schema_migrations(version) VALUES(?)", step.version); e != nil {
			return e
		}
	}
	return nil
}

func Down(ctx context.Context, db *sql.DB) error {
	for i := len(steps) - 1; i >= 0; i-- {
		if e := run(ctx, db, steps[i].down); e != nil {
			return e
		}
	}
	_, e := db.ExecContext(ctx, "DROP TABLE IF EXISTS _schema_migrations")
	return e
}
