package transport

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/gen/kitex/core/coreservice"
	"fastposter/server/internal/storage"
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/protocol"
	"mime"
	"net"
	"strings"
)

type Gateway struct {
	RPC            coreservice.Client
	Store          storage.FileStore
	Writers        *storage.WriterGate
	AllowedOrigins []string
	SecureCookies  bool
	Paused         func() bool
	Upload         func(context.Context, *app.RequestContext, string, *common.CallContext) (*common.RPCReply, error)
}

func (g *Gateway) Register(h *server.Hertz) {
	for _, route := range GeneratedRoutes {
		route := route
		h.Handle(route.Method, route.Path, func(ctx context.Context, r *app.RequestContext) {
			var b [12]byte
			rand.Read(b[:])
			id := hex.EncodeToString(b[:])
			r.Header("X-Request-Id", id)
			if route.Method != "GET" {
				lease, leaseErr := g.Writers.TryAcquire()
				if leaseErr != nil {
					code := "STORAGE_UNAVAILABLE"
					if errors.Is(leaseErr, storage.ErrWritersPaused) {
						code = "MAINTENANCE"
					}
					r.JSON(503, &common.APIError{Code: code, Message: "系统维护中，暂时无法写入", RequestId: id})
					return
				}
				defer lease.Release()
				if g.Paused != nil && g.Paused() {
					r.JSON(503, &common.APIError{Code: "MAINTENANCE", Message: "系统维护中，暂时无法写入", RequestId: id})
					return
				}
			}
			peer := "local"
			if addr := r.RemoteAddr(); addr != nil {
				peer, _, _ = net.SplitHostPort(addr.String())
			}
			cc := &common.CallContext{RequestId: id, SessionToken: string(r.Cookie("fp_session")), PeerIp: &peer}
			if route.Method != "GET" && !g.originAllowed(r) {
				r.JSON(403, &common.APIError{Code: "FORBIDDEN", Message: "请求来源不被允许", RequestId: id})
				return
			}
			if route.Name == "UploadImage" || route.Name == "UploadFont" || route.Name == "ImportTemplate" || route.Name == "AdminImportTemplate" {
				if g.Upload == nil {
					g.write(ctx, r, route.Name, cc, notReadyReply(cc), nil)
					return
				}
				reply, e := g.Upload(ctx, r, route.Name, cc)
				g.write(ctx, r, route.Name, cc, reply, e)
				return
			}
			if len(r.Request.Body()) > 6<<20 {
				r.JSON(413, &common.APIError{Code: "PAYLOAD_TOO_LARGE", Message: "请求内容过大", RequestId: id})
				return
			}
			reply, e := g.dispatch(ctx, r, route.Name, cc)
			g.write(ctx, r, route.Name, cc, reply, e)
		})
	}
}
func (g *Gateway) originAllowed(r *app.RequestContext) bool {
	origin := string(r.Request.Header.Peek("Origin"))
	if origin == "" {
		return string(r.Request.Header.Peek("Sec-Fetch-Site")) != "cross-site"
	}
	for _, allowed := range g.AllowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}
