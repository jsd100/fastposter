// Generated from Thrift. DO NOT EDIT.
export type Route<Q = unknown, R = unknown> = {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pathFields: string[];
  queryFields: string[];
  bodyFields: string[];
  _request?: Q;
  _response?: R;
};
export interface APIError {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string>;
}
export interface EmptyRequest {}
export interface Credentials {
  username: string;
  password: string;
}
export interface UserDTO {
  id: string;
  username: string;
  role: string;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}
export interface ProjectDTO {
  id: string;
  title: string;
  document: string;
  revision: string;
  width: number;
  height: number;
  updatedAt: string;
  deletedAt?: string;
  previewUrl?: string;
}
export interface AssetDTO {
  id: string;
  version: string;
  kind: string;
  name: string;
  width: number;
  height: number;
  size: string;
  sha256: string;
  previewUrl?: string;
  url?: string;
}
export interface FontDTO {
  assetId: string;
  version: string;
  family: string;
  weight: number;
  style: string;
  url: string;
}
export interface ResourceDTO {
  id: string;
  kind: string;
  title: string;
  categoryId?: string;
  sortOrder: number;
  published: boolean;
  asset?: AssetDTO;
  document?: string;
  body?: string;
  parentId?: string;
  family?: string;
  weight?: number;
  style?: string;
  license?: string;
  version: string;
}
export interface JobDTO {
  id: string;
  projectId: string;
  revision: string;
  status: string;
  errorMessage?: string;
  downloadUrl?: string;
  previewUrl?: string;
  createdAt: string;
}
export interface OverviewDTO {
  users: number;
  projects: number;
  storageBytes: string;
  successfulExports: number;
  failedExports: number;
}
export interface AuditDTO {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
}
export interface AuthReply {
  requestId: string;
  user: UserDTO;
}
export interface EmptyReply {
  requestId: string;
}
export interface ProjectReply {
  requestId: string;
  project: ProjectDTO;
}
export interface ProjectListReply {
  requestId: string;
  projects: ProjectDTO[];
  total: number;
}
export interface AssetReply {
  requestId: string;
  asset: AssetDTO;
}
export interface CatalogReply {
  requestId: string;
  resources: ResourceDTO[];
  total: number;
}
export interface FontsReply {
  requestId: string;
  fonts: FontDTO[];
}
export interface ResourceReply {
  requestId: string;
  resource: ResourceDTO;
}
export interface JobReply {
  requestId: string;
  job: JobDTO;
}
export interface UsersReply {
  requestId: string;
  users: UserDTO[];
  total: number;
}
export interface OverviewReply {
  requestId: string;
  overview: OverviewDTO;
}
export interface JobsReply {
  requestId: string;
  jobs: JobDTO[];
  total: number;
}
export interface AuditReply {
  requestId: string;
  audit: AuditDTO[];
  total: number;
}
export interface AdminUserReply {
  requestId: string;
  user: UserDTO;
  resetToken?: string;
}
export interface PublicPayload {
  requestId: string;
  user?: UserDTO;
  project?: ProjectDTO;
  projects?: ProjectDTO[];
  asset?: AssetDTO;
  resources?: ResourceDTO[];
  fonts?: FontDTO[];
  resource?: ResourceDTO;
  job?: JobDTO;
  users?: UserDTO[];
  overview?: OverviewDTO;
  jobs?: JobDTO[];
  audit?: AuditDTO[];
  total?: number;
  resetToken?: string;
}
export interface IDRequest {
  id: string;
}
export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  trash?: boolean;
  keyword?: string;
}
export interface CreateProjectInput {
  title: string;
  document: string;
}
export interface SaveProjectInput {
  id: string;
  title: string;
  document: string;
  expectedRevision: string;
}
export interface UploadImageInput {
  filename?: string;
}
export interface AssetReadQuery {
  id: string;
  version: string;
  variant?: string;
  projectId?: string;
}
export interface CatalogQuery {
  kind: string;
  categoryId?: string;
  parentId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}
