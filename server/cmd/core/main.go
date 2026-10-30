package main

import (
	"context"
	"fastposter/internal/config"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/app"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/transport"
	"github.com/cloudwego/kitex/server"
	"github.com/redis/go-redis/v9"
	"log"
	"net"
)

func main() {
	c, e := config.FromRoot()
	if e != nil {
		log.Fatal(e)
	}
	addr, e := net.ResolveTCPAddr("tcp", c.CoreAddr)
	if e != nil {
		log.Fatal(e)
	}
	db, e := app.OpenMySQL(context.Background(), c.MySQLDSN)
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	var version int
	if e = db.QueryRow("SELECT MAX(version) FROM _schema_migrations").Scan(&version); e != nil || version != 1 {
		log.Fatal("database schema is not ready; run go run ./server/cmd/migrate -direction up")
	}
	var limiterRedis *redis.Client
	if c.RedisAddr != "" {
		limiterRedis = redis.NewClient(&redis.Options{Addr: c.RedisAddr, MaxRetries: -1})
		defer limiterRedis.Close()
	}
	accounts, e := auth.NewService(db, limiterRedis)
	if e != nil {
		log.Fatal("account service initialization failed")
	}
	s := coreservice.NewServer(&transport.CoreHandler{AuthFunc: transport.AuthAdapter(accounts), Health: db.PingContext}, server.WithServiceAddr(addr))
	if e = s.Run(); e != nil {
		log.Fatal(e)
	}
}