func notReadyReply(c *common.CallContext) *common.RPCReply { reply, _ := notReady(c); return reply }
func errorStatus(code string) int {
	switch code {
	case "AUTH_REQUIRED", "INVALID_CREDENTIALS":
		return 401
	case "FORBIDDEN", "PASSWORD_CHANGE_REQUIRED":
		return 403
	case "NOT_FOUND":
		return 404
	case "REVISION_CONFLICT", "USERNAME_TAKEN", "CONFLICT":
		return 409
	case "PAYLOAD_TOO_LARGE":
		return 413
	case "INVALID_INPUT", "RESET_INVALID", "MISSING_FONT", "OVERFLOW", "INVALID_IMAGE", "UNSUPPORTED_IMAGE", "IMAGE_LIMIT", "IMAGE_PROCESSING_FAILED", "INVALID_FONT", "MISSING_GLYPH", "INVALID_TEMPLATE":
		return 422
	case "RATE_LIMITED":
		return 429
	case "NOT_READY", "STORAGE_FULL":
		return 503
	default:
		return 500
	}
}
func (g *Gateway) write(ctx context.Context, r *app.RequestContext, route string, c *common.CallContext, reply *common.RPCReply, err error) {
	if err != nil || reply == nil {
		r.JSON(503, &common.APIError{Code: "CORE_UNAVAILABLE", Message: "业务服务暂时不可用", RequestId: c.RequestId})
		return
	}
	if reply.Error != nil {
		r.JSON(errorStatus(reply.Error.Code), reply.Error)
		return
	}
	if reply.SessionToken != nil {
		age := 30 * 24 * 60 * 60
		if *reply.SessionToken == "" {
			age = -1
		}
		r.SetCookie("fp_session", *reply.SessionToken, age, "/", "", protocol.CookieSameSiteLaxMode, g.SecureCookies, true)
	}
	if reply.GetFileKey() != "" {
		if g.Store == nil {
			r.JSON(503, &common.APIError{Code: "NOT_READY", Message: "文件服务未初始化", RequestId: c.RequestId})
			return
		}
		allowed := route == "ReadAsset" || route == "DownloadExport" || route == "PreviewExport" || route == "ExportTemplate" || route == "AdminExportTemplate"
		if !allowed {
			r.JSON(500, &common.APIError{Code: "INTERNAL", Message: "文件响应类型不匹配", RequestId: c.RequestId})
			return
		}
		file, e := g.Store.Open(ctx, storage.Key(reply.GetFileKey()))
		if e != nil {
			r.JSON(404, &common.APIError{Code: "NOT_FOUND", Message: "文件不存在或暂时不可用", RequestId: c.RequestId})
			return
		}
		contentType := reply.GetContentType()
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		r.Response.Header.Set("Content-Type", contentType)
		r.Response.Header.Set("X-Content-Type-Options", "nosniff")
		r.Response.Header.Set("Cache-Control", "private, no-store")
		disposition := "attachment"
		if route == "ReadAsset" || route == "PreviewExport" {
			disposition = "inline"
		}
		name := strings.ReplaceAll(reply.GetFilename(), "\x00", "")
		if name == "" {
			name = "poster.png"
		}
		r.Response.Header.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
		r.Response.SetBodyStream(file, -1)
		return
	}
	switch route {
	case "ListCatalog", "AdminResources":
		items := reply.Data.Resources
		if items == nil {
			items = []*common.ResourceDTO{}
		}
		r.JSON(200, &common.CatalogReply{RequestId: c.RequestId, Resources: items, Total: reply.Data.GetTotal()})
		return
	case "ListProjects":
		items := reply.Data.Projects
		if items == nil {
			items = []*common.ProjectDTO{}
		}
		r.JSON(200, &common.ProjectListReply{RequestId: c.RequestId, Projects: items, Total: reply.Data.GetTotal()})
		return
	case "ListFonts":
		items := reply.Data.Fonts
		if items == nil {
			items = []*common.FontDTO{}
		}
		r.JSON(200, &common.FontsReply{RequestId: c.RequestId, Fonts: items})
		return
	case "AdminUsers":
		items := reply.Data.Users
		if items == nil {
			items = []*common.UserDTO{}
		}
		r.JSON(200, &common.UsersReply{RequestId: c.RequestId, Users: items, Total: reply.Data.GetTotal()})
		return
	case "AdminJobs":
		items := reply.Data.Jobs
		if items == nil {
			items = []*common.JobDTO{}
		}
		r.JSON(200, &common.JobsReply{RequestId: c.RequestId, Jobs: items, Total: reply.Data.GetTotal()})
		return
	case "AdminAudit":
		items := reply.Data.Audit
		if items == nil {
			items = []*common.AuditDTO{}
		}
		r.JSON(200, &common.AuditReply{RequestId: c.RequestId, Audit: items, Total: reply.Data.GetTotal()})
		return
	case "ListProjectDeletions", "AdminListProjectDeletions":
		items := reply.Data.Deletions
		if items == nil {
			items = []*common.ProjectDeletionDTO{}
		}
		r.JSON(200, &common.ProjectDeletionListReply{RequestId: c.RequestId, Deletions: items, Total: reply.Data.GetTotal()})
		return
	}
	if route == "PermanentlyDeleteProject" || route == "GetProjectDeletion" || route == "RetryProjectDeletion" || route == "AdminPermanentlyDeleteProject" || route == "AdminGetProjectDeletion" || route == "AdminRetryProjectDeletion" {
		if reply.Data.Deletion == nil {
			r.JSON(500, &common.APIError{Code: "INTERNAL", Message: "删除任务响应缺失", RequestId: c.RequestId})
			return
		}
		r.JSON(200, &common.ProjectDeletionReply{RequestId: c.RequestId, Deletion: reply.Data.Deletion})
		return
	}
	if route == "AdminProjects" {
		if reply.Data.MetadataProjects == nil {
			reply.Data.MetadataProjects = []*common.ProjectMetadataDTO{}
		}
		r.JSON(200, &common.AdminProjectListReply{RequestId: c.RequestId, Projects: reply.Data.MetadataProjects, Total: reply.Data.GetTotal()})
		return
	}
	r.JSON(200, reply.Data)
}
