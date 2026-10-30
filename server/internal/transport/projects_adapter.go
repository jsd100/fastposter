package transport

import (
	"context"
	"encoding/json"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projects"
	"fmt"
	"time"
)

func PublicProject(p projects.Project) *common.ProjectDTO {
	raw, _ := json.Marshal(p.Document)
	preview := fmt.Sprintf("/api/v1/assets/%s/versions/%s?variant=preview", p.Document.Background.AssetID, p.Document.Background.Version)
	dto := &common.ProjectDTO{Id: p.ID, Title: p.Title, Document: string(raw), Revision: p.Revision, Width: int32(p.Document.Canvas.Width), Height: int32(p.Document.Canvas.Height), UpdatedAt: p.UpdatedAt.UTC().Format(time.RFC3339Nano), PreviewUrl: &preview}
	if p.DeletedAt != nil {
		at := p.DeletedAt.UTC().Format(time.RFC3339Nano)
		dto.DeletedAt = &at
	}
	return dto
}
func ProjectsAdapter(accounts *auth.Service, service *projects.Service) func(context.Context, *common.ProjectCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.ProjectCall) (*common.RPCReply, error) {
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
		var result projects.Project
		switch call.Action {
		case "ListProjects":
			q := call.Query
			if q == nil {
				q = &common.ProjectListQuery{}
			}
			items, total, e := service.List(ctx, p, int(q.GetPage()), int(q.GetPageSize()), q.GetTrash(), q.GetKeyword())
			data := &common.PublicPayload{Projects: []*common.ProjectDTO{}}
			t := int32(total)
			data.Total = &t
			for _, a := range items {
				data.Projects = append(data.Projects, PublicProject(a))
			}
			return response(c, data, e), nil
		case "CreateProject":
			input := call.Create
			if input == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少作品文档")), nil
			}
			var doc document.Document
			doc, e = document.Parse([]byte(input.Document))
			if e != nil {
				return response(c, nil, domain.E("INVALID_INPUT", "作品文档无效")), nil
			}
			result, e = service.Create(ctx, p, input.Title, doc)
		case "SaveProject":
			input := call.Save
			if input == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少作品文档")), nil
			}
			var doc document.Document
			doc, e = document.Parse([]byte(input.Document))
			if e != nil {
				return response(c, nil, domain.E("INVALID_INPUT", "作品文档无效")), nil
			}
			result, e = service.Save(ctx, p, call.GetId(), input.ExpectedRevision, input.Title, doc)
		case "GetProject":
			result, e = service.Get(ctx, p, call.GetId())
		case "CloneProject":
			result, e = service.Clone(ctx, p, call.GetId())
		case "DeleteProject":
			return response(c, nil, service.SoftDelete(ctx, p, call.GetId())), nil
		case "RestoreProject":
			result, e = service.Restore(ctx, p, call.GetId())
		default:
			return response(c, nil, domain.E("INVALID_INPUT", "未知作品操作")), nil
		}
		reply := response(c, nil, e)
		if e == nil {
			reply.Data.Project = PublicProject(result)
		}
		return reply, nil
	}
}
