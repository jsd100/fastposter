# 品牌图标验收

日期：2026-11-04。

按重新设计要求，使用内置 imagegen 从零生成纯图案图标：暖灰白底，雾粉、浅杏和灰蓝的莫兰迪浅色三片折纸旋转组合，不含文字、字母或缩写。原图和完整提示词见 `assets/branding/README.md`。用户站及管理站通过共享 `BrandIcon` 组件替换原有 Fp 标记，包括登录页、移动端登录品牌、作品导航、加载状态和管理导航。三个 HTML 入口均配置 favicon 和 Apple touch icon，并使用新的 morandi 文件名更新浏览器缓存。

## 验证结果

- `pnpm typecheck`：通过。
- `pnpm build`：8 个工作区构建全部通过；用户站及管理站存在超过 500 kB 的 JS chunk 提示，不影响构建。
- `git diff --check`：通过。
- Playwright 浏览器检查：访问本机用户站 `/login` 和管理站 `/admin/login`；256 × 256 品牌图片加载成功；favicon 和 Apple touch icon 均返回 PNG。1440 × 960 桌面和 390 × 844 移动视口截图已保存；移动图标分别为 29 × 29 和 36 × 36，没有拉伸。
- 检查三个构建产物中的图标路径，确认用户站 `/brand/`、管理站 `/admin/brand/`、渲染入口 `./brand/` 引用的文件均存在且为 PNG。

本次为视觉资源替换，未运行服务端测试或完整业务 E2E；浏览器检查覆盖公开登录页面，未登录检查作品和管理导航页面。

## 截图

- [用户站桌面](screenshots/brand-icon-web-desktop.png)
- [用户站移动端](screenshots/brand-icon-web-mobile.png)
- [管理站桌面](screenshots/brand-icon-admin-desktop.png)
- [管理站移动端](screenshots/brand-icon-admin-mobile.png)
