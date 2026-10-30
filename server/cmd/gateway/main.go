package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fastposter/internal/config"
	"fastposter/server/gen/kitex/core"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/transport"
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/kitex/client"
	"log"
	"time"
)

func main() {
	c, e := config.FromRoot()
	if e != nil {
		log.Fatal(e)
	}
	rpc, e := coreservice.NewClient("fastposter.core", client.WithHostPorts(c.CoreAddr), client.WithRPCTimeout(3*time.Second))
	if e != nil {
		log.Fatal(e)
	}
	h := server.Default(server.WithHostPorts(c.GatewayAddr), server.WithMaxRequestBodySize(82<<20))
	gateway := transport.Gateway{RPC: rpc, AllowedOrigins: c.AppOrigins, SecureCookies: c.CookieSecure}
	gateway.Register(h)
	h.GET("/api/v1/health", func(ctx context.Context, r *app.RequestContext) {
		var b [12]byte
		rand.Read(b[:])
		id := hex.EncodeToString(b[:])
		reply, e := rpc.Ping(ctx, &core.PingRequest{RequestId: id})
		if e != nil {
			r.JSON(503, utils.H{"code": "CORE_UNAVAILABLE", "message": "业务服务未就绪", "requestId": id})
			return
		}
		r.JSON(200, utils.H{"message": reply.Message, "requestId": reply.RequestId})
	})
	h.Spin()
}
