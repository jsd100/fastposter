# Repository Guidelines

## 项目结构与职责划分

FastPoster 是本机原生运行的海报编辑器，使用 React/TypeScript 前端、Go 服务、MySQL 和本地文件存储。

- `apps/web`、`apps/admin`：用户站与管理站；`apps/renderer`：Chrome 导出渲染入口。
- `packages/poster-schema`、`packages/poster-renderer`、`packages/poster-editor`：文档校验、排版渲染和编辑交互；共享控件放在 `packages/ui`，API 调用放在 `packages/api-client`。
- `server/cmd`：网关、核心服务、worker 及运维命令；`server/internal`：领域逻辑、存储和传输适配；`internal/config`：共享配置；`server/migrations`：数据库迁移。
- `idl`、`server/gen`：Thrift 契约与生成代码；`assets`：字体、色彩配置等静态资源。
- `tests/e2e`、`tests/fixtures`：浏览器测试与固定样例；`deploy`：部署说明；`docs/verification`：验收记录。

跨站功能优先复用共享包，避免在用户站、管理站和导出入口重复实现排版或编辑逻辑。

## 环境准备与本地开发

依赖 Node 24、pnpm 11、Go 1.27、MySQL 8+、Chrome/Chromium、ImageMagick 7 和 Python 3；Redis 可选。具体工具版本参见 `package.json`、`go.mod` 和 `deploy/toolchain.lock.json`。

首次启动按以下顺序执行：

```sh
corepack pnpm install --frozen-lockfile
go mod download
cp deploy/local.env.example .env.local
# 编辑本机凭据，并按 README.md 创建业务数据库后执行：
go run ./server/cmd/migrate -direction up
go run ./server/cmd/admin-cli -username admin
go run ./tools/doctor -check all
pnpm dev
```

迁移不会随应用启动自动执行。开发默认地址：用户站 `http://127.0.0.1:5173`，管理站 `http://127.0.0.1:5174/admin/login`，网关 `http://127.0.0.1:8080`。

## 构建与验证命令

在仓库根目录运行：

