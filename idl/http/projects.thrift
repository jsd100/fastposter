include "../common/base.thrift"
include "../common/requests.thrift"
namespace go projects
service ProjectsHTTP {
 base.ProjectListReply ListProjects(1: requests.ProjectListQuery request) (api.get="/api/v1/projects");
 base.ProjectReply CreateProject(1: requests.CreateProjectInput request) (api.post="/api/v1/projects");
 base.ProjectReply GetProject(1: requests.IDRequest request) (api.get="/api/v1/projects/:id");
 base.ProjectReply SaveProject(1: requests.SaveProjectInput request) (api.put="/api/v1/projects/:id");
 base.EmptyReply DeleteProject(1: requests.IDRequest request) (api.delete="/api/v1/projects/:id");
 base.ProjectReply CloneProject(1: requests.IDRequest request) (api.post="/api/v1/projects/:id/clone");
 base.ProjectReply RestoreProject(1: requests.IDRequest request) (api.post="/api/v1/projects/:id/restore");
}
