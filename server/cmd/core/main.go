package main

import (
	"fastposter/internal/config"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/transport"
	"github.com/cloudwego/kitex/server"
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
	s := coreservice.NewServer(&transport.CoreHandler{}, server.WithServiceAddr(addr))
	if e = s.Run(); e != nil {
		log.Fatal(e)
	}
}