| 命令 | 用途 |
| --- | --- |
| `pnpm build` | 通过 Turbo 构建工作区包和应用 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm test:server` | 测试 `server/...` 和 `tools/...` |
| `go test ./internal/...` | 验证根目录共享配置包 |
| `python3 tools/test-integration.py --all-server` | 使用受保护的测试 DSN 运行服务端测试 |
| `pnpm test:e2e` | Playwright 启动临时完整服务栈并执行验收 |
| `pnpm verify` | 契约漂移检查、类型检查、单元测试及构建 |

`pnpm verify` 不包含 Go 和端到端测试，须按改动范围补跑。契约检查依赖 `.tools/bin` 中的固定版本生成器，安装步骤见 `README.md`。

## 代码风格与契约维护

- TypeScript 使用严格类型、两空格缩进、双引号和分号；组件文件使用 PascalCase，函数及 Hook 使用 camelCase，工具文件沿用相邻代码的命名方式。
- 使用 `pnpm exec prettier --write <文件路径>` 格式化修改过的前端文件，Go 使用 `gofmt -w <文件路径>`；避免无关的全仓格式化。当前未配置独立 lint 脚本。
- 契约修改从 `idl` 开始，运行 `pnpm contracts:generate`，同时提交生成结果；禁止手改 `server/gen`、`packages/api-client/src/generated.ts` 及生成路由。

## Ant Design 前端约定

本节适用于用户站、管理站和共享编辑器。 [当前前端验收](docs/verification/2026-11-13-antd-default-appearance.md) · [A/B 批历史验收](docs/verification/2026-11-06-antd-remediation.md)

- **固定版本**：直接导入 antd 的工作区包固定 `antd@6.7.0`，声明位置 `packages/ui/package.json:15`、`packages/poster-editor/package.json:15`、`apps/web/package.json:17`、`apps/admin/package.json:17`。不升级组件库、不换路由框架、不重写编辑器 store。
- **共享 UIProvider**：用户站与管理站通过 `packages/ui/src/UIProvider.tsx` 使用同一个 provider。组件使用 antd 默认主题，provider 统一提供中文 locale、减少动态效果偏好及通知上下文。
- **renderer 隔离**：`apps/renderer` 独立，不引入 `antd` 或 `packages/ui/src`。`tools/check-entry-boundary.mjs` 的 `forbidden` 规则：renderer 不得含 `node_modules/antd/`、`packages/ui/src/`、`@fastposter+ui@`；web/admin 的静态入口不得含 `@tiptap/`、`prosemirror-`，这些依赖随编辑器按需加载。以 `vite build --manifest --sourcemap` 产物审计。
- **背景库入口与创建/替换契约**：`BackgroundPicker` 提供 `mode: "create" | "replace"`；create 以「用此背景创建」确认并复用 A05 的 `buildProjectFromBackground` 与创建事务（零本地上传），replace 保留 `aria-label="选用 ${title}"` 一次点击旧契约与异尺寸预检/撤销。「确认按钮应写作「替换背景」」的可见文案偏差当前未实现，按 Ruling 63 记为 FP-14 写回项。
- **手机历史与撤销**：390px / 320px 工作台提供可点击「撤销」「重做」，命中区 ≥44×44px；编辑手势、数值草稿与自动保存按 A02/A03 的会话边界收敛。
- **当前视觉样式**：用户站、管理站和编辑器使用 Ant Design 6.7.0 的默认配色、字体、组件尺寸、边框和交互状态。页面样式负责内容排版、滚动和断点，编辑器样式还负责画布、选框和拖拽手柄。手机主操作保留 ≥44×44px 命中区，编辑器文本输入在手机宽度保留 16px。旧绿色主题和控件尺度见 A 批历史验收记录。
- **页面与控件**：作品和素材预览保持原比例，卡片的标题、尺寸和版本或更新时间分层显示。后台搜索框最大宽度 288px，筛选控件按可用宽度换行。编辑器使用 antd Segmented 切换文字、段落、效果和位置，位置单位由数值输入框后缀承载。
- **后台操作样式**：新建、保存和发布使用主按钮，查看详情用链接样式，删除和禁用用危险样式。分类树使用 antd 的 `icon` 插槽，确保添加和编辑图标始终可见。模板卡片最多三个入口，「编辑」「预览」「更多」，发布或下架、导出和删除放在菜单中。沿用现有权限、版本冲突恢复和禁用条件。
- **富文本依赖与开发缓存**：两站的 `vite.config.ts` 通过 `resolve.dedupe` 统一解析 React 和 React DOM，并用 `optimizeDeps.include` 预构建 Tiptap 依赖。`server/tests/integration/browser_stack_test.go` 为两个测试 Vite 进程分别设置 `FASTPOSTER_VITE_CACHE_DIR`，使用各自的临时目录。排查 `useEditor()` 内的 `useRef` 报错时，先确认浏览器是否加载了不同批次的 React 模块。
- **五档与四个断点**：视口 1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×700；编辑器断点 ≥1200px、881–1199px、681–880px、≤680px。`tests/e2e/ui-baseline.spec.ts` 的 `five-width layout guards` 默认可运行（不依赖 `FP_UI_BASELINE`），断言 `document.documentElement.scrollWidth <= innerWidth`、选区可见、关键操作可达。
- **截图与导出采样开关**：`FP_UI_BASELINE=1` 启用截图，`FP_UI_BASELINE_OUT` 指向 `test-results/` 之外的绝对路径（Playwright 会清空 `test-results/`）；`FP_EXPORT_BASELINE_PATH` 把固定导出用例的下载字节写到指定位置（`tests/e2e/export.spec.ts:41-42`）。
- **逐文件独立临时测试栈与预构建 renderer**：E2E 每个 spec 独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output <证据目录>/results/<suite>`，单文件注册限流时按互斥 `-g` 分栈；开工先 `pnpm --filter @fastposter/renderer build`。
- **Chrome 设置方式**：Playwright 取 `CHROME_PATH`（`playwright.config.ts:12-15`，默认 macOS 路径）；服务端 `internal/config`、导出 worker 与 4 个 Go 集成 fixture 也统一读 `CHROME_PATH`（`server/tests/integration/render_test.go` 的 `chromePath()`）。`deploy/toolchain.lock.json` 锁定 `156.0.8078.48`（官方 Chrome-for-Testing feed 无该精确版本，最近可得 `156.0.8078.47`），本机实测 `157.0.8103.78`。**导出渲染的真正前提是宿主允许 Chrome 子进程初始化沙箱**，不是浏览器版本匹配；受限宿主由 `server/internal/exports/renderer.go` 默认追加 `chromedp.NoSandbox`，可用 `FASTPOSTER_CHROME_SANDBOX=1` 恢复沙箱（见下方 EXPORT-DIAG 小节）。固定导出样本像素对比已于 2026-11-13 在修正后的契约下完成（`magick compare -metric AE = 0 (0)`），见验收入口「A10.4-R」。
- **`pnpm verify` 实际组成**：`contracts:check → typecheck → test → build`，不含 Go 与 E2E，须按改动范围补跑。

