include "../common/base.thrift"
include "../common/requests.thrift"
namespace go auth
service AuthHTTP {
 base.AuthReply Register(1: base.Credentials request) (api.post="/api/v1/auth/register");
 base.AuthReply Login(1: base.Credentials request) (api.post="/api/v1/auth/login");
 base.EmptyReply Logout(1: base.EmptyRequest request) (api.post="/api/v1/auth/logout");
 base.AuthReply Me(1: base.EmptyRequest request) (api.get="/api/v1/auth/me");
 base.EmptyReply ChangePassword(1: requests.ChangePasswordInput request) (api.post="/api/v1/auth/password");
}
