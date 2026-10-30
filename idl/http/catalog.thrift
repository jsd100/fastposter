include "../common/base.thrift"
include "../common/requests.thrift"
namespace go catalog
service CatalogHTTP {
 base.CatalogReply ListCatalog(1: requests.CatalogQuery request) (api.get="/api/v1/catalog/:kind");
 base.FontsReply ListFonts(1: base.EmptyRequest request) (api.get="/api/v1/fonts");
 base.EmptyReply CheckFonts(1: requests.FontCheckInput request) (api.post="/api/v1/fonts/check");
}
