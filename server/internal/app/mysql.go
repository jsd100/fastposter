package app

import (
	"context"
	"database/sql"
	"errors"
	"github.com/go-sql-driver/mysql"
	"time"
)

func OpenMySQL(ctx context.Context, dsn string) (*sql.DB, error) {
	cfg, e := mysql.ParseDSN(dsn)
	if e != nil {
		return nil, errors.New("invalid MYSQL_DSN (details withheld)")
	}
	cfg.ParseTime = true
	cfg.Loc = time.UTC
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	cfg.Params["charset"] = "utf8mb4"
	cfg.Params["time_zone"] = "'+00:00'"
	cfg.Timeout = 5 * time.Second
	cfg.ReadTimeout = 10 * time.Second
	cfg.WriteTimeout = 10 * time.Second
	db, e := sql.Open("mysql", cfg.FormatDSN())
	if e != nil {
		return nil, errors.New("could not initialize MySQL")
	}
	db.SetMaxOpenConns(12)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(5 * time.Minute)
	if e = db.PingContext(ctx); e != nil {
		db.Close()
		return nil, errors.New("MySQL connection failed; check .env.local (credentials withheld)")
	}
	return db, nil
}
