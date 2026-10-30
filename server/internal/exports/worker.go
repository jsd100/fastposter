package exports

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fastposter/server/internal/document"
	"fastposter/server/internal/domain"
	"fastposter/server/internal/fontfile"
	"fastposter/server/internal/projects"
	"fastposter/server/internal/storage"
	"fmt"
	xdraw "golang.org/x/image/draw"
	"image"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

type Worker struct {
	Service  *Service
	Renderer *Renderer
	TempRoot string
	ID       string
}

func workerError(e error) error {
	if errors.Is(e, syscall.ENOSPC) {
		return domain.E("STORAGE_FULL", "存储空间不足，导出失败，请联系管理员")
	}
	return e
}
func copyResource(ctx context.Context, store storage.FileStore, key storage.Key, hash, target string) error {
	r, e := store.Open(ctx, key)
	if e != nil {
		return domain.E("MISSING_RESOURCE", "背景或字体文件缺失，请联系管理员")
	}
	defer r.Close()
	f, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return workerError(e)
	}
	h := sha256.New()
	_, e = io.Copy(io.MultiWriter(f, h), r)
	closeError := f.Close()
	if e != nil {
		return workerError(e)
	}
	if closeError != nil {
		return workerError(closeError)
	}
	if hash == "" || hex.EncodeToString(h.Sum(nil)) != hash {
		return domain.E("RESOURCE_CHANGED", "素材文件校验失败，请联系管理员")
	}
	return ctx.Err()
}

type cancelWriter struct {
	ctx    context.Context
	writer io.Writer
}

