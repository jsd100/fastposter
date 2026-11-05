namespace go common
struct IDRequest { 1: required string id (api.path="id") }
struct ProjectListQuery { 1: optional i32 page (api.query="page"), 2: optional i32 pageSize (api.query="pageSize"), 3: optional bool trash (api.query="trash"), 4: optional string keyword (api.query="keyword") }
struct CreateProjectInput { 1: required string title (api.body="title"), 2: required string document (api.body="document") }
struct SaveProjectInput { 1: required string id (api.path="id"), 2: required string title (api.body="title"), 3: required string document (api.body="document"), 4: required string expectedRevision (api.body="expectedRevision") }
struct UploadImageInput { 1: optional string filename (api.form="filename") }
struct AssetReadQuery { 1: required string id (api.path="id"), 2: required string version (api.path="version"), 3: optional string variant (api.query="variant"), 4: optional string projectId (api.query="projectId") }
struct CatalogQuery { 1: required string kind (api.path="kind"), 2: optional string categoryId (api.query="categoryId"), 3: optional string parentId (api.query="parentId"), 4: optional string keyword (api.query="keyword"), 5: optional i32 page (api.query="page"), 6: optional i32 pageSize (api.query="pageSize") }
struct ApplyTemplateInput { 1: required string id (api.path="id"), 2: required string version (api.body="version") }
struct TemplateImportInput { 1: optional string filename (api.form="filename") }
struct CreateExportInput { 1: required string projectId (api.body="projectId"), 2: required string revision (api.body="revision"), 3: required string idempotencyKey (api.body="idempotencyKey") }
struct ListQuery { 1: optional i32 page (api.query="page"), 2: optional i32 pageSize (api.query="pageSize"), 3: optional string keyword (api.query="keyword"), 4: optional string userId (api.query="userId") }
struct AdminProjectListQuery { 1: optional i32 page (api.query="page"), 2: optional i32 pageSize (api.query="pageSize"), 3: optional string keyword (api.query="keyword"), 4: optional string userId (api.query="userId"), 5: optional string status (api.query="status") }
struct ProjectDeletionListQuery { 1: optional i32 page (api.query="page"), 2: optional i32 pageSize (api.query="pageSize"), 3: optional string keyword (api.query="keyword"), 4: optional string ownerId (api.query="ownerId") }
struct AdminUserInput { 1: required string id (api.path="id"), 2: required string action (api.body="action") }
struct ChangePasswordInput { 1: required string currentPassword (api.body="currentPassword"), 2: required string newPassword (api.body="newPassword"), 3: optional string resetToken (api.body="resetToken"), 4: optional string username (api.body="username") }
struct ResourceInput { 1: required string kind (api.body="kind"), 2: required string title (api.body="title"), 3: optional string id (api.body="id"), 4: optional string categoryId (api.body="categoryId"), 5: optional i32 sortOrder (api.body="sortOrder"), 6: optional bool published (api.body="published"), 7: optional string assetId (api.body="assetId"), 8: optional string document (api.body="document"), 9: optional string body (api.body="body"), 10: optional string parentId (api.body="parentId"), 11: optional string family (api.body="family"), 12: optional i32 weight (api.body="weight"), 13: optional string style (api.body="style"), 14: optional string license (api.body="license") }
struct MoveResourceInput { 1: required string id (api.path="id"), 2: optional string parentId (api.body="parentId") }
struct FontUploadInput { 1: required string family (api.form="family"), 2: required i32 weight (api.form="weight"), 3: required string style (api.form="style"), 4: optional string license (api.form="license") }

struct FontCheckInput { 1: required string document (api.body="document") }