## 测试要求

Vitest 测试与源码相邻，命名为 `*.test.ts`；应用内也支持 `*.test.tsx`。Go 测试使用 `*_test.go`；Playwright 使用 `tests/e2e/*.spec.ts`，复用 `tests/fixtures` 中的样例。

为行为变更和缺陷修复补充对应测试；当前未设置数值覆盖率门槛。可用 `pnpm exec vitest run <测试文件>` 或 `go test <包路径> -run <测试名>` 定向验证。

数据库测试仅使用 `fastposter_test_*`，测试账号需有创建和删除临时测试库的权限。自定义业务库名时显式设置 `FASTPOSTER_TEST_MYSQL_DSN`。未配置测试 DSN 时，部分 Go 集成测试会跳过，提交说明中应区分通过与跳过。浏览器测试还需 MySQL、Chrome 和 ImageMagick；非默认 Chrome 路径通过 `CHROME_PATH` 指定。

## 提交与合并请求

沿用历史中的 Conventional Commits，例如 `feat(editor): ...`、`fix(ui): ...`、`docs: ...`。每次提交聚焦一个目的，不覆盖或混入工作区已有的无关修改。

PR 应说明问题、变更后的行为、关联 issue，以及实际执行的验证命令和结果；未执行或跳过的检查说明原因。界面变更附截图或录屏，涉及验收结论时同步更新 `docs/verification`。配置、契约和迁移变更应说明兼容性及必要的操作步骤。

## 配置与数据安全

`.env.local` 仅用于本机，禁止提交凭据、私有作品和数据库备份。`APP_DATA_DIR` 相对仓库根解析，所有服务必须共享同一绝对数据目录。管理员密码使用交互输入或 `-password-stdin`，不要写入命令行参数。生产 HTTPS 配置需设置 `COOKIE_SECURE=true` 和实际的 `APP_ORIGINS`；备份恢复按 `deploy/backup.md` 操作。

## B 批 · 后台资源写入边界、升级兼容与回滚（FP-11）

本节是 B 批（FP-11 后台资源写入边界）交付的维护契约，逐字重述 B01/B02 已落地的前后端契约、部署兼容单元与回滚规则。当前前端样式见本文的 Ant Design 章节。B 批历史规范、计划与证据见 [A/B 批验收记录](docs/verification/2026-11-06-antd-remediation.md)。

- **适用批次**：A 批 = FP-12 / FP-13 / FP-14 的 antd 迁移后修正；B 批 = FP-11 后台资源写入边界（B01 保存与分类移动版本前提、B02 独立发布意图）。B 批无 B04；B03 是纯文档与最终门槛任务，零产品代码、零 IDL、零生成物、零测试文件改动。

### 两条管理员路由与精确错误码