export interface ApplyTemplateInput {
  id: string;
  version: string;
}
export interface TemplateImportInput {
  filename?: string;
}
export interface CreateExportInput {
  projectId: string;
  revision: string;
  idempotencyKey: string;
}
export interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: string;
}
export interface AdminUserInput {
  id: string;
  action: string;
}
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  resetToken?: string;
  username?: string;
}
export interface ResourceInput {
  kind: string;
  title: string;
  id?: string;
  categoryId?: string;
  sortOrder?: number;
  published?: boolean;
  assetId?: string;
  document?: string;
  body?: string;
  parentId?: string;
  family?: string;
  weight?: number;
  style?: string;
  license?: string;
}
export interface FontUploadInput {
  family: string;
  weight: number;
  style: string;
  license?: string;
}
export const routes = {
  AdminOverview: {
    name: "AdminOverview",
    method: "GET",
    path: "/api/v1/admin/overview",
    pathFields: [],
    queryFields: [],
    bodyFields: [],
  } as Route<EmptyRequest, OverviewReply>,
  AdminUsers: {
    name: "AdminUsers",
    method: "GET",
    path: "/api/v1/admin/users",
    pathFields: [],
    queryFields: ["page", "pageSize", "keyword", "userId"],
    bodyFields: [],
  } as Route<ListQuery, UsersReply>,
  AdminUser: {
    name: "AdminUser",
    method: "POST",
    path: "/api/v1/admin/users/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: ["action"],
  } as Route<AdminUserInput, AdminUserReply>,
  AdminProjects: {
    name: "AdminProjects",
    method: "GET",
    path: "/api/v1/admin/projects",
    pathFields: [],
    queryFields: ["page", "pageSize", "keyword", "userId"],
    bodyFields: [],
  } as Route<ListQuery, ProjectListReply>,
  AdminJobs: {
    name: "AdminJobs",
    method: "GET",
    path: "/api/v1/admin/jobs",
    pathFields: [],
    queryFields: ["page", "pageSize", "keyword", "userId"],
    bodyFields: [],
  } as Route<ListQuery, JobsReply>,
  AdminAudit: {
    name: "AdminAudit",
    method: "GET",
    path: "/api/v1/admin/audit",
    pathFields: [],
    queryFields: ["page", "pageSize", "keyword", "userId"],
    bodyFields: [],
  } as Route<ListQuery, AuditReply>,
  AdminResources: {
    name: "AdminResources",
    method: "GET",
    path: "/api/v1/admin/resources/:kind",
    pathFields: ["kind"],
    queryFields: ["categoryId", "parentId", "keyword", "page", "pageSize"],
    bodyFields: [],
  } as Route<CatalogQuery, CatalogReply>,
  AdminSaveResource: {
    name: "AdminSaveResource",
    method: "POST",
    path: "/api/v1/admin/resources",
    pathFields: [],
    queryFields: [],
    bodyFields: [
      "kind",
      "title",
      "id",
      "categoryId",
      "sortOrder",
      "published",
      "assetId",
      "document",
      "body",
      "parentId",
      "family",
      "weight",
      "style",
      "license",
    ],
  } as Route<ResourceInput, ResourceReply>,
  AdminDeleteResource: {
    name: "AdminDeleteResource",
    method: "DELETE",
    path: "/api/v1/admin/resources/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, EmptyReply>,
  UploadFont: {
    name: "UploadFont",
    method: "POST",
    path: "/api/v1/admin/fonts/upload",
    pathFields: [],
    queryFields: [],
    bodyFields: ["family", "weight", "style", "license"],
  } as Route<FontUploadInput, AssetReply>,
  AdminImportTemplate: {
    name: "AdminImportTemplate",
    method: "POST",
    path: "/api/v1/admin/templates/import",
    pathFields: [],
    queryFields: [],
    bodyFields: ["filename"],
  } as Route<TemplateImportInput, ResourceReply>,
  UploadImage: {
    name: "UploadImage",
    method: "POST",
    path: "/api/v1/assets/images",
    pathFields: [],
    queryFields: [],
    bodyFields: ["filename"],
  } as Route<UploadImageInput, AssetReply>,
  GetAsset: {
    name: "GetAsset",
    method: "GET",
    path: "/api/v1/assets/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, AssetReply>,
  ReadAsset: {
    name: "ReadAsset",
    method: "GET",
    path: "/api/v1/assets/:id/versions/:version",
    pathFields: ["id", "version"],
    queryFields: ["variant", "projectId"],
    bodyFields: [],
  } as Route<AssetReadQuery, EmptyReply>,
  Register: {
    name: "Register",
    method: "POST",
    path: "/api/v1/auth/register",
    pathFields: [],
    queryFields: [],
    bodyFields: ["username", "password"],
  } as Route<Credentials, AuthReply>,
  Login: {
    name: "Login",
    method: "POST",
    path: "/api/v1/auth/login",
    pathFields: [],
    queryFields: [],
    bodyFields: ["username", "password"],
  } as Route<Credentials, AuthReply>,
  Logout: {
    name: "Logout",
    method: "POST",
    path: "/api/v1/auth/logout",
    pathFields: [],
    queryFields: [],
    bodyFields: [],
  } as Route<EmptyRequest, EmptyReply>,
  Me: {
    name: "Me",
    method: "GET",
    path: "/api/v1/auth/me",
    pathFields: [],
    queryFields: [],
    bodyFields: [],
  } as Route<EmptyRequest, AuthReply>,
  ChangePassword: {
    name: "ChangePassword",
    method: "POST",
    path: "/api/v1/auth/password",
    pathFields: [],
    queryFields: [],
    bodyFields: ["currentPassword", "newPassword", "resetToken", "username"],
  } as Route<ChangePasswordInput, EmptyReply>,
  ListCatalog: {
    name: "ListCatalog",
    method: "GET",
    path: "/api/v1/catalog/:kind",
    pathFields: ["kind"],
    queryFields: ["categoryId", "parentId", "keyword", "page", "pageSize"],
    bodyFields: [],
  } as Route<CatalogQuery, CatalogReply>,
  ListFonts: {
    name: "ListFonts",
    method: "GET",
    path: "/api/v1/fonts",
    pathFields: [],
    queryFields: [],
    bodyFields: [],
  } as Route<EmptyRequest, FontsReply>,
  CreateExport: {
    name: "CreateExport",
    method: "POST",
    path: "/api/v1/exports",
    pathFields: [],
    queryFields: [],
    bodyFields: ["projectId", "revision", "idempotencyKey"],
  } as Route<CreateExportInput, JobReply>,
  GetExport: {
    name: "GetExport",
    method: "GET",
    path: "/api/v1/exports/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, JobReply>,
  DownloadExport: {
    name: "DownloadExport",
    method: "GET",
    path: "/api/v1/exports/:id/download",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, EmptyReply>,
  PreviewExport: {
    name: "PreviewExport",
    method: "GET",
    path: "/api/v1/exports/:id/preview",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, EmptyReply>,
  ListProjects: {
    name: "ListProjects",
    method: "GET",
    path: "/api/v1/projects",
    pathFields: [],
    queryFields: ["page", "pageSize", "trash", "keyword"],
    bodyFields: [],
  } as Route<ProjectListQuery, ProjectListReply>,
  CreateProject: {
    name: "CreateProject",
    method: "POST",
    path: "/api/v1/projects",
    pathFields: [],
    queryFields: [],
    bodyFields: ["title", "document"],
  } as Route<CreateProjectInput, ProjectReply>,
  GetProject: {
    name: "GetProject",
    method: "GET",
    path: "/api/v1/projects/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, ProjectReply>,
  SaveProject: {
    name: "SaveProject",
    method: "PUT",
    path: "/api/v1/projects/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: ["title", "document", "expectedRevision"],
  } as Route<SaveProjectInput, ProjectReply>,
  DeleteProject: {
    name: "DeleteProject",
    method: "DELETE",
    path: "/api/v1/projects/:id",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, EmptyReply>,
  CloneProject: {
    name: "CloneProject",
    method: "POST",
    path: "/api/v1/projects/:id/clone",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, ProjectReply>,
  RestoreProject: {
    name: "RestoreProject",
    method: "POST",
    path: "/api/v1/projects/:id/restore",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, ProjectReply>,
  ApplyTemplate: {
    name: "ApplyTemplate",
    method: "POST",
    path: "/api/v1/templates/:id/apply",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: ["version"],
  } as Route<ApplyTemplateInput, ProjectReply>,
  ImportTemplate: {
    name: "ImportTemplate",
    method: "POST",
    path: "/api/v1/templates/import",
    pathFields: [],
    queryFields: [],
    bodyFields: ["filename"],
  } as Route<TemplateImportInput, ProjectReply>,
  ExportTemplate: {
    name: "ExportTemplate",
    method: "GET",
    path: "/api/v1/projects/:id/template",
    pathFields: ["id"],
    queryFields: [],
    bodyFields: [],
  } as Route<IDRequest, EmptyReply>,
};
