package main

import (
	"bufio"
	"context"
	"fastposter/internal/config"
	"fastposter/server/internal/app"
	"fastposter/server/internal/auth"
	"flag"
	"fmt"
	"golang.org/x/term"
	"log"
	"os"
	"strings"
)

func main() {
	username := flag.String("username", "admin", "administrator username")
	stdin := flag.Bool("password-stdin", false, "read password from stdin rather than prompt")
	flag.Parse()
	var password string
	if !*stdin && term.IsTerminal(int(os.Stdin.Fd())) {
		fmt.Fprint(os.Stderr, "Administrator password: ")
		raw, e := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(os.Stderr)
		if e != nil {
			log.Fatal("could not read password")
		}
		password = string(raw)
	} else {
		line, e := bufio.NewReader(os.Stdin).ReadString('\n')
		if e != nil && len(line) == 0 {
			log.Fatal("provide a password through stdin")
		}
		password = strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	}
	c, e := config.FromRoot()
	if e != nil {
		log.Fatal(e)
	}
	ctx := context.Background()
	db, e := app.OpenMySQL(ctx, c.MySQLDSN)
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	service, e := auth.NewService(db, nil)
	if e != nil {
		log.Fatal("initialization failed")
	}
	user, e := service.CreateAdmin(ctx, *username, password)
	if e != nil {
		log.Fatal(e)
	}
	fmt.Printf("Created administrator %s (%s). Password was not recorded.\n", user.Username, user.ID)
}
