# 图片导入验证

2026-10-30，在本机 ImageMagick 7.1.2-34、MySQL 26.7.0 运行。

- 静态 JPG/PNG/WebP，EXIF orientation=6 还原为 3×4，内嵌标准 sRGB ICC 转换，RGBA8 输出及 2048 最长边预览。
- APNG / 动态 WebP / CMYK / 16 位图片拒绝；真实文件头与扩展名校验；损坏 PNG 校验和与缺少结束标记的截断 JPEG 拒绝。
- 上传字节 40 MiB、单边 8192、总像素 4000 万独立限制。实际标准化 8000×5000、8192×4882、4882×8192 成功，原像素尺寸保持。
- 随机 4096×4096 JPG 解码输出 PNG 大于 40 MiB 的回归通过；40 MiB 只限制上传原文件，不用于限制无损 PNG。
- Hertz 流式 multipart → 受控共享 FileStore → Kitex core → MySQL 真实链路通过。匿名上传 401、伪扩展名 422、本人授权读取 200，其他用户/不存在素材统一 404。Range 不跳过权限，不返回物理路径/内部 key。
- 暂存只能由拥有者认领一次，过期及错误用途拒绝；失败上传清理暂存；数据库登记失败不产生可用素材，完整孤立文件留给 GC；磁盘 ENOSPC 显式失败。

运行：

```sh
FASTPOSTER_IMAGE_CAPACITY_TEST=1 go test ./server/internal/assets -count=1 -v
python3 tools/test-integration.py -run TestAsset -count=1 -v
```

当前导入范围为静态 RGB / RGBA 图片。不同源 ICC 的视觉抽检及手机导入体验仍需在端到端阶段验证。原始文件字节单独保留；后续海报导出以标准化的 sRGB RGBA8 背景为参照做无损合成，不承诺转换前后不同色彩空间数值完全相同。
