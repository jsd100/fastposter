# 工作色彩配置

`sRGB.icc` 由 LittleCMS 2 的 `cmsCreate_sRGBProfile()` 生成，使用标准 sRGB 色度及传递曲线，不依赖系统显示器配置。导入时 ImageMagick 使用内嵌 ICC 转换到此工作空间；无 ICC 的 RGB 图片按 sRGB 解释。转换后统一为 RGBA8 PNG，并移除 EXIF / ICC 等附加数据。用户上传的原始字节单独保留。

这是生成的标准配置数据，不是从第三方图片提取的配置。生成脚本见 `generate.py`；LittleCMS 本身采用 MIT 许可。重新生成会改变配置创建时间，更新文件时须重新验证标准化像素并调整 normalizerVersion，不能覆盖已登记的素材版本。
