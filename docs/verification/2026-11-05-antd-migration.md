# FastPoster antd 迁移验证记录

日期：2026-11-05。依据：[界面设计规范](../superpowers/specs/2026-11-05-antd-layout-design.md)、[实施计划](../superpowers/plans/2026-11-05-antd-frontend-migration.md)。

## 当前续作记录

```yaml
status: IN_PROGRESS
authorization: "用户 2026-11-05：请你深度分析该需求和相关文档裁量，然后继续该任务"
execution_mode: native
workspace: "/Users/aaa/acode/FastPoster"
branch: "feat/fastposter"
base_commit: "d6c3d45"
last_verified_commit: "6bb9356"
current_task: T02
next_step: T02.9
requirements: [UI-01, UI-02, UI-03, UI-12]
changed_paths:
  - packages/ui/src/{theme.ts,UIProvider.tsx,navigation.tsx,index.ts,styles.css,package.json}
  - packages/api-client/src/browser.ts
  - packages/api-client/package.json
  - packages/poster-editor/src/{Editor.tsx,css.d.ts}
  - apps/web/src/{main.tsx,router.tsx,api.ts,styles.css}
  - apps/admin/src/{main.tsx,router.tsx,api.ts,styles.css}
  - apps/admin/src/features/templates/TemplateList.tsx
  - tools/check-entry-boundary.mjs
  - pnpm-lock.yaml
decisions:
  - "T02 入口边界以 Vite manifest 的 isEntry + 递归静态 imports 为闭包，再读取各 chunk sourcemap 的 sources；Rolldown runtime shim 无 sourcemap，按已知运行时块跳过。"
  - "typecheck 必须在规范大小写路径 /Users/aaa/acode/FastPoster 运行；从小写路径运行会让 tsc 把同一文件按大小写重复计入并报 TS1261（环境路径问题，非代码错误）。"
  - "antd 主题在 T02 只作用于 antd 组件；旧 --fp-* 变量与页面 CSS 颜色保持不变，等对应控件迁移时再更新焦点颜色断言。"
red_check: "node tools/check-entry-boundary.mjs entry-audit/{web,admin,renderer}：web/admin FAIL（静态入口含 @tiptap、prosemirror），renderer PASS。"
checks:
  - "pnpm typecheck（规范路径）→ 退出码 0"
  - "pnpm test → 25 文件、139 项通过"
  - "pnpm build → 8/8 任务成功；web 入口 892.79 kB / gzip 291.91 kB，ProjectWorkspace 479.45 / 152.43；admin 入口 24.49 / 8.58 + api 743.07 / 246.43，TemplateEditor 461.73 / 146.43；renderer 311.79 / 95.20"
  - "playwright ui-controls.spec.ts → 17/17 通过（51.2s）"
  - "playwright templates.spec.ts → 2/2 通过（17.6s）"
  - "node tools/check-entry-boundary.mjs → web PASS 742 sources、admin PASS 714、renderer PASS 35"
artifacts:
  - ".cache/fastposter-antd-migration/entry-audit（manifest + sourcemap 构建）"
blockers: []
```

## T01 建立可重复的浏览器基线

### T01.1 环境与开工信息

- 开工 HEAD：`d6c3d45fd5f662d838f2e5e556ba982b8dd5a24e`（`d6c3d45 feat: 修复bug+antd skill`）。
- 分支/工作区：`feat/fastposter`，仓库根目录 `/Users/aaa/acode/FastPoster`；未另建 worktree，现有未提交文档按原归属保留。
- 环境：Node `v24.21.0`、pnpm `11.25.0`、Go `1.27.2`、MySQL `26.7.0`、Chrome（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）、ImageMagick `7.1.2-34`。
- `go run ./tools/doctor -check all`：config、mysql、redis、chrome、magick 全部 `ok:true`。
- 截图条件：桌面 `1440×1000`；手机 `390×844`、`hasTouch:true`、`deviceScaleFactor:2`。

### T01.2 过时截图断言定位

- 现状报告记录了截图流程卡在“中文选区点击 Inter 并等待缺字通知”。
- `tests/e2e/editor-fonts.spec.ts:117` 已要求中文选区中的 Inter 为禁用。
- `tests/e2e/ui-baseline.spec.ts` 桌面与手机两处仍点击 Inter 并等待“缺少字形”通知（修改前分别位于 258、359 行附近），与产品当前行为不一致。

### T01.3 截图脚本修正

- 桌面：改为断言 Inter `toBeDisabled()`，截图 `d-11-font-unavailable`，按 Escape 后断言 listbox 关闭。
- 手机：改为断言 Inter `toBeDisabled()`，截图 `m-11-font-unavailable`，按 Escape 后断言 listbox 关闭。
- 中文选区、禁用原因和缺少字形的前置校验逻辑未修改。

