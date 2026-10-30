namespace go common
struct APIError { 1: required string code, 2: required string message, 3: required string requestId, 4: optional map<string,string> fieldErrors }
struct EmptyRequest {}
struct Credentials { 1: required string username (api.body="username"), 2: required string password (api.body="password") }
struct UserDTO { 1: required string id, 2: required string username, 3: required string role, 4: required bool disabled, 5: required bool mustChangePassword, 6: required string createdAt }
struct ProjectDTO { 1: required string id, 2: required string title, 3: required string document, 4: required string revision, 5: required i32 width, 6: required i32 height, 7: required string updatedAt, 8: optional string deletedAt, 9: optional string previewUrl }
struct ProjectMetadataDTO { 1: required string id, 2: required string ownerId, 3: required string title, 4: required string revision, 5: required i32 width, 6: required i32 height, 7: required string updatedAt, 8: optional string deletedAt }
struct AdminProjectListReply { 1: required string requestId, 2: required list<ProjectMetadataDTO> projects, 3: required i32 total }
struct AssetDTO { 1: required string id, 2: required string version, 3: required string kind, 4: required string name, 5: required i32 width, 6: required i32 height, 7: required string size, 8: required string sha256, 9: optional string previewUrl, 10: optional string url }
struct FontDTO { 1: required string assetId, 2: required string version, 3: required string family, 4: required i32 weight, 5: required string style, 6: required string url }
struct ResourceDTO { 1: required string id, 2: required string kind, 3: required string title, 4: optional string categoryId, 5: required i32 sortOrder, 6: required bool published, 7: optional AssetDTO asset, 8: optional string document, 9: optional string body, 10: optional string parentId, 11: optional string family, 12: optional i32 weight, 13: optional string style, 14: optional string license, 15: required string version }
struct JobDTO { 1: required string id, 2: required string projectId, 3: required string revision, 4: required string status, 5: optional string errorMessage, 6: optional string downloadUrl, 7: optional string previewUrl, 8: required string createdAt }
struct OverviewDTO { 1: required i32 users, 2: required i32 projects, 3: required string storageBytes, 4: required i32 successfulExports, 5: required i32 failedExports }
struct AuditDTO { 1: required string id, 2: required string actorId, 3: required string action, 4: required string targetId, 5: required string createdAt }
struct AuthReply { 1: required string requestId, 2: required UserDTO user }
struct EmptyReply { 1: required string requestId }
struct ProjectReply { 1: required string requestId, 2: required ProjectDTO project }
struct ProjectListReply { 1: required string requestId, 2: required list<ProjectDTO> projects, 3: required i32 total }
struct AssetReply { 1: required string requestId, 2: required AssetDTO asset }
struct CatalogReply { 1: required string requestId, 2: required list<ResourceDTO> resources, 3: required i32 total }
struct FontsReply { 1: required string requestId, 2: required list<FontDTO> fonts }
struct ResourceReply { 1: required string requestId, 2: required ResourceDTO resource }
struct JobReply { 1: required string requestId, 2: required JobDTO job }
struct UsersReply { 1: required string requestId, 2: required list<UserDTO> users, 3: required i32 total }
struct OverviewReply { 1: required string requestId, 2: required OverviewDTO overview }
struct JobsReply { 1: required string requestId, 2: required list<JobDTO> jobs, 3: required i32 total }
struct AuditReply { 1: required string requestId, 2: required list<AuditDTO> audit, 3: required i32 total }
struct AdminUserReply { 1: required string requestId, 2: required UserDTO user, 3: optional string resetToken }
struct PublicPayload { 1: required string requestId, 2: optional UserDTO user, 3: optional ProjectDTO project, 4: optional list<ProjectDTO> projects, 5: optional AssetDTO asset, 6: optional list<ResourceDTO> resources, 7: optional list<FontDTO> fonts, 8: optional ResourceDTO resource, 9: optional JobDTO job, 10: optional list<UserDTO> users, 11: optional OverviewDTO overview, 12: optional list<JobDTO> jobs, 13: optional list<AuditDTO> audit, 14: optional i32 total, 15: optional string resetToken, 16: optional list<ProjectMetadataDTO> metadataProjects }
