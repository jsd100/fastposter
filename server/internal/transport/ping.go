package transport

import (
	"context"
	"fastposter/server/gen/kitex/core"
)

type CoreHandler struct{}

func (*CoreHandler) Ping(_ context.Context, r *core.PingRequest) (*core.PingResponse, error) {
	return &core.PingResponse{RequestId: r.RequestId, Message: "pong"}, nil
}