- **管理员详情**：`GET /api/v1/admin/resources/:id/detail` → `AdminGetResource`（`IDRequest → ResourceReply`），仅管理员可调用；资源缺失或已删除返回 `NOT_FOUND`，供冲突恢复按 ID 重载最新资源。
- **独立发布意图**：`POST /api/v1/admin/resources/:id/publication` → `AdminPublishResource`，请求体**只有** `published` 与 `expectedVersion`，`id` 取自 path，返回 `ResourceReply`。
- **版本前提格式**：`expectedVersion` 为正整数规范十进制字符串（避免 JavaScript number 丢失精度）；创建资源无版本前提。
- **精确错误码映射（勿混写）**：
  - `expectedVersion` 缺失 / 空值 / 格式非法 → `INVALID_INPUT` / HTTP **422**，并提示「刷新旧页面」。
  - `expectedVersion` 合法但过期 → `REVISION_CONFLICT` / HTTP **409**（先于状态比较，故目标状态相同仍冲突）。
  - `published` 缺失或为 JSON `null` → `BAD_REQUEST` / HTTP **400**，且**零写入**。
  - 普通用户 → `FORBIDDEN` / HTTP **403**，且不回显当前版本（先鉴权、不泄露版本）。
- **表单与快捷开关**：4 个编辑表单继续走 `AdminSaveResource` 并保留发布复选框（可原子保存内容与发布状态）；3 处列表 / 卡片快捷发布 toggle 改走新发布路由，只提交发布意图与版本前提，不携带内容快照。
- **保存 / 移动 / 发布事务**：版本前提在事务行锁内核对；锁、校验、行更新、新版本行、依赖引用与审计处于同一事务。过期或失败没有成功审计、没有部分写入；未授权先按既有错误返回，现有资源不可见或已删除时沿用服务端权限校验。

### 冲突恢复链（前台）

- 冲突时**保留草稿与已上传素材引用**，按 ID 经 `AdminGetResource` 重载最新资源，展示最新版本号 / 发布状态 / 标题。
- 仅在管理员**明确「确认重新提交」**后，才以 `latest.version` 重新提交；提供「取消」。
- **禁止**自动重发、静默合并、自动覆盖、吞掉冲突；资源被删除或失去权限时终止重试。重复点击与迟到响应只作用于同一管理员、目标与操作。

### 无 schema 迁移与兼容单元

- B01 / B02 提交**未改动 `server/migrations`**，现有数据与版本行向前兼容，**没有 schema 迁移**，因此没有 down-migration 步骤。
- 交付的兼容单元包含**同一代码版本**的核心服务、网关、管理站与生成 API 客户端；审核部署必须按同一版本整组切换网关、核心与管理站，开发中间提交不得单独部署（Global Constraints）。
- 启动更新前确认旧实例**无法继续通过旧服务写入**；重新打开管理员工作台以取得新前端。**若独立前端或旧服务不能同步切换，冻结管理写入直到整组就绪**。
- **执行完成不代表自动部署**：A、B 两批已于 2026-11-13 经控制器复议改为 `VERIFIED`，A10.4 阻塞项按修正后的宿主沙箱契约闭合（固定样本像素对比 `AE = 0 (0)`、Node 22 与锁定 Node 24 全量 E2E、最终门槛 14/14）；详见验收入口「批次级复议裁定」。**当前仍未部署**，delayed Minor 与 open verification items 归未来全分支评审。

### 真实验证环境与验证命令

