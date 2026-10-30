include "../common/calls.thrift"
namespace go core
struct PingRequest { 1: required string requestId }
struct PingResponse { 1: required string requestId, 2: required string message }
service CoreService {
 PingResponse Ping(1: PingRequest request)
 calls.RPCReply Auth(1: calls.AuthCall request)
 calls.RPCReply Projects(1: calls.ProjectCall request)
 calls.RPCReply Assets(1: calls.AssetCall request)
 calls.RPCReply Catalog(1: calls.CatalogCall request)
 calls.RPCReply Templates(1: calls.TemplateCall request)
 calls.RPCReply Exports(1: calls.ExportCall request)
 calls.RPCReply Admin(1: calls.AdminCall request)
}
