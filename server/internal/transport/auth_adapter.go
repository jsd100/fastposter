package transport

import (
	"context"
	"errors"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/domain"
	"time"
)

func publicUser(u auth.User) *common.UserDTO {
	return &common.UserDTO{Id: u.ID, Username: u.Username, Role: u.Role, Disabled: u.Disabled, MustChangePassword: u.MustChangePassword, CreatedAt: u.CreatedAt.UTC().Format(time.RFC3339)}
}
func response(c *common.CallContext, data *common.PublicPayload, err error) *common.RPCReply {
	if c == nil {
		c = &common.CallContext{RequestId: domain.ID()}
	}
	if data == nil {
		data = &common.PublicPayload{}
	}
	data.RequestId = c.RequestId
	reply := &common.RPCReply{Data: data}
	if err != nil {
		code, message := "INTERNAL", "服务暂时无法完成请求，请稍后重试"
		var known *domain.Error
		if errors.As(err, &known) {
			code, message = known.Code, known.Message
		}
		reply.Error = &common.APIError{Code: code, Message: message, RequestId: c.RequestId}
	}
	return reply
}
func AuthAdapter(service *auth.Service) func(context.Context, *common.AuthCall) (*common.RPCReply, error) {
	return func(ctx context.Context, call *common.AuthCall) (*common.RPCReply, error) {
		c := call.Context
		if c == nil {
			c = &common.CallContext{RequestId: domain.ID()}
		}
		ctx = auth.WithClientIP(ctx, c.GetPeerIp())
		switch call.Action {
		case "Register":
			if call.Credentials == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "请填写用户名和密码")), nil
			}
			u, e := service.Register(ctx, call.Credentials.Username, call.Credentials.Password)
			if e != nil {
				return response(c, nil, e), nil
			}
			return response(c, &common.PublicPayload{User: publicUser(u)}, nil), nil
		case "Login":
			if call.Credentials == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "请填写用户名和密码")), nil
			}
			session, e := service.Login(ctx, call.Credentials.Username, call.Credentials.Password)
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.User = publicUser(session.User)
				reply.SessionToken = &session.Token
			}
			return reply, nil
		case "Me":
			p, e := service.ResolveSession(ctx, c.SessionToken)
			if e != nil {
				return response(c, nil, e), nil
			}
			u, e := service.GetUser(ctx, p.UserID)
			reply := response(c, nil, e)
			if e == nil {
				reply.Data.User = publicUser(u)
			}
			return reply, nil
		case "Logout":
			p, e := service.ResolveSession(ctx, c.SessionToken)
			if e == nil {
				e = service.Revoke(ctx, p.SessionID)
			}
			var authErr *domain.Error
			if errors.As(e, &authErr) && authErr.Code == "AUTH_REQUIRED" {
				e = nil
			}
			reply := response(c, nil, e)
			empty := ""
			reply.SessionToken = &empty
			return reply, nil
		case "ChangePassword":
			input := call.PasswordInput
			if input == nil {
				return response(c, nil, domain.E("INVALID_INPUT", "请填写密码信息")), nil
			}
			var p auth.Principal
			var e error
			if input.GetResetToken() == "" {
				p, e = service.ResolveSession(ctx, c.SessionToken)
				if e != nil {
					return response(c, nil, e), nil
				}
			}
			e = service.ChangePassword(ctx, p, input.CurrentPassword, input.NewPassword_, input.GetResetToken(), input.GetUsername())
			reply := response(c, nil, e)
			if e == nil {
				empty := ""
				reply.SessionToken = &empty
			}
			return reply, nil
		}
		return response(c, nil, domain.E("INVALID_INPUT", "未知账号操作")), nil
	}
}
