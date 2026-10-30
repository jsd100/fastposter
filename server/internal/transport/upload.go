package transport

import (
	"bytes"
	"context"
	"fastposter/server/gen/kitex/common"
	"fastposter/server/internal/assets"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/storage"
	"fmt"
	"github.com/cloudwego/hertz/pkg/app"
	"io"
	"mime"
	"mime/multipart"
	"strconv"
	"time"
)

func (g *Gateway) BindUploads() { g.Upload = g.uploadMultipart }
func (g *Gateway) uploadMultipart(ctx context.Context, r *app.RequestContext, action string, c *common.CallContext) (*common.RPCReply, error) {
	if g.Store == nil {
		return notReadyReply(c), nil
	}
	begun, e := g.RPC.Assets(ctx, &common.AssetCall{Context: c, Action: "Begin" + action})
	if e != nil || begun == nil || begun.Error != nil {
		return begun, e
	}
	key := begun.GetFileKey()
	if key == "" {
		return response(c, nil, domain.E("INTERNAL", "上传未能初始化")), nil
	}
	complete := false
	defer func() {
		if !complete {
			cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			defer cancel()
			g.RPC.Assets(cleanup, &common.AssetCall{Context: c, Action: "AbortUpload", StagedKey: &key})
		}
	}()
	invalid := func(message string) (*common.RPCReply, error) {
		return response(c, nil, domain.E("INVALID_INPUT", message)), nil
	}
	media, params, e := mime.ParseMediaType(string(r.Request.Header.ContentType()))
	if e != nil || media != "multipart/form-data" || params["boundary"] == "" {
		return invalid("请选择需要上传的文件")
	}
	var body io.Reader
	if r.Request.IsBodyStream() {
		body = r.Request.BodyStream()
	} else {
		body = bytes.NewReader(r.Request.Body())
	}
	maxBytes := assets.MaxImageBytes
	if action == "ImportTemplate" || action == "AdminImportTemplate" {
		maxBytes = 80 << 20
	}
	reader := multipart.NewReader(io.LimitReader(body, maxBytes+(1<<20)), params["boundary"])
	fields := map[string]string{}
	filename := ""
	files := 0
	for parts := 0; ; parts++ {
		if parts > 8 {
			return invalid("上传表单项目过多")
		}
		part, e := reader.NextPart()
		if e == io.EOF {
			break
		}
		if e != nil {
			return invalid("上传数据不完整，请重新选择文件")
		}
		if part.FileName() != "" {
			files++
			if files != 1 || part.FormName() != "file" {
				part.Close()
				return invalid("每次只能上传一个文件")
			}
			filename = part.FileName()
			info, e := g.Store.Put(ctx, storage.Key(key), io.LimitReader(part, maxBytes+1))
			if e != nil {
				part.Close()
				return response(c, nil, domain.E("STORAGE_FULL", "文件保存失败，请稍后重试")), nil
			}
			if info.Size > maxBytes {
				part.Close()
				return response(c, nil, domain.E("PAYLOAD_TOO_LARGE", fmt.Sprintf("上传文件不能超过 %d MiB", maxBytes>>20))), nil
			}
			part.Close()
		} else {
			if _, exists := fields[part.FormName()]; exists {
				part.Close()
				return invalid("上传字段重复")
			}
			raw, e := io.ReadAll(io.LimitReader(part, 4097))
			part.Close()
			if e != nil || len(raw) > 4096 {
				return invalid("上传字段过长")
			}
			fields[part.FormName()] = string(raw)
		}
	}
	if files != 1 {
		return invalid("请选择一个文件")
	}
	switch action {
	case "UploadImage":
		reply, e := g.RPC.Assets(ctx, &common.AssetCall{Context: c, Action: action, StagedKey: &key, Filename: &filename})
		complete = e == nil && reply != nil && reply.Error == nil
		return reply, e
	case "UploadFont":
		weight, e := strconv.ParseInt(fields["weight"], 10, 32)
		if e != nil {
			return invalid("请选择字重")
		}
		input := &common.FontUploadInput{Family: fields["family"], Weight: int32(weight), Style: fields["style"]}
		if fields["license"] != "" {
			license := fields["license"]
			input.License = &license
		}
		reply, e := g.RPC.Assets(ctx, &common.AssetCall{Context: c, Action: action, StagedKey: &key, Filename: &filename, Font: input})
		complete = e == nil && reply != nil && reply.Error == nil
		return reply, e
	case "ImportTemplate", "AdminImportTemplate":
		reply, e := g.RPC.Templates(ctx, &common.TemplateCall{Context: c, Action: action, StagedKey: &key})
		complete = e == nil && reply != nil && reply.Error == nil
		return reply, e
	}
	return invalid("不支持的上传类型")
}
