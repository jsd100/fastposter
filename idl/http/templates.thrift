include "../common/base.thrift"
include "../common/requests.thrift"
namespace go templates
service TemplatesHTTP {
 base.ProjectReply ApplyTemplate(1: requests.ApplyTemplateInput request) (api.post="/api/v1/templates/:id/apply");
 base.ProjectReply ImportTemplate(1: requests.TemplateImportInput request) (api.post="/api/v1/templates/import");
 base.EmptyReply ExportTemplate(1: requests.IDRequest request) (api.get="/api/v1/projects/:id/template");
}
