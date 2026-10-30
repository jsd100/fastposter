package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fastposter/server/internal/templates"
)

func TemplatesAdapter(accounts *auth.Service, service *templates.Service) func(context.Context, *common.TemplateCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.TemplateCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e != nil {
			return response(c, nil, e), nil
		}
		switch call.Action {
		case "ApplyTemplate":
			project, e := service.Apply(ctx, p, call.GetId(), call.GetVersion())
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.Project = PublicProject(project)
			}
			return reply, nil
		case "ExportTemplate", "AdminExportTemplate":
			var key storage.Key
			if call.Action == "AdminExportTemplate" {
				key, e = service.ExportResource(ctx, p, call.GetId(), call.GetVersion())
			} else {
				key, e = service.Export(ctx, p, call.GetId())
			}
			reply := response(c, nil, e)
			if e == nil {
				value := string(key)
				mime := "application/zip"
				filename := "FastPoster-" + call.GetId() + ".zip"
				reply.FileKey = &value
				reply.ContentType = &mime
				reply.Filename = &filename
			}
			return reply, nil
		case "ImportTemplate", "AdminImportTemplate":
			purpose := "templates"
			if call.Action == "AdminImportTemplate" {
				if e = auth.RequireAdmin(p); e != nil {
					return response(c, nil, e), nil
				}
				purpose = "admin-templates"
			}
			key := storage.Key(call.GetStagedKey())
			reader, e := service.Assets.ClaimStage(ctx, p, key, purpose)
			if e != nil {
				return response(c, nil, e), nil
			}
			defer reader.Close()
			reply := response(c, nil, nil)
			if call.Action == "ImportTemplate" {
				project, err := service.Import(ctx, p, reader)
				e = err
				if e == nil {
					reply.Data.Project = PublicProject(project)
				}
			} else {
				resource, err := service.ImportResource(ctx, p, reader)
				e = err
				if e == nil {
					reply.Data.Resource, e = publicResource(ctx, service.Catalog, p, resource)
				}
			}
			reader.Close()
			service.Assets.EndStage(context.WithoutCancel(ctx), p, key, e == nil)
			if e != nil {
				return response(c, nil, e), nil
			}
			return reply, nil
		}
		return response(c, nil, domain.E("INVALID_INPUT", "未知模板操作")), nil
	}
}