- 本机实测：Chrome `157.0.8103.78`、Node `v22.22.2`、Go `go1.27.2 darwin/arm64`、pnpm `11.25.0`、Python `3.13.12`；`deploy/toolchain.lock.json` 锁定 Chrome `156.0.8078.48` / Node `24.21.0`。（A10 的 FP-12 逐字章节与 B01/B02 章节记为 `157.0.8103.51`，系各任务开工时实测；B03 最终门槛复测为 `157.0.8103.78`，均与锁定值不符。**2026-11-13 归因订正（EXPORT-DIAG）**：该版本差异已由对照实验证明不是导出失败的根因（官方 CfT `156.0.8078.47` 不带 `--no-sandbox` 同样 SIGTRAP），根因是宿主 Chrome 子进程沙箱初始化失败；A10.4 阻塞已按修正后的契约闭合。）
- 真实 MySQL 断言**只走** `python3 tools/test-integration.py` 与 `fastposter_test_*` 临时库；直接 `go test ./server/tests/integration` 不读 `.env.local` 会 SKIP，不能算通过。固定导出样本像素对比已于 2026-11-13 在修正后的契约下真实完成（基线 `124b4ea` 与 HEAD 两侧独立采样，`AE = 0 (0)`、字节相同），3 个既有 PNG 用例在 EXPORT-DIAG 真实 `1 passed`；本段的旧 `BLOCKED` / 环境 SKIP 表述属 B03 时点历史，以验收入口「EXPORT-DIAG / A10.4-R」为准。
- 最终门槛（B03.3）：`pnpm verify`、`go test ./internal/...`、`pnpm test:server`、两次 `python3 tools/test-integration.py`、`pnpm --filter @fastposter/renderer build`、逐 spec E2E、`git diff --check`，按 `AGENTS.md` 定向格式化；`GOPROXY=off GOSUMDB=off`，Playwright 预构建 renderer 后逐 spec 起新测试栈。

### 回滚规则（逐字）

1. **先停止管理写入**。
2. **整组回退**（核心服务、网关、管理站与生成客户端作为一个单元），不单独回退某一个服务。
3. **核对当前资源版本与资产引用**。
4. **再恢复写入**。

- 回退到旧服务会**失去本批并发保护**：必须记录该风险，并明确是否需要继续保持写入冻结。
- 回滚**不修改已提交的资源版本、不删除数据**。
- 无 schema 迁移意味着**没有 down-migration 步骤**，不得建议 `migrate -direction down`。

### 导出渲染宿主编排与运维开关（EXPORT-DIAG，2026-11-13）

- **开关语义**：`FASTPOSTER_CHROME_SANDBOX=1`（精确字符串）时 `server/internal/exports/renderer.go` 省略 `chromedp.NoSandbox`，恢复 Chrome 进程沙箱；未设置或任何其它值保持受限宿主默认（追加 `NoSandbox`）。生产 `server/cmd/export-worker/main.go` 构造同一 `Renderer`，故**默认仍无 Chrome 进程隔离**。`renderer_sandbox_test.go` 的 7 个子用例锁定该双向语义。
- **安全取舍（必须随交付传递）**：CSP、`127.0.0.1` 回环与随机令牌只收窄远程内容暴露，**不能替代 OS 进程隔离**。多租户或非本机部署必须重新评估默认值并显式启用沙箱。本受限宿主设 `=1` 会 `sandbox initialization failed` → SIGTRAP、导出不可用，属环境结果而非产品缺陷（也是门控生效的反证）。
- **根因与版本**：导出失败的根因是宿主不允许 Chrome 子进程初始化沙箱，与 Chrome 版本无关；官方 CfT `156.0.8078.47` 不带该 flag 时同样 SIGTRAP。精确锁定 `156.0.8078.48` 在官方 feed 不可得。`CHROME_PATH` 统一控制 Playwright、服务端配置、导出 worker 与 4 个 Go 集成 fixture。
- **兼容与回滚**：`ef29768` / `55ccf59` 只改 `server/internal/exports` 与集成 fixture，**无 IDL、无生成物、无 schema 迁移**；仍按本节「同一兼容单元整组切换」与上文四步回滚规则执行，不单独回退导出 worker，没有 down-migration。
- **验收结论**：固定导出样本在 CfT `.47` 与系统 Chrome `157.0.8103.78` 上字节一致（`AE = 0 (0)`），A10.4 归因与阻塞已订正；详见 `docs/verification/2026-11-06-antd-remediation.md` 的「EXPORT-DIAG / A10.4-R」。
