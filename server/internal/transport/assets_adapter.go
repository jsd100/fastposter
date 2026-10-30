package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"net/url"
	"strconv"
	"strings"
)

func PublicAsset(a assets.AssetVersion) *common.AssetDTO {
	base := "/api/v1/assets/" + url.PathEscape(a.ID) + "/versions/" + url.PathEscape(a.Version)
	preview := base + "?variant=preview"
	return &common.AssetDTO{Id: a.ID, Version: a.Version, Kind: a.Kind, Name: a.Name, Width: int32(a.Width), Height: int32(a.Height), Size: strconv.FormatInt(a.OriginalSize, 10), Sha256: a.OriginalSHA256, PreviewUrl: &preview, Url: &base}
}
func AssetsAdapter(accounts *auth.Service, service *assets.Service) func(context.Context, *common.AssetCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.AssetCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e == nil {
			e = auth.RequireUsable(p)
		}
		if e != nil {
			return response(c, nil, e), nil
		}
		if strings.HasPrefix(call.Action, "Begin") {
			purposes := map[string]string{"BeginUploadImage": "images", "BeginUploadFont": "fonts", "BeginImportTemplate": "templates", "BeginAdminImportTemplate": "admin-templates"}
			purpose, ok := purposes[call.Action]
			if !ok {
				return response(c, nil, domain.E("INVALID_INPUT", "不支持的上传类型")), nil
			}
			key, e := service.BeginStage(ctx, p, purpose)
			reply := response(c, nil, e)
			if e == nil {
				v := string(key)
				reply.FileKey = &v
			}
			return reply, nil
		}
		switch call.Action {
		case "AbortUpload":
			return response(c, nil, service.EndStage(ctx, p, storage.Key(call.GetStagedKey()), false)), nil
		case "UploadFont":
			if e := auth.RequireAdmin(p); e != nil {
				return response(c, nil, e), nil
			}
			input := call.Font
			if input == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少字体属性")), nil
			}
			key := storage.Key(call.GetStagedKey())
			r, e := service.ClaimStage(ctx, p, key, "fonts")
			if e != nil {
				return response(c, nil, e), nil
			}
			asset, e := service.UploadFont(ctx, p, call.GetFilename(), input.Family, int(input.Weight), input.Style, input.GetLicense(), r)
			r.Close()
			service.EndStage(context.WithoutCancel(ctx), p, key, e == nil)
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Asset = PublicAsset(asset)
			}
			return reply, nil
		case "UploadImage":
			key := storage.Key(call.GetStagedKey())
			r, e := service.ClaimStage(ctx, p, key, "images")
			if e != nil {
				return response(c, nil, e), nil
			}
			asset, e := service.Upload(ctx, p, call.GetFilename(), r)
			r.Close()
			// A canceled request cannot prevent stage cleanup; ownership still comes from its resolved principal.
			service.EndStage(context.WithoutCancel(ctx), p, key, e == nil)
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Asset = PublicAsset(asset)
			}
			return reply, nil
		case "GetAsset":
			a, e := service.Get(ctx, p, call.GetId())
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Asset = PublicAsset(a)
			}
			return reply, nil
		case "ReadAsset":
			q := call.Read_
			if q == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少素材版本")), nil
			}
			key, mime, name, e := service.Read(ctx, p, q.Id, q.Version, q.GetVariant())
			reply := response(c, nil, e)
			if e == nil {
				v := string(key)
				reply.FileKey = &v
				reply.ContentType = &mime
				reply.Filename = &name
			}
			return reply, nil
		}
		return response(c, nil, domain.E("NOT_READY", "该上传类型尚未初始化")), nil
	}
}
