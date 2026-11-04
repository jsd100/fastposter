# 字体、预设文字颜色与本地快捷填充验收

日期：2026-11-04。

## 变更与根因

- 用户站本地登录页新增「填入快捷账号」按钮，仅填充、不自动登录，提交中不可点击。账号配置保存在被 Git 忽略的 `apps/web/.env.local`，配置键示例见 `apps/web/.env.example`。注册页和生产构建不提供此入口。
- 在作品 `1f839fc266ceb23215bed06b8c1de940` 中复现选择 Inter 时的「所选字体缺少字形」错误：选中的是中文，Inter 本身不包含中文字形。现在针对完整选区或整块内容判断已知西文字体的适用性，在包含中日韩字符或全角标点时禁用西文选项并显示说明；英文选区与空光标仍可选 Inter。字体预览的西文样张改为英文。服务端字形校验继续保留。
- 新增马善政毛笔楷书、龙藏手书、站酷庆科黄油体、刘建毛草，共 10 个家族、15 个字面。文件取自固定提交，记录 SHA-256 并附原始授权文件，来源见 `assets/fonts/README.md` 和 `manifest.json`。核心服务重启会幂等补齐，不需要迁移，不替换旧字体版本。
- 共享文字面板新增带色块的颜色下拉，共 24 种颜色，覆盖经典、莫兰迪、复古、自然、商务、活力六类。复用原有选区/光标/整块样式应用与撤销机制，保留自定义颜色输入。共享 Select 支持可选色块，用户站与管理站均使用同一实现。

## 验证结果

- `pnpm typecheck`：通过。
- `pnpm test`：18 个文件、111 项通过。
- `pnpm build`：8 个工作区构建通过；仍有既有的大于 500 kB 的 JS chunk 提示。
- `go test ./server/internal/assets -count=1`：通过，包括字体清单、固定来源和中文覆盖检查。
- `python3 tools/test-integration.py -run 'TestBuiltinFonts' -count=1 -v`：3 项通过，使用受保护测试数据库，未跳过。
- `pnpm test:e2e tests/e2e/editor-fonts.spec.ts`：原有 9 项通过；新增颜色用例第一次因未选中内容为原始 DOM 文本节点而非独立元素，定位器失败。改用文本节点的实际计算颜色检查未选中内容，未修改颜色实现。
- `pnpm test:e2e tests/e2e/editor-fonts.spec.ts --grep 'preset color|new bundled Chinese'`：2 项通过。覆盖选区颜色不影响外侧文字、保存重载、四款字体实际加载与渲染、最终字体保存重载及 PNG 导出。
- `pnpm test:e2e tests/e2e/ui-controls.spec.ts tests/e2e/editor-mobile.spec.ts`：20 项通过。覆盖共享控件交互、键盘、弹层、移动字体菜单和选区保留。
- 手动 Playwright 检查：本地快捷填充写入配置值且停留在登录页，随后可正常登录；注册页入口数为 0。独立无登录上下文中的生产登录页入口数为 0，生产 JS 不含快捷入口文案、配置键或本地密码字面量。
- 实际作品中字体目录显示全部 10 个家族，中文目标下 Inter 为禁用状态。移动端 390 × 844 视口可访问全部 24 个颜色选项，弹层位于视口内。
- 独立代码复核未发现实质问题；复核额外运行的四项字体清单/来源/覆盖 Go 测试均通过。

测试期间未对用户作品应用新的字体或颜色。界面截图仅保存属性面板区域，避免包含作品画面。

## 截图

- [字体目录](screenshots/font-menu-expanded.png)
- [文字面板](screenshots/editor-font-color-controls.png)
- [颜色下拉](screenshots/text-color-presets.png)
- [移动端颜色弹层](screenshots/text-color-mobile.png)
- [本地登录快捷填充](screenshots/login-quick-fill.png)
