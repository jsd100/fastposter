package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/exports"
	"time"
)

func PublicJob(j exports.Job) *common.JobDTO {
	dto := &common.JobDTO{Id: j.ID, ProjectId: j.ProjectID, Revision: j.Revision, Status: j.State, CreatedAt: j.CreatedAt.UTC().Format(time.RFC3339Nano)}
	if j.ErrorMessage != "" {
		message := j.ErrorMessage
		dto.ErrorMessage = &message
	}
	if j.State == "succeeded" {
		download := "/api/v1/exports/" + j.ID + "/download"
		preview := "/api/v1/exports/" + j.ID + "/preview"
		dto.DownloadUrl = &download
		dto.PreviewUrl = &preview
	}
	return dto
}
func ExportsAdapter(accounts *auth.Service, service *exports.Service) func(context.Context, *common.ExportCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.ExportCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e != nil {
			return response(c, nil, e), nil
		}
		var job exports.Job
		switch call.Action {
		case "CreateExport":
			input := call.Create
			if input == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "缺少导出参数")), nil
			}
			job, e = service.Create(ctx, p, input.ProjectId, input.Revision, input.IdempotencyKey)
		case "GetExport":
			job, e = service.Get(ctx, p, call.GetId())
		case "DownloadExport", "PreviewExport":
			key, name, e := service.Read(ctx, p, call.GetId(), call.Action == "PreviewExport")
			reply := response(c, nil, e)
			if e == nil {
				k := string(key)
				mime := "image/png"
				reply.FileKey = &k
				reply.Filename = &name
				reply.ContentType = &mime
			}
			return reply, nil
		default:
			return response(c, nil, domain.E("INVALID_INPUT", "未知导出操作")), nil
		}
		reply := response(c, nil, e)
		if e == nil {
			reply.Data.Job = PublicJob(job)
		}
		return reply, nil
	}
}
