package main

import (
	"context"
	"fastposter/internal/config"
	"fastposter/server/internal/app"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projectdeletions"
	"fastposter/server/internal/storage"
	"fastposter/server/migrations"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	c, e := config.FromRoot()
	if e != nil {
		log.Fatal(e)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, e := app.OpenMySQL(ctx, c.MySQLDSN)
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	var version int
	if e = db.QueryRowContext(ctx, "SELECT COALESCE(MAX(version),0) FROM _schema_migrations").Scan(&version); e != nil || version != migrations.CurrentVersion {
		log.Fatal("database schema is not ready; run go run ./server/cmd/migrate -direction up")
	}
	store, e := storage.NewLocal(c.AbsoluteDataDir)
	if e != nil {
		log.Fatal("local storage initialization failed")
	}
	defer store.Close()
	if _, e = storage.CheckHealth(ctx, c.AbsoluteDataDir); e != nil {
		log.Fatal("data directory is not writable: ", e)
	}
	worker := projectdeletions.Worker{
		Service: projectdeletions.NewService(db, store),
		Writers: storage.NewWriterGate(c.AbsoluteDataDir),
		Paused:  func() bool { return storage.MaintenanceActive(c.AbsoluteDataDir) },
		ID:      domain.ID(),
	}
	log.Print("cleanup worker ready; durable project file cleanup")
	if e = worker.Run(ctx); e != nil && ctx.Err() == nil {
		log.Fatal("cleanup worker stopped: ", e)
	}
}
