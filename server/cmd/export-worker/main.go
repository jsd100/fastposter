package main

import (
	"context"
	"fastposter/internal/config"
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
	if e = os.MkdirAll(c.AbsoluteDataDir, 0700); e != nil {
		log.Fatal(e)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	log.Print("worker process initialized; export queue integration follows rendering validation")
	<-ctx.Done()
}
