package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/gen/kitex/core"
)

type CoreHandler struct {
	AuthFunc      func(context.Context, *common.AuthCall) (*common.RPCReply, error)
	ProjectsFunc  func(context.Context, *common.ProjectCall) (*common.RPCReply, error)
	AssetsFunc    func(context.Context, *common.AssetCall) (*common.RPCReply, error)
	CatalogFunc   func(context.Context, *common.CatalogCall) (*common.RPCReply, error)
	TemplatesFunc func(context.Context, *common.TemplateCall) (*common.RPCReply, error)
	ExportsFunc   func(context.Context, *common.ExportCall) (*common.RPCReply, error)
	AdminFunc     func(context.Context, *common.AdminCall) (*common.RPCReply, error)
}

func (*CoreHandler) Ping(_ context.Context, r *core.PingRequest) (*core.PingResponse, error) {
	return &core.PingResponse{RequestId: r.RequestId, Message: "pong"}, nil
}
