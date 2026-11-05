package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/catalog"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/projectdeletions"
	"strconv"
	"time"
)

func adminFilter(q *common.ListQuery) catalog.Filter {
	if q == nil {
		return catalog.Filter{}
	}
	return catalog.Filter{Page: int(q.GetPage()), PageSize: int(q.GetPageSize()), Keyword: q.GetKeyword(), UserID: q.GetUserId()}
}
func adminProjectFilter(q *common.AdminProjectListQuery) catalog.Filter {
	if q == nil {
		return catalog.Filter{}
	}
	return catalog.Filter{Page: int(q.GetPage()), PageSize: int(q.GetPageSize()), Keyword: q.GetKeyword(), UserID: q.GetUserId(), Status: q.GetStatus()}
}
func AdminAdapter(accounts *auth.Service, service *catalog.Service, deletions *projectdeletions.Service) func(context.Context, *common.AdminCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.AdminCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			return response(c, nil, domain.E("AUTH_REQUIRED", "请先登录")), nil
		}
		p, e := accounts.ResolveSession(ctx, c.SessionToken)
		if e == nil {
			e = auth.RequireAdmin(p)
		}
		if e != nil {
			return response(c, nil, e), nil
		}
		data := &common.PublicPayload{}
		filter := adminFilter(call.Query)
		switch call.Action {
		case "AdminOverview":
			o, e := service.Overview(ctx, p)
			if e != nil {
				return response(c, nil, e), nil
			}
			data.Overview = &common.OverviewDTO{Users: int32(o.Users), Projects: int32(o.Projects), StorageBytes: strconv.FormatInt(o.StorageBytes, 10), SuccessfulExports: int32(o.SuccessfulExports), FailedExports: int32(o.FailedExports)}
		case "AdminUsers":
			rows, total, e := service.Users(ctx, p, filter)
			if e != nil {
				return response(c, nil, e), nil
			}
			n := int32(total)
			data.Total = &n
			data.Users = []*common.UserDTO{}
			for _, u := range rows {
				data.Users = append(data.Users, publicUser(u))
			}
		case "AdminProjects":
			rows, total, e := service.AdminProjects(ctx, p, adminProjectFilter(call.ProjectQuery))
			if e != nil {
				return response(c, nil, e), nil
			}
			n := int32(total)
			data.Total = &n
			data.MetadataProjects = []*common.ProjectMetadataDTO{}
			for _, row := range rows {
				data.MetadataProjects = append(data.MetadataProjects, &common.ProjectMetadataDTO{Id: row.ID, OwnerId: row.OwnerID, Title: row.Title, Revision: row.Revision, Width: int32(row.Width), Height: int32(row.Height), UpdatedAt: row.UpdatedAt, DeletedAt: row.DeletedAt})
			}
		case "AdminJobs":
			rows, total, e := service.Jobs(ctx, p, filter)
			if e != nil {
				return response(c, nil, e), nil
			}
			n := int32(total)
			data.Total = &n
			data.Jobs = []*common.JobDTO{}
			for _, j := range rows {
				dto := &common.JobDTO{Id: j.ID, ProjectId: j.ProjectID, Revision: j.Revision, Status: j.State, CreatedAt: j.CreatedAt.UTC().Format(time.RFC3339Nano)}
				if j.ErrorMessage != "" {
					message := j.ErrorMessage
					dto.ErrorMessage = &message
				}
				data.Jobs = append(data.Jobs, dto)
			}
		case "AdminAudit":
			rows, total, e := service.Audit(ctx, p, filter)
			if e != nil {
				return response(c, nil, e), nil
			}
			n := int32(total)
			data.Total = &n
			data.Audit = []*common.AuditDTO{}
			for _, a := range rows {
				data.Audit = append(data.Audit, &common.AuditDTO{Id: a.ID, ActorId: a.ActorID, Action: a.Action, TargetId: a.TargetID, CreatedAt: a.CreatedAt})
			}
		case "AdminUser":
			input := call.User
			if input == nil || input.Id == "system" {
				return response(c, nil, domain.E("INVALID_INPUT", "用户操作无效")), nil
			}
			switch input.Action {
			case "disable":
				e = accounts.SetDisabled(ctx, p, input.Id, true)
			case "enable":
				e = accounts.SetDisabled(ctx, p, input.Id, false)
			case "reset-password":
				var token string
				token, e = accounts.ResetPassword(ctx, p, input.Id)
				if e == nil {
					data.ResetToken = &token
				}
			default:
				e = domain.E("INVALID_INPUT", "用户操作无效")
			}
			if e != nil {
				return response(c, nil, e), nil
			}
			u, e := accounts.GetUser(ctx, input.Id)
			if e != nil {
				return response(c, nil, e), nil
			}
			data.User = publicUser(u)
		case "AdminPermanentlyDeleteProject":
			task, e := deletions.Accept(ctx, p, projectdeletions.AdminScope, call.GetId())
			if e != nil {
				return response(c, nil, e), nil
			}
			data.Deletion = PublicProjectDeletion(task)
		case "AdminListProjectDeletions":
			q := call.DeletionQuery
			if q == nil {
				q = &common.ProjectDeletionListQuery{}
			}
			items, total, e := deletions.List(ctx, p, projectdeletions.AdminScope, projectdeletions.Query{Page: int(q.GetPage()), PageSize: int(q.GetPageSize()), Keyword: q.GetKeyword(), OwnerID: q.GetOwnerId()})
			if e != nil {
				return response(c, nil, e), nil
			}
			n := int32(total)
			data.Total = &n
			data.Deletions = []*common.ProjectDeletionDTO{}
			for _, item := range items {
				data.Deletions = append(data.Deletions, PublicProjectDeletion(item))
			}
		case "AdminGetProjectDeletion":
			task, e := deletions.Get(ctx, p, projectdeletions.AdminScope, call.GetId())
			if e != nil {
				return response(c, nil, e), nil
			}
			data.Deletion = PublicProjectDeletion(task)
		case "AdminRetryProjectDeletion":
			task, e := deletions.Retry(ctx, p, projectdeletions.AdminScope, call.GetId())
			if e != nil {
				return response(c, nil, e), nil
			}
			data.Deletion = PublicProjectDeletion(task)
		default:
			return response(c, nil, domain.E("INVALID_INPUT", "未知管理操作")), nil
		}
		return response(c, data, nil), nil
	}
}
