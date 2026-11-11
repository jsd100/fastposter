package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/copy"
	"fastposter/server/internal/domain"
)

func resourceFilter(q *common.CatalogQuery) catalog.Filter {
	if q == nil {
		return catalog.Filter{}
	}
	return catalog.Filter{Page: int(q.GetPage()), PageSize: int(q.GetPageSize()), Keyword: q.GetKeyword(), CategoryID: q.GetCategoryId(), ParentID: q.GetParentId()}
}
func publicResource(ctx context.Context, service *catalog.Service, p auth.Principal, r catalog.Resource) (*common.ResourceDTO, error) {
	out := &common.ResourceDTO{Id: r.ID, Kind: r.Kind, Title: r.Title, Version: r.Version, SortOrder: int32(r.SortOrder), Published: r.Published}
	if r.CategoryID != "" {
		out.CategoryId = &r.CategoryID
	}
	if r.ParentID != "" {
		out.ParentId = &r.ParentID
	}
	if r.Document != "" {
		out.Document = &r.Document
	}
	if r.Body != "" {
		out.Body = &r.Body
	}
	if r.Family != "" {
		out.Family = &r.Family
		weight := int32(r.Weight)
		out.Weight = &weight
		out.Style = &r.Style
	}
	if r.License != "" {
		out.License = &r.License
	}
	if r.AssetID != "" {
		asset, e := service.Assets.Get(ctx, p, r.AssetID)
		if e != nil {
			return nil, e
		}
		out.Asset = PublicAsset(asset)
	}
	return out, nil
}
func CatalogAdapter(accounts *auth.Service, service *catalog.Service, copies *copy.Service) func(context.Context, *common.CatalogCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.CatalogCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e != nil {
			return response(c, nil, e), nil
		}
		if call.Action == "ListFonts" {
			return FontCatalogAdapter(accounts, service.Assets)(ctx, call)
		}
		if call.Action == "CheckFonts" {
			if call.FontCheck == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少字体检查文档")), nil
			}
			return response(c, nil, service.CheckFonts(ctx, p, call.FontCheck.Document)), nil
		}
		admin := call.Action == "AdminResources" || call.Action == "AdminSaveResource" || call.Action == "AdminDeleteResource" || call.Action == "AdminMoveResource" || call.Action == "AdminGetResource"
		if admin {
			if e = auth.RequireAdmin(p); e != nil {
				return response(c, nil, e), nil
			}
		}
		switch call.Action {
		case "ListCatalog", "AdminResources":
			q := call.Query
			if q == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少素材类型")), nil
			}
			rows, total, e := service.List(ctx, p, q.Kind, resourceFilter(q), admin)
			data := &common.PublicPayload{Resources: []*common.ResourceDTO{}}
			n := int32(total)
			data.Total = &n
			if e == nil {
				for _, row := range rows {
					item, err := publicResource(ctx, service, p, row)
					if err != nil {
						return response(c, nil, err), nil
					}
					data.Resources = append(data.Resources, item)
				}
			}
			return response(c, data, e), nil
		case "AdminSaveResource":
			in := call.Input
			if in == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少素材内容")), nil
			}
			row, e := service.Save(ctx, p, catalog.ResourceInput{ID: in.GetId(), Kind: in.Kind, Title: in.Title, CategoryID: in.GetCategoryId(), ParentID: in.GetParentId(), SortOrder: int(in.GetSortOrder()), Published: in.GetPublished(), AssetID: in.GetAssetId(), Document: in.GetDocument(), Body: in.GetBody(), Family: in.GetFamily(), Weight: int(in.GetWeight()), Style: in.GetStyle(), License: in.GetLicense(), ExpectedVersion: in.GetExpectedVersion()})
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Resource, e = publicResource(ctx, service, p, row)
				if e != nil {
					return response(c, nil, e), nil
				}
			}
			return reply, nil
		case "AdminDeleteResource":
			return response(c, nil, service.Delete(ctx, p, call.GetId())), nil
		case "AdminMoveResource":
			if call.Move == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少分类移动参数")), nil
			}
			return response(c, nil, copies.MoveCategory(ctx, p, call.Move.GetId(), call.Move.GetParentId(), call.Move.GetExpectedVersion())), nil
		case "AdminGetResource":
			row, e := service.Get(ctx, p, call.GetId(), true)
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Resource, e = publicResource(ctx, service, p, row)
				if e != nil {
					return response(c, nil, e), nil
				}
			}
			return reply, nil
		}
		return response(c, nil, domain.E("INVALID_INPUT", "未知素材操作")), nil
	}
}