### T01.4 导出基线写入

- `tests/e2e/export.spec.ts` 在原有 1200×1600、预览 SHA-256、下载 SHA-256 断言全部通过后，按 `FP_EXPORT_BASELINE_PATH` 写出下载文件。
- 未在测试中生成替代 PNG；未改变原断言。

### T01.5 基线采集结果

- 强制生产构建：`pnpm exec turbo run build --force`，8/8 任务成功，无缓存命中，退出码 0。
- 基线包体（构建工具十进制 kB）：web 主 JS `1,107.08 kB` / gzip `351.64 kB`，CSS `40.76 kB` / gzip `9.11 kB`；admin 主 JS `1,102.69 kB` / gzip `347.42 kB`，CSS `53.47 kB` / gzip `11.34 kB`；renderer 主 JS `311.79 kB` / gzip `95.20 kB`，无独立 CSS。
- 截图采集：`FP_UI_BASELINE=1`，输出目录 `.cache/fastposter-antd-migration/before`，2 项通过（21.4s）。共 22 张 PNG：桌面 11 张（1440×1000）、手机 11 张（CSS 390×844，deviceScaleFactor 2，实际 PNG 780×1688）。
- 导出基线：`FP_EXPORT_BASELINE_PATH`，2 项通过（12.1s）；`export.png` 为 1200×1600，SHA-256 `f36c78f99c2d354c6dd2c4ee8f02cc645ee4988c9b03701c6af227d674c19e85`。
- 运行环境：Google Chrome `156.0.8078.80`；Node/pnpm/Go/MySQL/ImageMagick 同 T01.1。
- 完整日志：`.superpowers/sdd/2026-11-05-antd-frontend-migration/t01-build.log`、`t01-ui-baseline.log`、`t01-export-baseline.log`。

### T01.6 用例清单

- `pnpm exec playwright test --list`：18 个文件、79 项用例。
- 已复现的 429 条件：同一 IP 每 10 分钟最多 20 次注册（`server/internal/auth/service.go` 的限流）；连续新建测试账号的合并运行会触发。
- 执行方式：每个 spec 独立启动真实临时栈；`ui-baseline.spec.ts` 的桌面和手机两项必须同文件同一栈运行，手机项依赖桌面项创建的种子数据。以 `--list` 清单作为 T11 对照。
- 清单日志：`.superpowers/sdd/2026-11-05-antd-frontend-migration/t01-playwright-list.log`。

### T01.7 提交

提交 `test(ui): restore reproducible visual baseline`，包含 `tests/e2e/ui-baseline.spec.ts`、`tests/e2e/export.spec.ts` 和本验证记录。

## T02 接入主题并分离入口依赖

### T02.1 挂载关系与入口边界

- 两站保持 `QueryClientProvider` 在最外层；新增 `UIProvider` 位于 `NotificationsProvider` 之外，通知与共享控件可以读取 antd 上下文。
- `apps/renderer` 不引入 `UIProvider`、antd 或共享 UI；入口只使用 schema 与 renderer。
- 共享 reset、品牌、`visually-hidden`、`panel`、`simple-page`、`app-loading`、`pagination` 迁到 `packages/ui/src/styles.css`，由包的 `exports["./styles.css"]` 暴露。两站显式导入共享样式后再导入各自页面样式。
- 编辑器样式改为随 `packages/poster-editor/src/Editor.tsx` 加载；后台不再通过 `@import url("../../web/src/styles.css")` 继承用户站样式。后台仍使用的 `.sidebar-caption` 放回后台样式文件。
- 导航迁到 `packages/ui/src/navigation.tsx`，请求与下载迁到 `packages/api-client/src/browser.ts`；两站 `router.tsx`、`api.ts` 只做 re-export。修饰键、Cookie、`session-expired` 与下载命名逻辑未变。

### T02.2 入口边界红灯

- 新增 `tools/check-entry-boundary.mjs`：从 Vite manifest 的 `isEntry` 出发递归静态 `imports`，读取各 chunk sourcemap 的 `sources`。
- 约束：web/admin 的静态入口不得包含 `@tiptap/` 或 `prosemirror-`；renderer 入口不得包含 `node_modules/antd/`、`packages/ui/src/`。
- 改造前运行：web FAIL（静态入口含 22 个 `@tiptap/*` 与 11 个 `prosemirror-*` source）、admin FAIL（同量），renderer PASS（35 sources）。
- Rolldown 产物中的 `assets/rolldown-runtime-*.js` 没有 sourcemap；脚本只对该已知运行时块跳过，其他 chunk 缺 map 仍判失败。

### T02.3 antd 版本与主题

