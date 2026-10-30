package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
)

func FontCatalogAdapter(accounts *auth.Service, service *assets.Service) func(context.Context, *common.CatalogCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.CatalogCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e != nil {
			return response(c, nil, e), nil
		}
		if call.Action != "ListFonts" {
			return response(c, nil, domain.E("NOT_READY", "素材目录尚未初始化")), nil
		}
		fonts, e := service.ListFonts(ctx, p)
		data := &common.PublicPayload{Fonts: []*common.FontDTO{}}
		for _, f := range fonts {
			data.Fonts = append(data.Fonts, &common.FontDTO{AssetId: f.AssetID, Version: f.Version, Family: f.Family, Weight: int32(f.Weight), Style: f.Style, Url: f.URL})
		}
		return response(c, data, e), nil
	}
}
