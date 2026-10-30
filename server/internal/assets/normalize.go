package assets

import (
	"context"
	"fastposter/server/internal/domain"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Normalizer struct{ MagickPath, ProfilePath, PolicyDir string }
type NormalizedImage struct {
	Width, Height     int
	Path, PreviewPath string
}

func (n *Normalizer) command(ctx context.Context, args ...string) error {
	processCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(processCtx, n.MagickPath, append([]string{"-regard-warnings"}, args...)...)
	cmd.Env = append(os.Environ(), "MAGICK_CONFIGURE_PATH="+n.PolicyDir, "MAGICK_TMPDIR="+filepath.Dir(strings.TrimPrefix(args[len(args)-1], "PNG32:")))
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if e := cmd.Run(); e != nil {
		if processCtx.Err() != nil {
			return domain.E("IMAGE_PROCESSING_FAILED", "图片处理超时，请稍后重试")
		}
		return domain.E("IMAGE_PROCESSING_FAILED", "图片标准化失败，文件可能已损坏或包含不受支持的数据")
	}
	return nil
}
func (n *Normalizer) Normalize(ctx context.Context, srcPath, dstPath string) (NormalizedImage, error) {
	var out NormalizedImage
	meta, e := Probe(ctx, srcPath)
	if e != nil {
		return out, e
	}
	if _, e = exec.LookPath(n.MagickPath); e != nil {
		return out, domain.E("NOT_READY", "图片处理服务未初始化")
	}
	if _, e = os.Stat(n.ProfilePath); e != nil {
		return out, domain.E("NOT_READY", "色彩配置未初始化")
	}
	args := []string{"-limit", "memory", "512MiB", "-limit", "map", "1GiB", "-limit", "disk", "2GiB", srcPath, "-auto-orient"}
	if !meta.HasICC {
		args = append(args, "-colorspace", "sRGB")
	}
	args = append(args, "-profile", n.ProfilePath, "-alpha", "on", "-depth", "8", "-strip", "-define", "png:color-type=6", "PNG32:"+dstPath)
	if e = n.command(ctx, args...); e != nil {
		return out, e
	}
	// The upload byte budget does not apply to expanded lossless PNG output.
	normalized, e := probeFile(ctx, dstPath, 192*1024*1024)
	if e != nil {
		return out, e
	}
	preview := dstPath + ".preview.png"
	if e = n.command(ctx, "-limit", "memory", "512MiB", "-limit", "map", "1GiB", "-limit", "disk", "2GiB", dstPath, "-resize", "2048x2048>", "-depth", "8", "-strip", "PNG32:"+preview); e != nil {
		return out, e
	}
	return NormalizedImage{Width: normalized.Width, Height: normalized.Height, Path: dstPath, PreviewPath: preview}, nil
}