- `pnpm --filter @fastposter/ui add --save-exact antd@6.7.0`；`packages/ui/package.json` 与锁文件记录精确版本。
- 已核对 antd `6.7.0` 的 peer 为 `react >=18.0.0`、`react-dom >=18.0.0`，当前 React/ReactDOM `19.3.1` 满足。
- `theme.ts` 映射 `colorPrimary #2E694F`、`colorError #A63232`、`colorBgLayout #F3F5F4`、`colorBgContainer #FFFFFF`、`colorText #202C25`、`colorTextSecondary #526159`、`controlHeight 36`、`fontSize 14`、中文优先 UI 字族。
- `UIProvider` 使用 `ConfigProvider` + `zh_CN` + 上下文内 `App component={false}`，不额外增加布局节点。旧 `--fp-*` 变量保留，避免本批改变现有页面视觉与焦点颜色断言。

### T02.4 共享样式拆分

- `packages/ui/src/styles.css` 新增全局 reset、`:root` 基础字体、`muted`/`eyebrow`/`brand`、`panel`/`simple-page`/`app-loading`/`visually-hidden`/`pagination` 以及减少动效规则。
- `apps/web/src/styles.css` 删除已迁出的规则和两条 `@import`；保留认证、作品集、工作区、素材选择和导出等用户站页面规则。
- `apps/admin/src/styles.css` 删除对用户站 CSS 的导入；补充 `.sidebar-caption`。后台登录、表格、资源、文案和模板规则保留。
- `packages/poster-editor/src/{Editor.tsx,css.d.ts}`：编辑器样式随组件加载，并为 CSS 副作用导入补充声明。

### T02.5 共享导航和请求

- `navigation.tsx` 保持 `navigate(path, replace?)`、`usePath()`、`Link` 的修饰键与新窗口行为。
- `browser.ts` 保持 `request` 的 `AUTH_REQUIRED → session-expired` 事件、`errorMessage` 与 `download` 的 Cookie、文件名和错误解析行为。
- `apps/admin` 不再从 `apps/web/src` 引用路由或请求实现；`grep` 未发现后台源码或包清单引用 `apps/web`。

### T02.6 懒加载与构建结果

- web 以 `React.lazy` 加载 `ProjectWorkspace`，加载期间显示只读状态；登录和作品集入口不含 Tiptap/ProseMirror。
- admin 按路由懒加载 Metadata、Resources、TemplateList、CopyPage；`TemplateEditor` 在打开模板时再加载。认证、重定向和管理员权限判断保持在入口。
- `vite build --manifest --sourcemap --outDir .cache/fastposter-antd-migration/entry-audit/*` 三应用均成功。
- 静态入口实际 source 归因：web 入口 antd 135、`packages/ui` 若干、Tiptap 0、ProseMirror 0；admin 入口闭包 antd 136、`packages/ui` 31、Tiptap 0、ProseMirror 0；renderer antd 0、UI 0。
- 动态 chunk：web `ProjectWorkspace-*.js` 含 22 个 Tiptap source；admin `TemplateEditor-*.js` 含 22 个 Tiptap source。
- 生产构建体积（十进制 kB）：web 入口 `892.79` / gzip `291.91`，编辑器 chunk `479.45` / `152.43`，入口 CSS `32.80` / `7.53`，编辑器 CSS `7.97` / `2.30`；admin 入口 `24.49` / `8.58`，共享 api chunk `743.07` / `246.43`，模板编辑器 `461.73` / `146.43`，模板列表 `96.56` / `28.50`；renderer `311.79` / `95.20`。
- 两站仍有大于 500 kB 的 chunk 告警；本任务只建立加载边界，未做进一步依赖归因。

### T02.7 最终边界检查

```text
web: PASS 2 entry chunk(s), 742 source(s)
admin: PASS 2 entry chunk(s), 714 source(s)
renderer: PASS 1 entry chunk(s), 35 source(s)
```

### T02.8 回归命令

- `pnpm typecheck`（在 `/Users/aaa/acode/FastPoster` 运行）：退出码 0。运行路径大小写不一致会触发 TS1261，已在续作记录中标注。
- `pnpm test`：25 个文件、139 项通过。
- `pnpm build`：8/8 任务成功（2 项 Turbo 缓存命中）。
- `pnpm exec playwright test tests/e2e/ui-controls.spec.ts`：17/17 通过，51.2s，输出目录 `.cache/fastposter-antd-migration/T02/ui-controls`。
- `pnpm exec playwright test tests/e2e/templates.spec.ts`：2/2 通过，17.6s，输出目录 `.cache/fastposter-antd-migration/T02/templates`。

### T02.9 提交

提交 `feat(ui): add shared Ant Design theme and isolate app entries`。
