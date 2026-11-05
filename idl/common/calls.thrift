include "base.thrift"
include "requests.thrift"
namespace go common
struct CallContext { 1: required string requestId, 2: required string sessionToken, 3: optional string peerIp }
struct RPCReply { 1: required base.PublicPayload data, 2: optional base.APIError error, 3: optional string sessionToken, 4: optional string fileKey, 5: optional string filename, 6: optional string contentType }
struct AuthCall { 1: required CallContext context, 2: required string action, 3: optional base.Credentials credentials, 4: optional requests.ChangePasswordInput passwordInput }
struct ProjectCall { 1: required CallContext context, 2: required string action, 3: optional string id, 4: optional requests.ProjectListQuery query, 5: optional requests.CreateProjectInput create, 6: optional requests.SaveProjectInput save, 7: optional requests.ProjectDeletionListQuery deletionQuery }
struct AssetCall { 1: required CallContext context, 2: required string action, 3: optional string id, 4: optional string stagedKey, 5: optional string filename, 6: optional requests.AssetReadQuery read, 7: optional requests.FontUploadInput font }
struct CatalogCall { 1: required CallContext context, 2: required string action, 3: optional requests.CatalogQuery query, 4: optional requests.ResourceInput input, 5: optional string id, 6: optional requests.FontCheckInput fontCheck, 7: optional requests.MoveResourceInput move }
struct TemplateCall { 1: required CallContext context, 2: required string action, 3: optional string id, 4: optional string version, 5: optional string stagedKey }
struct ExportCall { 1: required CallContext context, 2: required string action, 3: optional string id, 4: optional requests.CreateExportInput create }
struct AdminCall { 1: required CallContext context, 2: required string action, 3: optional requests.ListQuery query, 4: optional requests.AdminUserInput user, 5: optional string id, 6: optional requests.AdminProjectListQuery projectQuery, 7: optional requests.ProjectDeletionListQuery deletionQuery }
