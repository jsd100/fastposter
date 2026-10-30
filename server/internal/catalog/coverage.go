package catalog

import (
	"context"
	"fastposter/server/internal/auth"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/fontfile"
	"io"
	"time"
)

func (s *Service) CheckFonts(ctx context.Context, p auth.Principal, raw string) error {
	if e := auth.RequireUsable(p); e != nil {
		return e
	}
	d, e := document.Parse([]byte(raw))
	if e != nil {
		return domain.E("INVALID_INPUT", "作品文档无效")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return fontfile.CheckDocument(d, func(ref document.FontRef) ([]byte, error) {
		if e := ctx.Err(); e != nil {
			return nil, e
		}
		key, e := s.Assets.AuthorizeRead(ctx, p, ref.AssetID, ref.Version)
		if e != nil {
			return nil, e
		}
		r, e := s.Store.Open(ctx, key)
		if e != nil {
			return nil, domain.E("MISSING_FONT", "字体文件缺失")
		}
		defer r.Close()
		data, e := io.ReadAll(io.LimitReader(r, fontfile.MaxDecodedBytes+1))
		if e != nil {
			return nil, e
		}
		if len(data) > fontfile.MaxDecodedBytes {
			return nil, domain.E("INVALID_FONT", "字体文件异常")
		}
		return data, nil
	})
}
