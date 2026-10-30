include "../common/base.thrift"
include "../common/requests.thrift"
namespace go assets
service AssetsHTTP {
 base.AssetReply UploadImage(1: requests.UploadImageInput request) (api.post="/api/v1/assets/images");
 base.AssetReply GetAsset(1: requests.IDRequest request) (api.get="/api/v1/assets/:id");
 base.EmptyReply ReadAsset(1: requests.AssetReadQuery request) (api.get="/api/v1/assets/:id/versions/:version");
}