func (w cancelWriter) Write(b []byte) (int, error) {
	if e := w.ctx.Err(); e != nil {
		return 0, e
	}
	return w.writer.Write(b)
}
func encodePNG(ctx context.Context, path string, img image.Image) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return workerError(e)
	}
	e = png.Encode(cancelWriter{ctx, f}, img)
	closeError := f.Close()
	if e != nil {
		return workerError(e)
	}
	return workerError(closeError)
}
func (w *Worker) putFile(ctx context.Context, prefix, path string) (storage.FileInfo, error) {
	f, e := os.Open(path)
	if e != nil {
		return storage.FileInfo{}, e
	}
	defer f.Close()
	info, e := w.Service.Store.Put(ctx, storage.NewKey(prefix), f)
	return info, workerError(e)
}
func (w *Worker) Render(ctx context.Context, snapshot projects.RenderSnapshot) (storage.Key, storage.Key, int64, error) {
	if e := document.Validate(snapshot.Document); e != nil {
		return "", "", 0, domain.E("INVALID_INPUT", "导出快照无效")
	}
	if w.Service == nil || w.Renderer == nil {
		return "", "", 0, domain.E("NOT_READY", "导出服务尚未初始化")
	}
	if snapshot.RendererVersion != "poster-renderer-v1" {
		return "", "", 0, domain.E("RENDERER_VERSION", "渲染版本已升级，请重新发起导出")
	}
	if e := validateFontFaces(snapshot.Document); e != nil {
		return "", "", 0, domain.E("MISSING_FONT", "缺少所需字重或斜体字体")
	}
	if e := os.MkdirAll(w.TempRoot, 0700); e != nil {
		return "", "", 0, workerError(e)
	}
	dir, e := os.MkdirTemp(w.TempRoot, "export-")
	if e != nil {
		return "", "", 0, workerError(e)
	}
	defer os.RemoveAll(dir)
	backgroundPath := filepath.Join(dir, "background.png")
	if e = copyResource(ctx, w.Service.Store, snapshot.Background.Key, snapshot.Background.SHA256, backgroundPath); e != nil {
		return "", "", 0, e
	}
	render := RenderSnapshot{Document: snapshot.Document, RendererVersion: snapshot.RendererVersion}
	for index, f := range snapshot.Fonts {
		path := filepath.Join(dir, fmt.Sprintf("font-%d.ttf", index))
		if e = copyResource(ctx, w.Service.Store, f.Key, f.SHA256, path); e != nil {
			return "", "", 0, domain.E("MISSING_FONT", "字体文件缺失或校验失败，请联系管理员")
		}
		render.Fonts = append(render.Fonts, ResolvedFont{AssetID: f.AssetID, Version: f.Version, Path: path, Weight: f.Weight, Style: f.Style})
	}
	if e = fontfile.CheckDocument(snapshot.Document, func(ref document.FontRef) ([]byte, error) {
		for _, font := range render.Fonts {
			if font.AssetID == ref.AssetID && font.Version == ref.Version {
				return os.ReadFile(font.Path)
			}
		}
		return nil, domain.E("MISSING_FONT", "缺少字体文件")
	}); e != nil {
		return "", "", 0, e
	}
	text, report, e := w.Renderer.RenderText(ctx, render)
	if e != nil {
		if strings.Contains(e.Error(), "文字超出画布") {
			return "", "", 0, domain.E("OVERFLOW", "文字超出画布，请调整位置、宽度或字号")
		}
		return "", "", 0, domain.E("RENDER_FAILED", "文字渲染失败，请检查字体和排版后重试")
	}
	if report.Overflow {
		return "", "", 0, domain.E("OVERFLOW", "文字超出画布，请调整排版")
	}
	file, e := os.Open(backgroundPath)
	if e != nil {
		return "", "", 0, e
	}
	background, e := png.Decode(file)
	file.Close()
	if e != nil {
		return "", "", 0, domain.E("MISSING_RESOURCE", "背景图片无法读取")
	}
	if background.Bounds().Dx() != snapshot.Document.Canvas.Width || background.Bounds().Dy() != snapshot.Document.Canvas.Height {
		return "", "", 0, domain.E("INVALID_INPUT", "背景尺寸与快照不一致")
	}
	result, e := Compose(background, text)
	if e != nil {
		return "", "", 0, e
	}
	resultPath := filepath.Join(dir, "result.png")
	if e = encodePNG(ctx, resultPath, result); e != nil {
		return "", "", 0, e
	}
	bounds := result.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width > 2048 || height > 2048 {
		if width >= height {
			height = height * 2048 / width
			width = 2048
		} else {
			width = width * 2048 / height
			height = 2048
		}
	}
	if width < 1 {
		width = 1
	}
	if height < 1 {
		height = 1
	}
	preview := image.NewNRGBA(image.Rect(0, 0, width, height))
	xdraw.ApproxBiLinear.Scale(preview, preview.Bounds(), result, result.Bounds(), xdraw.Src, nil)
	previewPath := filepath.Join(dir, "preview.png")
	if e = encodePNG(ctx, previewPath, preview); e != nil {
		return "", "", 0, e
	}
	output, e := w.putFile(ctx, "exports", resultPath)
	if e != nil {
		return "", "", 0, e
	}
	thumbnail, e := w.putFile(ctx, "export-previews", previewPath)
	if e != nil {
		return "", "", 0, e
	}
	return output.Key, thumbnail.Key, output.Size, nil
}
func (w *Worker) Process(ctx context.Context, lease Lease) error {
	renderCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	done := make(chan struct{})
	heartbeatDone := make(chan struct{})
	go func() {
		defer close(heartbeatDone)
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-renderCtx.Done():
				return
			case <-ticker.C:
				if e := w.Service.Renew(renderCtx, lease, time.Now().UTC()); e != nil {
					cancel()
					return
				}
			}
		}
	}()
	var snapshot projects.RenderSnapshot
	e := json.Unmarshal(lease.Job.Snapshot, &snapshot)
	var key, preview storage.Key
	var size int64
	if e == nil {
		key, preview, size, e = w.Render(renderCtx, snapshot)
	}
	close(done)
	<-heartbeatDone
	publishCtx, stop := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer stop()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if e != nil {
		code, message := "EXPORT_FAILED", "导出失败，请稍后重试"
		var known *domain.Error
		if errors.As(e, &known) {
			code, message = known.Code, known.Message
		}
		if renderCtx.Err() != nil {
			code, message = "EXPORT_TIMEOUT", "导出超时或进程中断，请重新发起导出"
		}
		return w.Service.Fail(publishCtx, lease, code, message, time.Now().UTC())
	}
	// Unique attempt files are never deleted on publication failure. GC handles
	// unreferenced keys after its grace period; an old attempt cannot delete a winner.
	return w.Service.Complete(publishCtx, lease, key, preview, size, time.Now().UTC())
}
func (w *Worker) Run(ctx context.Context) error {
	for {
		if e := ctx.Err(); e != nil {
			return nil
		}
		lease, e := w.Service.Claim(ctx, w.ID, time.Now().UTC())
		if e != nil {
			return e
		}
		if lease == nil {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(time.Second):
			}
			continue
		}
		if e = w.Process(ctx, *lease); e != nil {
			var known *domain.Error
			if !errors.As(e, &known) || known.Code != "LEASE_LOST" {
				return e
			}
		}
	}
}
