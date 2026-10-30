include "../common/base.thrift"
include "../common/requests.thrift"
namespace go exports
service ExportsHTTP {
 base.JobReply CreateExport(1: requests.CreateExportInput request) (api.post="/api/v1/exports");
 base.JobReply GetExport(1: requests.IDRequest request) (api.get="/api/v1/exports/:id");
 base.EmptyReply DownloadExport(1: requests.IDRequest request) (api.get="/api/v1/exports/:id/download");
 base.EmptyReply PreviewExport(1: requests.IDRequest request) (api.get="/api/v1/exports/:id/preview");
}
