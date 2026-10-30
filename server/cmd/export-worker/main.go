package main

import (
	"context"
	"fastposter/internal/config"
	"fastposter/server/internal/app"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/exports"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"log"
	"os"
	"os/signal"
	"path/filepath"
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
	store, e := storage.NewLocal(c.AbsoluteDataDir)
	if e != nil {
		log.Fatal("local storage initialization failed")
	}
	defer store.Close()
	health, e := storage.CheckHealth(ctx, c.AbsoluteDataDir)
	if e != nil {
		log.Fatal("data directory is not writable: ", e)
	}
	if health.FreeBytes < 512<<20 {
		log.Printf("warning: only %d MiB free in %s", health.FreeBytes>>20, health.Path)
	}
	root, e := config.Root()
	if e != nil {
		log.Fatal(e)
	}
	worker := exports.Worker{Service: exports.NewService(db, store, projects.NewService(db, store)), Renderer: &exports.Renderer{ChromePath: c.ChromePath, RendererDir: filepath.Join(root, "apps/renderer/dist")}, TempRoot: filepath.Join(c.AbsoluteDataDir, ".work"), ID: domain.ID(), Paused: func() bool { return storage.MaintenanceActive(c.AbsoluteDataDir) }}
	log.Print("export worker ready; MySQL durable queue, concurrency 1")
	if e = worker.Run(ctx); e != nil && ctx.Err() == nil {
		log.Fatal("export worker stopped: ", e)
	}
}
