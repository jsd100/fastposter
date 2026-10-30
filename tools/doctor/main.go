package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"time"

	"fastposter/internal/config"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type Result struct {
	Component string `json:"component"`
	OK        bool   `json:"ok"`
	Message   string `json:"message"`
}

func checkExecutable(name, path string) Result {
	resolved, err := exec.LookPath(path)
	if err != nil {
		return Result{name, false, "not installed: configure executable path"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	arg := "--version"
	if name == "magick" {
		arg = "-version"
	}
	if err := exec.CommandContext(ctx, resolved, arg).Run(); err != nil {
		return Result{name, false, "executable cannot run"}
	}
	return Result{name, true, "available"}
}
func sanitizeDBError(_, _ string) string {
	return "MySQL connection failed; check host, port, username and password in .env.local (credentials withheld)"
}
func main() {
	kind := flag.String("check", "all", "config|services|render|all")
	flag.Parse()
	c, err := config.FromRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	out := []Result{{"config", true, "configuration valid; data root resolved"}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if *kind == "all" || *kind == "services" {
		db, e := sql.Open("mysql", c.MySQLDSN)
		if e == nil {
			defer db.Close()
			e = db.PingContext(ctx)
		}
		if e != nil {
			out = append(out, Result{"mysql", false, sanitizeDBError(c.MySQLDSN, e.Error())})
		} else {
			var version string
			e = db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
			out = append(out, Result{"mysql", e == nil, "connected; version " + version})
		}
		if c.RedisAddr != "" {
			r := redis.NewClient(&redis.Options{Addr: c.RedisAddr})
			e = r.Ping(ctx).Err()
			r.Close()
			out = append(out, Result{"redis", e == nil, "optional rate limiter connectivity checked"})
		}
	}
	if *kind == "all" || *kind == "render" {
		out = append(out, checkExecutable("chrome", c.ChromePath), checkExecutable("magick", c.MagickPath))
	}
	if *kind != "all" && *kind != "config" && *kind != "services" && *kind != "render" {
		fmt.Fprintln(os.Stderr, "unknown check")
		os.Exit(2)
	}
	json.NewEncoder(os.Stdout).Encode(out)
	for _, r := range out {
		if !r.OK {
			os.Exit(1)
		}
	}
}
