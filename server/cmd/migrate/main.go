package main

import (
	"context"
	"fastposter/internal/config"
	"fastposter/server/internal/app"
	"fastposter/server/migrations"
	"flag"
	"log"
	"time"
)

func main() {
	direction := flag.String("direction", "up", "up|down")
	confirm := flag.Bool("allow-destructive-down", false, "explicitly allow destructive rollback")
	flag.Parse()
	if *direction != "up" && *direction != "down" {
		log.Fatal("invalid migration direction")
	}
	if *direction == "down" && !*confirm {
		log.Fatal("down requires -allow-destructive-down; it removes this application's tables")
	}
	cfg, e := config.FromRoot()
	if e != nil {
		log.Fatal(e)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	db, e := app.OpenMySQL(ctx, cfg.MySQLDSN)
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	if *direction == "up" {
		e = migrations.Up(ctx, db)
	} else {
		e = migrations.Down(ctx, db)
	}
	if e != nil {
		log.Fatal(e)
	}
	log.Print("migration completed")
}
