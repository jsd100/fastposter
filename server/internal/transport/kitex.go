package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
)

func notReady(c *common.CallContext) (*common.RPCReply, error) {
	id := ""
	if c != nil {
		id = c.RequestId
	}
	return &common.RPCReply{Data: &common.PublicPayload{RequestId: id}, Error: &common.APIError{Code: "NOT_READY", Message: "该服务尚未完成初始化", RequestId: id}}, nil
}
func (h *CoreHandler) Auth(c context.Context, r *common.AuthCall) (*common.RPCReply, error) {
	if h.AuthFunc != nil {
		return h.AuthFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Projects(c context.Context, r *common.ProjectCall) (*common.RPCReply, error) {
	if h.ProjectsFunc != nil {
		return h.ProjectsFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Assets(c context.Context, r *common.AssetCall) (*common.RPCReply, error) {
	if h.AssetsFunc != nil {
		return h.AssetsFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Catalog(c context.Context, r *common.CatalogCall) (*common.RPCReply, error) {
	if h.CatalogFunc != nil {
		return h.CatalogFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Templates(c context.Context, r *common.TemplateCall) (*common.RPCReply, error) {
	if h.TemplatesFunc != nil {
		return h.TemplatesFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Exports(c context.Context, r *common.ExportCall) (*common.RPCReply, error) {
	if h.ExportsFunc != nil {
		return h.ExportsFunc(c, r)
	}
	return notReady(r.Context)
}
func (h *CoreHandler) Admin(c context.Context, r *common.AdminCall) (*common.RPCReply, error) {
	if h.AdminFunc != nil {
		return h.AdminFunc(c, r)
	}
	return notReady(r.Context)
}
