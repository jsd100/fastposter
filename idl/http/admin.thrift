include "../common/base.thrift"
include "../common/requests.thrift"
namespace go admin
service AdminHTTP {
 base.OverviewReply AdminOverview(1: base.EmptyRequest request) (api.get="/api/v1/admin/overview");
 base.UsersReply AdminUsers(1: requests.ListQuery request) (api.get="/api/v1/admin/users");
 base.AdminUserReply AdminUser(1: requests.AdminUserInput request) (api.post="/api/v1/admin/users/:id");
 base.AdminProjectListReply AdminProjects(1: requests.AdminProjectListQuery request) (api.get="/api/v1/admin/projects");
 base.ProjectDeletionReply AdminPermanentlyDeleteProject(1: requests.IDRequest request) (api.delete="/api/v1/admin/projects/:id/permanent");
 base.ProjectDeletionListReply AdminListProjectDeletions(1: requests.ProjectDeletionListQuery request) (api.get="/api/v1/admin/project-deletions");
 base.ProjectDeletionReply AdminGetProjectDeletion(1: requests.IDRequest request) (api.get="/api/v1/admin/project-deletions/:id");
 base.ProjectDeletionReply AdminRetryProjectDeletion(1: requests.IDRequest request) (api.post="/api/v1/admin/project-deletions/:id/retry");
 base.JobsReply AdminJobs(1: requests.ListQuery request) (api.get="/api/v1/admin/jobs");
 base.AuditReply AdminAudit(1: requests.ListQuery request) (api.get="/api/v1/admin/audit");
 base.CatalogReply AdminResources(1: requests.CatalogQuery request) (api.get="/api/v1/admin/resources/:kind");
 base.ResourceReply AdminSaveResource(1: requests.ResourceInput request) (api.post="/api/v1/admin/resources");
 base.ResourceReply AdminGetResource(1: requests.IDRequest request) (api.get="/api/v1/admin/resources/:id/detail");
 base.ResourceReply AdminPublishResource(1: requests.PublishResourceInput request) (api.post="/api/v1/admin/resources/:id/publication");
 base.EmptyReply AdminDeleteResource(1: requests.IDRequest request) (api.delete="/api/v1/admin/resources/:id");
 base.EmptyReply AdminMoveResource(1: requests.MoveResourceInput request) (api.post="/api/v1/admin/resources/:id/move");
 base.AssetReply UploadFont(1: requests.FontUploadInput request) (api.post="/api/v1/admin/fonts/upload");
 base.ResourceReply AdminImportTemplate(1: requests.TemplateImportInput request) (api.post="/api/v1/admin/templates/import");
}
