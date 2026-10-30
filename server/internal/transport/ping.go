package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/gen/kitex/core"
)

type CoreHandler struct {
	Health        func(context.Context) error
	AuthFunc      func(context.Context, *common.AuthCall) (*common.RPCReply, error)
	ProjectsFunc  func(context.Context, *common.ProjectCall) (*common.RPCReply, error)
	AssetsFunc    func(context.Context, *common.AssetCall) (*common.RPCReply, error)
	CatalogFunc   func(context.Context, *common.CatalogCall) (*common.RPCReply, error)
	TemplatesFunc func(context.Context, *common.TemplateCall) (*common.RPCReply, error)
	ExportsFunc   func(context.Context, *common.ExportCall) (*common.RPCReply, error)
	AdminFunc     func(context.Context, *common.AdminCall) (*common.RPCReply, error)
}

func (h *CoreHandler) Ping(ctx context.Context, r *core.PingRequest) (*core.PingResponse, error) {
	if h.Health != nil {
		if e := h.Health(ctx); e != nil {
			return nil, e
		}
	}
	return &core.PingResponse{RequestId: r.RequestId, Message: "pong"}, nil
}
