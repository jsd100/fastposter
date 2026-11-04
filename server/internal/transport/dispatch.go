package transport

import (
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/domain"
	"github.com/cloudwego/hertz/pkg/app"
)

func badInput(c *common.CallContext, e error) (*common.RPCReply, error) {
	return response(c, nil, domain.E("INVALID_INPUT", e.Error())), nil
}
func (g *Gateway) dispatch(ctx context.Context, r *app.RequestContext, name string, c *common.CallContext) (*common.RPCReply, error) {
	switch name {
	case "Register", "Login":
		input, e := bindInput[common.Credentials](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Auth(ctx, &common.AuthCall{Context: c, Action: name, Credentials: input})
	case "Me", "Logout":
		return g.RPC.Auth(ctx, &common.AuthCall{Context: c, Action: name})
	case "ChangePassword":
		input, e := bindInput[common.ChangePasswordInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Auth(ctx, &common.AuthCall{Context: c, Action: name, PasswordInput: input})
	case "ListProjects":
		input, e := bindInput[common.ProjectListQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Projects(ctx, &common.ProjectCall{Context: c, Action: name, Query: input})
	case "CreateProject":
		input, e := bindInput[common.CreateProjectInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Projects(ctx, &common.ProjectCall{Context: c, Action: name, Create: input})
	case "SaveProject":
		input, e := bindInput[common.SaveProjectInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Projects(ctx, &common.ProjectCall{Context: c, Action: name, Id: &input.Id, Save: input})
	case "GetProject", "DeleteProject", "CloneProject", "RestoreProject", "PermanentlyDeleteProject", "GetProjectDeletion", "RetryProjectDeletion":
		id := r.Param("id")
		return g.RPC.Projects(ctx, &common.ProjectCall{Context: c, Action: name, Id: &id})
	case "ListProjectDeletions":
		input, e := bindInput[common.ProjectDeletionListQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Projects(ctx, &common.ProjectCall{Context: c, Action: name, DeletionQuery: input})
	case "GetAsset":
		id := r.Param("id")
		return g.RPC.Assets(ctx, &common.AssetCall{Context: c, Action: name, Id: &id})
	case "ReadAsset":
		input, e := bindInput[common.AssetReadQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Assets(ctx, &common.AssetCall{Context: c, Action: name, Id: &input.Id, Read_: input})
	case "ListCatalog", "AdminResources":
		input, e := bindInput[common.CatalogQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name, Query: input})
	case "CheckFonts":
		input, e := bindInput[common.FontCheckInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name, FontCheck: input})
	case "ListFonts":
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name})
	case "AdminSaveResource":
		input, e := bindInput[common.ResourceInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name, Input: input})
	case "AdminDeleteResource":
		id := r.Param("id")
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name, Id: &id})
	case "AdminMoveResource":
		input, e := bindInput[common.MoveResourceInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Catalog(ctx, &common.CatalogCall{Context: c, Action: name, Move: input})
	case "ApplyTemplate":
		input, e := bindInput[common.ApplyTemplateInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Templates(ctx, &common.TemplateCall{Context: c, Action: name, Id: &input.Id, Version: &input.Version})
	case "ExportTemplate", "AdminExportTemplate":
		id := r.Param("id")
		return g.RPC.Templates(ctx, &common.TemplateCall{Context: c, Action: name, Id: &id})
	case "CreateExport":
		input, e := bindInput[common.CreateExportInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Exports(ctx, &common.ExportCall{Context: c, Action: name, Create: input})
	case "GetExport", "DownloadExport", "PreviewExport":
		id := r.Param("id")
		return g.RPC.Exports(ctx, &common.ExportCall{Context: c, Action: name, Id: &id})
	case "AdminUser":
		input, e := bindInput[common.AdminUserInput](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name, User: input})
	case "AdminOverview":
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name})
	case "AdminUsers", "AdminJobs", "AdminAudit":
		input, e := bindInput[common.ListQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name, Query: input})
	case "AdminProjects":
		input, e := bindInput[common.AdminProjectListQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name, ProjectQuery: input})
	case "AdminPermanentlyDeleteProject", "AdminGetProjectDeletion", "AdminRetryProjectDeletion":
		id := r.Param("id")
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name, Id: &id})
	case "AdminListProjectDeletions":
		input, e := bindInput[common.ProjectDeletionListQuery](r)
		if e != nil {
			return badInput(c, e)
		}
		return g.RPC.Admin(ctx, &common.AdminCall{Context: c, Action: name, DeletionQuery: input})
	}
	return notReadyReply(c), nil
}
