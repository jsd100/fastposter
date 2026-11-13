# FastPoster Ant Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户站、管理站和共享编辑器迁移到 antd，实现已确认的桌面和手机布局，并通过现有编辑、保存和导出行为验收。

**Architecture:** 两站接入共享 `UIProvider`，由 `packages/ui` 维护主题和已有控件接口。编辑器保留 `Stage`、编辑会话、字体预检和撤销事务，在其上调整工具栏、图层及属性面板。页面按功能批次迁移，独立验证，再清理旧组件依赖。

**Tech Stack:** React 19.3.1、TypeScript 7.0.2、Vite 8.3.5、pnpm 11.25.0、antd 6.7.0、Vitest、Playwright、现有 Go/MySQL 临时浏览器测试栈。

**Spec:** [已确认的界面设计](../specs/2026-11-05-antd-layout-design.md) · [交互预览](../../design/2026-11-05-antd-preview/index.html) · [现状与风险](../../analysis/2026-11-05-antd-redesign-analysis.md)

## 实施状态与开工门槛

当前状态为 `PLANNED`，设计方向已确认，实施由用户另行决定。只有明确的实施指示才能进入 T01。文档审阅、认可设计、恢复聊天或读取本文件都属于当前准备阶段。当前勾选框与下文的续作记录示例用于将来实施。

实施指示到达后，按用户选择的方式启用执行技能。先读仓库 `AGENTS.md`、本计划和完整 spec，再确认实际工作区、分支和基线。选用独立 worktree 时使用仓库约定的 `codex/` 分支前缀，记录实际路径。当前分析、原型、spec 和 plan 可能是未提交文件。创建工作区前先用 `git status --short` 逐一识别，并将当前授权的参考文件带入实施目录，保持 spec 的相对链接可用。已有用户改动按原归属保留。

## Global Constraints

- 沿用现有路由、权限、作品和模板格式、API 契约、持久化与 PNG 生成链路。
- 主题使用浅色。内容表面 `#FFFFFF`，工作区 `#F3F5F4`，画布外围 `#E6EAE7`，主要文字 `#202C25`，主操作 `#2E694F`，危险色 `#A63232`，辅助正文 `#526159`。
- 界面标签 13px，正文和常规控件 14px，辅助信息 12px，页面标题 24–29px。普通控件高 36px，面板内紧凑操作 32px，手机触摸目标至少 44px。
- 编辑器断点为 ≥1200px、881–1199px、681–880px、≤680px。用 1440px、1024px、768px、390px 和 320px 核验。编辑器和模板共用 `Editor`。
- 在直接导入 antd 的工作区包声明精确版本 `6.7.0`。已核对该版本 React 和 ReactDOM peer 为 `>=18.0.0`。依赖新增时同时检查锁文件。保留 Lucide 图标。 [antd v6 版本要求](https://ant.design/docs/react/migration-v6/)
- 组件通过 token、语义 `classNames`/`styles` 和自有布局类定制。选择器和测试以角色、可访问名称与项目自有标记为准。应用级 reset 限于用户站和管理站。
- 每批仅处理任务范围及必要调用者。新增触及文件时先在续作记录说明依赖关系。已实现行为或已有测试与计划冲突时，先判断是实现细节、旧定位还是业务契约。业务契约改变需按 spec UI-14 处理。
- 各任务通过后分别按 Conventional Commits 提交。逐文件暂存并用 `git diff --cached --name-status` 确认范围。临时对照、用户私有文件、真实凭据、测试缓存与日志各归其位。
- 浏览器与数据库测试只用项目保护器和 `fastposter_test_*` 临时栈。运行 `pnpm exec prettier --write` 格式化改动的前端文件。

## 上下文压缩、中断和交接

实施时在 `docs/verification/2026-11-05-antd-migration.md` 顶部维护一份短的「当前续作记录」，下方按 T01–T11 追加验证证据。记录与代码同工作区保存。分任务实施时，由协调者维护该记录；任务完成消息是输入，实际 diff 和验证结果才是完成依据。

每次开始任务、准备停下、发现阻塞、结束任务或切换执行者时，更新记录。准备中断时记录正在做的具体步骤和红绿状态。可用下面的格式，值以实际执行结果填写：

```yaml
status: IN_PROGRESS # PLANNED | IN_PROGRESS | BLOCKED | VERIFIED
authorization: "用户明确开工的消息或可定位记录"
execution_mode: native # 或 subagent-driven
workspace: "/实际实施目录"
branch: "实际分支"
base_commit: "开工时 HEAD"
last_verified_commit: "最近有验收证据的提交"
current_task: T03
next_step: T03.4
requirements: [UI-10]
changed_paths: []
decisions: [] # 决定、依据、适用任务
red_check: "命令及真实失败原因"
checks: [] # 命令、退出码、用例计数、结果、证据路径
artifacts: [] # 基线 commit、PNG/截图位置与 SHA-256
blockers: []
```

从压缩、暂停、新聊天或其他执行者接续时按以下顺序恢复：

1. 读用户最新指示，确认是否已明确开工。读当前 `AGENTS.md`、spec 的 UI-01/UI-14、本计划的全局约束、当前任务对应的需求与续作记录。
2. 核对 `git branch --show-current`、`git rev-parse HEAD`、`git status --short`、`git diff --stat`、`git diff --cached --stat`。确认实施目录、上次已验证提交及未提交修改。遇到其他人已有的改动，先识别归属并保留。
3. 对照记录和真实文件。检查 `next_step` 的输入接口、前置任务、当前测试预期、已有未完成改动。已有实现优先接续，只有证据缺失或相关内容已变时才重跑对应验证。
4. 测试命令通过后记录退出码、用例数和证据。只有该任务的完成条件满足才把对应框勾选并进入下一任务。`BLOCKED` 记录缺失条件、已经试过的检查和用户需要决定的事项。
5. 路由、会话归属、版本、文档格式、数据权限、已确认视觉结构与验收口径发生偏移时，定位需求编号和 diff。先完成无依赖工作，再以具体冲突交给用户决定，并在获准后同步更新 spec 和计划。

一个状态记录只标记一个当前任务。结果用 `PASS`、`FAIL`、`SKIP`、`BLOCKED` 分开写。旧结果只代表记录时的代码、环境和测试数据。中途红灯、限制、未做真机测试和缺失证据都留在记录中。

## Review Focus

1. **小数输入刚键入 `12.` 时切换视口。** 草稿仍可继续输入，格式和事务属于原文字块。任务 4、10。
2. **手机抽屉中的字体菜单收到 Escape。** 只关闭该菜单，保留选区，下一次 Escape 关闭抽屉并将焦点还给触发器。任务 3、5。
3. **错误通知显示期间关闭弹窗或更换账号。** 页面级通知随容器迁移，随弹窗卸载的通知关闭，旧账号的消息和迟到回调清掉。任务 3。
4. **作品因删除而从最后一页消失，或退出后切换账号。** 当前列表回退到有效页，下一账号从自己的上下文打开。任务 7、9。
5. **导出排队期间改了文字。** “查看导出”仍显示原任务，任务完成后重新导出使用保存后的新版本。任务 10。

---

## 文件与依赖

| 区域           | 实施位置                                                                                                                        | 职责                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 主题和样式     | `packages/ui/src/UIProvider.tsx`、`theme.ts`、`tokens.css`、`styles.css`                                                        | 根 Provider、语义色、应用基础样式和兼容层  |
| 通用交互       | `packages/ui/src/{Dialog,BottomSheet,NoticeHost,Select,Combobox,NumberField,Button,Input,Form,Status,Tooltip,ToggleButton}.tsx` | 保持现有调用契约并接入 antd                |
| 公共导航和请求 | `packages/ui/src/navigation.tsx`、`packages/api-client/src/browser.ts`                                                          | 解除管理站对用户站内部文件的引用           |
| 编辑界面       | `packages/poster-editor/src/Editor.tsx`、`panels/EditorInspector.tsx`、`styles.css`                                             | 工具栏、图层、属性分组和响应式布局         |
| 页面           | `apps/web/src/features/`、`apps/admin/src/features/`、两站入口和样式文件                                                        | 账号、作品、素材、后台列表与两种编辑工作区 |
| 验证           | `tests/e2e/`、各包已有单测、`docs/verification/2026-11-05-antd-migration.md`                                                    | 每批回归和前后截图、构建记录               |

默认执行顺序为 T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11。T07 提供后台壳，T08 在其上迁移资源。T09 使用已经稳定的共享控件。T10 同时覆盖用户与模板工作区。T11 汇总所有任务的证据后清理兼容层。

| 任务                   | 对应需求                   | 前置与完成条件                                             |
| ---------------------- | -------------------------- | ---------------------------------------------------------- |
| T01 基线               | UI-13、UI-14               | 明确开工。可复现截图与旧版 PNG，记录测试/构建环境          |
| T02 基础接入           | UI-01、UI-02、UI-03、UI-12 | T01。两站正常进入，静态加载图与 renderer 依赖检查通过      |
| T03 弹层与通知         | UI-10、UI-04               | T02。焦点、滚动、通知与删除确认通过                        |
| T04 数值               | UI-07、UI-08               | T02、T03。输入、边界、取消和撤销通过                       |
| T05 选择器、字体、颜色 | UI-07、UI-08、UI-10        | T03、T04。高亮、选区、嵌套、序列化与真实导出字体通过       |
| T06 基础与账号         | UI-02、UI-03、UI-10        | T02–T05。原生表单语义和两站认证通过                        |
| T07 后台记录           | UI-03、UI-04、UI-11        | T06。分组导航、服务端分页、手机摘要与详情通过              |
| T08 后台素材           | UI-05、UI-06、UI-10        | T03、T05–T07。原素材行为与模板工作区返回通过               |
| T09 作品集与素材选择   | UI-04、UI-05、UI-10        | T03、T05、T06。搜索、恢复、删除与素材选择通过              |
| T10 共享工作台         | UI-06–UI-10                | T04、T05、T08、T09。双站共享布局、草稿、历史和导出版本通过 |
| T11 完整验收           | UI-01–UI-14                | T01–T10。旧依赖清理，完整回归、对照图、PNG 和包体记录齐备  |

## 公用验证命令与证据位置

命令从实施 worktree 根目录运行。检查 Node/pnpm、Go、Chrome 和 ImageMagick；数据库走 `tools/test-integration.py` 自带保护。`CHROME_PATH` 影响 Playwright 客户端，另外核对 `server/tests/integration/browser_stack_test.go` 的 worker Chrome 路径。测试环境有阻塞时记录具体边界。直接阅读 `.env.local` 时避免输出凭据。

同一个测试栈按同 IP 每 10 分钟 20 次注册。已复现合跑触发 HTTP 429，按 spec 文件分开启动真实栈。默认串行复用端口，截图文件内的桌面和手机测试在同一栈中保持种子依赖。任一文件需拆分时以 `--list` 的用例清单覆盖全部独立组。不要把 setup 的 429 归为控件失败。

以下 Bash 函数供逐批执行，运行编号用于保留失败证据与复跑输出：

```bash
fp_antd_e2e() {
  local batch="$1" spec stem run_id
  shift
  run_id="$(date +%Y%m%d-%H%M%S)"
  for spec in "$@"; do
    stem="${spec##*/}"
    stem="${stem%.spec.ts}"
    pnpm exec playwright test "$spec" \
      --output "$PWD/.cache/fastposter-antd-migration/$batch/$run_id/$stem" || return
  done
}
```

基线目录使用 `$PWD/.cache/fastposter-antd-migration/before`，迁移后对应 `after`。`FP_UI_BASELINE_OUT` 与 `FP_EXPORT_BASELINE_PATH` 使用各自目录的绝对路径。记录采集任务的 commit、实际 Chrome 版本、视口、触摸模拟参数和 PNG SHA-256。最终报告收录经核对的截图及证据引用。若临时目录丢失，在已记录的 T01 提交上用同环境补采前置样本，避免用已迁移版本替代原基线。

运行适用单测与类型检查。新交互断言先确认旧行为下的预期失败，既有回归先确认绿色。格式断言从旧 DOM 或主题迁到新实现时，保留原测试意图，例如键盘可达、行整宽可点、手机点击尺寸、关闭层级。版本固定后按 antd 技能查受影响组件的公开 API，并在修改文件上检查使用和弃用问题。每个任务结束记录必跑命令、通过/失败/跳过数量及复查证据，再提交本任务文件和续作记录。

### T01 建立可重复的浏览器基线

**Files:** 修改 `tests/e2e/ui-baseline.spec.ts` 和 `tests/e2e/export.spec.ts`。创建 `docs/verification/2026-11-05-antd-migration.md`，记录命令、环境和结果。

**Interfaces:** 继续使用 `FP_UI_BASELINE=1` 与 `FP_UI_BASELINE_OUT`。桌面与手机的基线用例同属一个文件，依赖相同的测试数据。第一条 PNG 用例在设置 `FP_EXPORT_BASELINE_PATH` 时将已通过预览和下载一致性断言的下载内容写到该路径。

- [ ] **T01.1** 记录开工时 HEAD 和实际 worktree。确认测试 MySQL、两个 Chrome 调用路径、ImageMagick、版本工具链和安全的证据目录。先构建 renderer，让 worker 的 dist 对应当前基线。记录 1440×1000 和 390×844 的原截图条件。
- [ ] **T01.2** 读现状报告的截图失败记录，并对照 `editor-fonts.spec.ts` 对中文选区的禁用断言，定位截图脚本中桌面和手机两处过时的 Inter 点击。
- [ ] **T01.3** 将两处 Inter 截图断言改为 `await expect(interOption).toBeDisabled()`，采集菜单状态，随后按 Escape 并确认 listbox 已关闭。用 `d-11-font-unavailable` 和 `m-11-font-unavailable` 命名截图。
- [ ] **T01.4** 在 `export.spec.ts` 的首条真实下载测试完成后按可选环境变量写文件。原断言继续验证 1200×1600、预览 SHA-256 和实际下载 SHA-256。使用原用例及背景样本，不在测试中生成替代 PNG。
- [ ] **T01.5** 运行下列基线命令。预期截图文件两项通过，实际下载写入对照目录。记录 PNG SHA-256、Chrome 版本、视口，以及基线生产构建的入口与总 gzip 体积。

  ```bash
  fp_before="$PWD/.cache/fastposter-antd-migration/before"
  mkdir -p "$fp_before"
  pnpm exec turbo run build --force
  FP_UI_BASELINE=1 FP_UI_BASELINE_OUT="$fp_before" \
    fp_antd_e2e T01 tests/e2e/ui-baseline.spec.ts
  FP_EXPORT_BASELINE_PATH="$fp_before/export.png" \
    fp_antd_e2e T01 tests/e2e/export.spec.ts
  shasum -a 256 "$fp_before/export.png"
  ```

- [ ] **T01.6** 用 `pnpm exec playwright test --list` 保存初始用例清单。记录当前已知 429 复现条件、按文件隔离方式及用例总数，作为 T11 对照。
- [ ] **T01.7** 提交 `test(ui): restore reproducible visual baseline`。

### T02 接入主题并分离入口依赖

**Files:** 创建 `packages/ui/src/UIProvider.tsx`、`theme.ts`、`navigation.tsx` 和 `packages/api-client/src/browser.ts`。修改这两个包的 `src/index.ts`、`packages/ui/package.json`、`tokens.css`、`styles.css`、两站 `main.tsx`/`styles.css`/`router.tsx`/`api.ts`、`packages/poster-editor/src/Editor.tsx` 和 `pnpm-lock.yaml`。

**Interfaces:** `UIProvider({ children }: { children: ReactNode }): ReactElement`。导航继续导出 `Link`、`navigate(path: string, replace?: boolean): void`、`usePath(): string`。浏览器 API 继续导出 `request<Q, R>(route: Route<Q, R>, input: Q): Promise<R>`、`errorMessage`、`download`。

- [ ] **T02.1** 在两站入口与 `apps/renderer/src/main.tsx` 确认挂载关系。现有 `QueryClientProvider`、会话 Provider 和通知 scope 保持各自职责，UIProvider 放在共享控件与通知宿主外层。两站按各自权限入口处理懒加载。
- [ ] **T02.2** 保留当前账号和后台登录验收。补一条构建边界检查，枚举入口静态依赖的 sourcemap sources，断言 web 与 admin 的登录入口均不含 `@tiptap`/`prosemirror`，renderer 入口不含 `antd`、`@fastposter/ui`。在现有入口上确认前两项失败。
- [ ] **T02.3** `pnpm --filter @fastposter/ui add --save-exact antd@6.7.0`。创建 `UIProvider`，使用 `ConfigProvider` 的 `zh_CN` 与上下文内的 `App`。主题按全局约束映射 `colorPrimary`、`colorError`、`colorBgLayout`、文字、控件高度和字号。旧 `NotificationsProvider` 在本批仍置于 Provider 内。保留旧控件的样式变量，等对应控件切换时更新焦点颜色测试。
- [ ] **T02.4** 将两站共享的 reset、品牌、可视隐藏和控件基础规则迁到 `@fastposter/ui/styles.css`，从包的 `exports` 暴露样式入口。编辑器样式随 `Editor.tsx` 加载。逐项把后台仍需的页面布局规则放回后台样式文件，再去掉后台对 web CSS 的导入。
- [ ] **T02.5** 迁移共享导航及请求实现，两站现有 `router.tsx` 和 `api.ts` 只作本包 re-export。保持导航修饰键行为、Cookie、`session-expired` 和下载逻辑。
- [ ] **T02.6** Web 用 `React.lazy` 加载 `ProjectWorkspace`。后台按路由懒加载内容页，`TemplateEditor` 到打开时才加载。保持认证、重定向和加载状态。分别用三个应用的 manifest 与 sourcemap 检查静态入口，从 manifest 的 `isEntry` 出发递归 `imports`，动态模块单独记录。产物和清单放验证目录，生产 dist 由正常构建生成。

  ```bash
  fp_entry_dir="$PWD/.cache/fastposter-antd-migration/entry-audit"
  pnpm --filter @fastposter/web exec vite build --manifest --sourcemap --outDir "$fp_entry_dir/web"
  pnpm --filter @fastposter/admin exec vite build --manifest --sourcemap --outDir "$fp_entry_dir/admin"
  pnpm --filter @fastposter/renderer exec vite build --manifest --sourcemap --outDir "$fp_entry_dir/renderer"
  ```

- [ ] **T02.7** 核对 `apps/admin` 的业务入口和样式没有引用 `apps/web/src`。确认首屏只有当前路由所需的依赖。记录判断包含 Tiptap/ProseMirror 与 antd 的实际 source 路径，以同样方法在 T11 复验。
- [ ] **T02.8** 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`，并分开运行 `ui-controls.spec.ts` 与 `templates.spec.ts`。预期通过，且入口检查通过。
- [ ] **T02.9** 提交 `feat(ui): add shared Ant Design theme and isolate app entries`。

### T03 迁移弹层、快捷键桥接和通知

**Files:** 修改 `packages/ui/src/{Dialog,BottomSheet,NoticeHost}.tsx`、`modal-layer.ts`、`notifications.ts`、`index.ts` 及相应样式模块。修改 `packages/poster-editor/src/keyboard.ts`。测试 `packages/ui/src/notifications.test.ts`、`packages/poster-editor/src/keyboard.test.ts`、`tests/e2e/ui-controls.spec.ts`、`notifications.spec.ts`、`editor-mobile.spec.ts`。

**Interfaces:** 保留 `Dialog` 和 `BottomSheet` 的现有属性、`registerModalLayer(element): () => void`、`topModalLayer(): HTMLElement | null` 和通知 hooks。新增 `registerPopupLayer(): () => void`、`hasActiveOverlay(): boolean` 供下拉及编辑器使用。

- [ ] **T03.1** 阅读 `ProjectDeletionConfirm`、冲突/草稿恢复、图库和导出调用，列出可关闭路径。延续既有 `onClose` 策略，特别是提交中禁止关闭与恢复弹窗要求显式决定的行为。
- [ ] **T03.2** 固定双层焦点和账号隔离。用现有背景库用例断言弹窗来源消息随卸载消失。补 `page retry notice survives an overlay transition`，让作品列表查询失败并出现持久的“重新加载”通知，再打开和关闭“模板库”。断言 `await expect(retryNotice).toHaveCount(1)`，触发重试后同一查询重新执行。沿用换账号及释放旧请求后计数仍为 0 的用例。
- [ ] **T03.3** `Dialog` 组合 antd `Modal`，关闭按钮可读名称为“关闭”。`BottomSheet` 使用底部 `Drawer`。把自己的弹层标记与稳定 Portal 容器放在内容节点。打开时注册，关闭/卸载时注销。沿用各调用者的允许关闭策略、忙碌态和删除确认默认焦点。
- [ ] **T03.4** 更新窗口快捷键判断。模态与弹层注册状态生效，兼容迁移中的旧选择器标记。处理当前按键时若子层消费 Escape，则父层和画布均不消费同一事件。
- [ ] **T03.5** 以 antd 上下文内的 `message`/`notification` 替换旧 toast 显示层，保留 `createNoticeStore`、按 id 去重、更新、4/6 秒时长、持久通知与账号 generation。带动作通知位于当前弹层可达的区域。弹层变化时保留活动通知及其关闭/重试动作。按 `NoticeEntry.timeout` 从毫秒换算为组件秒数，`0` 保持常驻。
- [ ] **T03.6** 断言同 id 更新仍只有一条，通知动作未落入 `aria-hidden`，关闭/重新打开弹层不重触发重试。弹层组件卸载后注册计数恢复，当前画布操作可继续使用快捷键。旧 DOM 标记保留到旧选择器迁完。
- [ ] **T03.7** 执行 `pnpm exec vitest run packages/ui/src/notifications.test.ts packages/poster-editor/src/keyboard.test.ts`，再用 `fp_antd_e2e T03 tests/e2e/ui-controls.spec.ts tests/e2e/notifications.spec.ts tests/e2e/editor-mobile.spec.ts`。用新的临时栈执行 `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts -g 'defaults to cancel'`。预期焦点、Escape、滚动锁、通知和删除默认焦点均符合 UI-04/UI-10。
- [ ] **T03.8** 提交 `feat(ui): migrate overlays and scoped notifications`。

### T04 迁移数值输入并保留编辑事务

**Files:** 修改 `packages/ui/src/NumberField.tsx`、`NumberField.module.css`、`number-draft.test.ts`。沿用 `number-draft.ts`。检查编辑器现有字号、段落、效果、几何调用和后台模板排序。测试 `tests/e2e/ui-controls.spec.ts`、`editor-settings.spec.ts`。

**Interfaces:** `NumberField(props: NumberFieldProps): ReactElement`。保留 `value: number | null`、`onValueChange`、`min/max/step`、`stepBase`、`unit`、`onInteractionStart/End` 和 `variant`。T10 在属性区域切换时可携带原始草稿，草稿以编辑会话、文字块、字段为边界。

- [ ] **T04.1** 复用现有顺序输入、未完成小数、混合字号、长按和触屏取消用例。扩充 `unfinished decimals stay drafts until a valid number is entered`。在字距原值 `12` 时输入 `0.`，断言 `await expect(spacing).toHaveValue('0.')`、`await expect(block).toHaveCSS('letter-spacing', '12px')`，Escape 后显示 `12`。继续输入前重新建立草稿。
- [ ] **T04.2** 查询固定版本的 `InputNumber`。普通数字场景可用其受控模式。编辑器若无法用 `mode="spinner"` 保全原始输入与单次事务，用 antd `Input` 和两个 `Button` 组合，由现有 `classifyNumberDraft` 与领域逻辑提交值。以本任务的浏览器验收决定是否采用 spinner。记录所选方式和触发条件。
- [ ] **T04.3** 按 UI-08 保留原始值、当前有效值与输入前值。验证空串、全角数字、Unicode 减号、非法粘贴、未完成小数、Enter/Escape、边界、混合步进和单位。有效数字按现有时机写入。属性组件依旧以传入的上下限约束，不从 UI 样式推导字段范围。
- [ ] **T04.4** 长按开始和结束各调用一次交互钩子，释放、`pointercancel`、失焦及卸载结束重复。验证用两次撤销观察历史边界，第一次回到按压前，第二次只撤销前一笔已存在的独立编辑。字号、位置、宽度与当前文档约束保持一致。
- [ ] **T04.5** 分开执行 `pnpm exec playwright test tests/e2e/ui-controls.spec.ts`、`pnpm exec playwright test tests/e2e/editor-settings.spec.ts`，另跑 `pnpm exec vitest run packages/ui/src/number-draft.test.ts`。预期一次长按只产生一个撤销项，取消后停止变化，数值边界可达。
- [ ] **T04.6** 提交 `feat(editor): migrate numeric controls with undo transactions`。

### T05 迁移选择器、字体和颜色

**Files:** 修改 `packages/ui/src/{Select,Combobox}.tsx` 及其样式。修改 `packages/poster-editor/src/fonts/FontPicker.tsx`、`panels/TextPanel.tsx`、`panels/StylePanel.tsx`、`packages/poster-editor/package.json` 和锁文件。测试 `tests/e2e/helpers.ts`、`tests/e2e/{editor-fonts,editor-mobile,ui-controls,ui-baseline}.spec.ts`。

**Interfaces:** 保留 `Select<T extends string | number>(props: SelectProps<T>)`、`Combobox(props: ComboboxProps)`。保持 `onValueChange`、选择值/高亮值分离以及可访问名称。使用任务 3 的弹层注册接口。

- [ ] **T05.1** 在现有字体菜单用例中加入层级断言。按第一次 Escape 后 `await expect(listbox).toHaveCount(0)` 且 `await expect(sheet).toBeVisible()`，字体选区仍为原范围。关闭抽屉后焦点回到“文字设置”触发器。保留禁用 Inter、异步结果过期、字重及真实导出字体用例。
- [ ] **T05.2** 用 antd `Select` 实现普通选择和可搜索分组选择。保留数字值、空选项、禁用原因、项宽度与 `onHighlightChange`。从公开 `onOpenChange` 管理注册，从该版本公开高亮回调更新预览。弹层 Portal 选最近的有效容器，未嵌套时回到根容器。
- [ ] **T05.3** 更新 `helpers.ts` 和截图用例中依赖旧 Select DOM 的定位。保留按 role/name 操作、菜单关闭、值写回、长文字不溢出和手机选项至少 44px 的断言。弹层内高亮按键可预览，按 Enter 才发生选择提交。
- [ ] **T05.4** `FontPicker` 继续调用现有候选加载、`prepare-change`、`useFontChoice`。验证高亮不改文档。模拟选择后切到其他块或作品，再释放被延迟的校验响应，确认原结果不会写入新选区或弹出旧错误。保留禁用 Inter 的前置校验。
- [ ] **T05.5** 用 `ColorPicker` 作为属性编辑入口，按原字段的六位/八位 hex 和透明哨兵写回，保留预设和撤销粒度。测试一个非不透明色和清除效果后的 `#00000000`。仅在编辑包直接导入 antd 时用 `pnpm --filter @fastposter/poster-editor add --save-exact antd@6.7.0`。
- [ ] **T05.6** 执行 `fp_antd_e2e T05 tests/e2e/editor-fonts.spec.ts tests/e2e/editor-mobile.spec.ts tests/e2e/ui-controls.spec.ts` 与 `pnpm exec vitest run packages/poster-editor/src/fonts`。预期支持键盘选择、44px 手机选项、颜色作用于当前范围及字体重载后仍按实际版本导出。更新截图时保留 T01 的采集入口和用例依赖。
- [ ] **T05.7** 提交 `feat(editor): migrate font and color pickers`。

### T06 迁移基础控件和账号页

**Files:** 修改 `packages/ui/src/{Button,Input,Form,Status,Tooltip,ToggleButton}.tsx`、相应样式和 `form-contract.test.ts`、`styling-hook.test.ts`、`toggle-tooltip.test.ts`。修改 `apps/web/src/features/auth/{AuthPage,PasswordPage}.tsx`、`apps/admin/src/main.tsx` 中的登录表单及对应样式。

**Interfaces:** `ButtonProps.type` 仍为 HTML 按钮类型，内部映射 `htmlType`。保留 `busy`、`density`、`variant`、`TextInput`/`Textarea` 的 native ref 语义与标签/错误关联、`ToggleButton` 的 `aria-pressed`。

- [ ] **T06.1** 保留单测和浏览器契约。普通按钮断言 `expect(button.getAttribute('type')).toBe('button')`，主表单提交为 `submit`，字段错误可由 `aria-describedby` 访问，禁用图标按钮有名称。
- [ ] **T06.2** 接入 antd `Button`、`Input`/`Input.TextArea`、`Form.Item`、`Alert`/`Spin` 与 `Tooltip`。按各调用者现有约束保留原生 required、autocomplete、默认提交和 ref。表单状态由现有受控值或 antd Form 单方持有。Toggle 使用按钮语义并保留状态。
- [ ] **T06.3** 对存在 `ref` 的调用核对所需 DOM 能力，用组件公开 ref 提供原焦点与定位能力。图标按钮与 tooltip 保留 accessible name。更新旧颜色或边框断言时用已确认的 token，并保留焦点与 disabled 行为断言。
- [ ] **T06.4** 用户登录、注册、密码重置和管理员登录应用主题。按 UI-03 验证未登录深链接、强制改密、带查询参数重置、非管理员提示及会话过期后返回的地址。不同账号用原隔离逻辑更新缓存和通知。
- [ ] **T06.5** 执行 `pnpm exec vitest run packages/ui`、`pnpm typecheck` 与 `fp_antd_e2e T06 tests/e2e/ui-controls.spec.ts tests/e2e/session-sync.spec.ts tests/e2e/full-flow.spec.ts`。预期回归通过。
- [ ] **T06.6** 提交 `feat(ui): migrate shared controls and account forms`。

### T07 重做后台导航与记录页面

**Files:** 修改 `apps/admin/src/main.tsx`、`AdminLayout.tsx`、`features/Metadata.tsx`、`features/projects/ProjectDeletionQueue.tsx`、`styles.css`、`apps/admin/package.json` 和锁文件。创建 `apps/admin/src/features/ExportJobs.tsx`、`tests/e2e/admin-layout.spec.ts`。

**Interfaces:** `AdminLayout` 保留 `user`、`path`、`logout` 与 `children`。`JobsPage(): ReactElement` 移到 `ExportJobs.tsx`。导出任务表和手机摘要共用 `JobDTO`，行键为 `id`。任务详情仅消费已有元数据。

- [ ] **T07.1** `admin job failure opens the same details on desktop and phone` 使用测试栈登录管理员，在 API 响应边界构造一个有错误描述的 `JobDTO`。断言桌面表格和 390px 摘要行都能打开同一 ID，错误文本匹配，详情没有私有内容。补空、加载、失败各一条可区分的状态断言。
- [ ] **T07.2** 执行 `pnpm --filter @fastposter/admin add --save-exact antd@6.7.0`。接入分组 `Menu` 和手机 `Drawer`。分组顺序为账号与作品、内容资源、运行记录。使用 UI-03 的已有路由，当前路由高亮，手机关闭恢复焦点。
- [ ] **T07.3** 桌面用户、作品元数据、任务和审计使用 `Table`，采用稳定 `rowKey`、现有服务端分页参数和独立 `Pagination`。记录表每页 24 条，保持独立加载与错误。分页缩减继续使用 `pageAfterShrink` 并核对最后一页删除后回退的断言。后台永久删除与清理队列保留原权限和确认流程。
- [ ] **T07.4** 将 `JobsPage` 放到 `ExportJobs.tsx` 并更新路由惰性导入。复用现有每 5 秒轮询、`JobDTO`、任务版本和时间。用状态文字与 `Tag` 表达状态，窄屏使用同一查询的摘要行。失败详情由当前行打开，显示真实错误与元数据，关闭返回该行操作。
- [ ] **T07.5** 执行 `fp_antd_e2e T07 tests/e2e/admin-layout.spec.ts tests/e2e/project-permanent-deletion.spec.ts` 与 `pnpm --filter @fastposter/admin test`。预期后台操作和持久删除回归通过，手机摘要与桌面详情返回同一任务 ID。
- [ ] **T07.6** 提交 `feat(admin): add grouped navigation and responsive record views`。

### T08 迁移后台素材及模板入口

**Files:** 修改 `apps/admin/src/features/Resources.tsx`、`FontPreview.tsx`、`features/copy/{CategoryTree,CopyForm,CopyList,CopyPage}.tsx`、`features/templates/{TemplateList,TemplateEditor}.tsx` 和后台样式。测试 `tests/e2e/{admin-catalog,copy,templates}.spec.ts`。

**Interfaces:** 素材 DTO、分类树、模板和上传 API 沿用现有字段。`TemplateEditor` 继续挂载共享 `Editor` 并保留现有保存和发布动作。

- [ ] **T08.1** 复用发布/下架保留已有作品、五级分类和模板独立包的回归。补 `closing template editor returns to the filtered list`，断言关闭后当前分类和搜索仍为打开时的值，焦点回到打开该模板的操作。
- [ ] **T08.2** 迁移背景和字体表单与预览网格，保留授权、版本、字重和发布状态。`Upload` 复用 `apiClient.upload` 的 FormData、请求和错误处理，明确选取、取消、提交三个阶段，以测试确认一次选择只触发约定的上传。
- [ ] **T08.3** 迁移文案树、筛选、列表和编辑表单。保留五级、父分类可选、发布状态及分类顺序，保持现有 API 约束。加载、无结果和失败在当前容器内分别呈现。
- [ ] **T08.4** 模板工作区通过共享弹层机制注册全屏容器。保留名称、分类、排序、保存与发布。关闭回到原筛选、页码和可用触发入口。打开工作区后才加载 Editor。验证模态内字体和背景选择可到达，模板只加载实际需要的字体。
- [ ] **T08.5** 执行 `fp_antd_e2e T08 tests/e2e/admin-catalog.spec.ts tests/e2e/copy.spec.ts tests/e2e/templates.spec.ts`。预期上传、下架、预览、分类与打开关闭均通过。
- [ ] **T08.6** 提交 `feat(admin): migrate resources and template workspace entry`。

### T09 重做作品集和素材选择

**Files:** 修改 `apps/web/src/main.tsx`、`features/projects/{ProjectsPage,ProjectList,ProjectDeletionQueue}.tsx`、`features/templates/TemplatePicker.tsx`、`features/catalog/{BackgroundPicker,CopyPicker}.tsx`、`styles.css`、`apps/web/package.json` 和锁文件。创建 `features/projects/collection-position.ts`。测试 `tests/e2e/{projects,image-upload,project-permanent-deletion,templates,copy}.spec.ts`。

**Interfaces:** `CollectionPosition` 保存 `{ userId: string; trash: boolean; search: string; keyword: string; page: number; deletionPage: number; scrollTop: number }`。`ProjectsPage` 接收会话内的 `RefObject<CollectionPosition | null>`。恢复时按当前用户键校验。保持 `ProjectAction` 及现有素材回调。

- [ ] **T09.1** 增加 `return to filtered gallery restores page and scroll for the same account`。从带搜索的后续页进入再返回，断言搜索值、页码和可见作品一致，滚动恢复误差 ≤8px。换账号后搜索为空，页码回到 1。可用 `page.route` 控制分页响应，保持真实路由和登录。
- [ ] **T09.2** 执行 `pnpm --filter @fastposter/web add --save-exact antd@6.7.0`。作品集改为顶部导航和 4/3/2 列图库，断点为 ≥881px、681–880px、≤680px。使用完整比例的现有缩略图。主要动作“新建海报”，并列“模板库”。用 `Dropdown`、`Input`、`Empty`、`Pagination` 承接当前列表行为。
- [ ] **T09.3** 在 App 会话内保存 `CollectionPosition`。从编辑器返回时将输入值和已提交关键词一起初始化，查询使用恢复页码。仅当用户修改筛选时启动重置页码的防抖。等待有效结果后恢复滚动。退出、会话过期和换账号清空，服务端结果证明末页超界时回退。
- [ ] **T09.4** 保留拖入/选择文件、创建、软删除和恢复。回收站两组结果用各自的分页与请求键。保留彻底删除确认、重试动作、跨标签草稿阻断和按任务 ID 更新。分别验证删除后两组页码回退以及同账号状态恢复。
- [ ] **T09.5** 模板、背景、文案选择适配共享弹层和输入。模板从现有素材或 ZIP 新建，背景保留尺寸确认，文案保留五级选择与替换。处理加载、空、失败和取消，并用同一条件采集作品集和弹层截图。
- [ ] **T09.6** 执行 `fp_antd_e2e T09 tests/e2e/projects.spec.ts tests/e2e/image-upload.spec.ts tests/e2e/project-permanent-deletion.spec.ts tests/e2e/templates.spec.ts tests/e2e/copy.spec.ts` 与 `pnpm --filter @fastposter/web test`，预期作品操作、账户隔离、分页、上传和素材选择通过。
- [ ] **T09.7** 提交 `feat(web): rebuild the poster gallery and library flows`。

### T10 实施共享工作台和导出交互

**Files:** 创建 `packages/poster-editor/src/panels/EditorInspector.tsx`。修改 `packages/poster-editor/src/{Editor,Stage}.tsx`、`panels/{TextPanel,ParagraphPanel,StylePanel}.tsx`、`styles.css`、`apps/web/src/features/projects/ProjectWorkspace.tsx`、`apps/web/src/features/editor/{SaveStatus,ConflictDialog}.tsx`、`features/export/ExportDialog.tsx`、`apps/admin/src/features/templates/TemplateEditor.tsx`。测试 `tests/e2e/{editor-mobile,editor-geometry,editor-richtext,editor-settings,autosave,export,templates}.spec.ts`。

**Interfaces:** `InspectorGroup = 'text' | 'paragraph' | 'effects' | 'position'`。在 `TextPanel.tsx` 导出原有 `TextPanelProps`。`EditorInspector` 接收 `{ group: InspectorGroup; onGroupChange: (group: InspectorGroup) => void; textPanel: TextPanelProps | null; position: ReactNode; onAddText: () => void }`，沿用现有面板的文档、字体和事务回调。`EditorProps` 保留现有接口。导出任务继续由当前 `ExportControls` 会话持有。

- [ ] **T10.1** 加入 `resize keeps the active selection and raw field draft`。选中既有样例中的“风景”，从 1440px 输入字号草稿 `12.` 后切到 390px，打开同一属性组，断言显示仍为 `12.`。继续输入形成合法值，断言作用于原选区，其余文字保持原值。断点切换本身不产生写入或撤销项。
- [ ] **T10.2** 加入 `mobile text panel adds a second text block`。从已选中文字的手机面板添加，断言新块选中、原块内容不变、图层数加一。用无选区入口另验证仍可添加。保留旧手机底部面板、图层操作和画布几何覆盖。
- [ ] **T10.3** 在 `export.spec.ts` 的排队用例中冻结第一次状态轮询，记录实际创建请求和任务 ID，关闭弹窗后编辑新稿。用“查看导出”重开时断言只发过一个创建请求且 ID 不变。完成后导出第二次时断言请求 revision 与最新已保存版本一致。增加最新稿件溢出时旧任务仍可查看的断言。
- [ ] **T10.4** 将文字、段落、效果、位置拆到受控 `EditorInspector`。保持 Editor、Stage、Tiptap、当前选区和编辑事务在同一会话中。若换容器会重挂载或失焦整理字符串，先在属性所有者捕获未完成的原始值，按会话、块和字段恢复。真用户提交或离开字段仍按原输入契约处理。切换作品、账号、删除或完成该输入会话后清理对应临时草稿。
- [ ] **T10.5** 按 UI-06 四档实现桌面和手机布局。保留独立收起、平板单侧展开、底部四入口与“添加文字”。支持触摸、安全区和 `visualViewport`，保持上方可见的当前文字及面板内滚动。保持复制、前移、后移、删除、几何、缩放及鼠标/触摸选区行为。
- [ ] **T10.6** 用户工作区按 UI-09 用真实 `SaveStatus` 呈现保存与冲突，保留恢复和另存。“查看导出”回到原任务，当前稿件溢出和保存错误只阻止新任务。继续从 `flush()` 取 revision，队列及结果来自真实任务，下载和预览来自同一 PNG。后台模板顶栏保留保存/发布和字段处理。
- [ ] **T10.7** 执行 `fp_antd_e2e T10 tests/e2e/editor-mobile.spec.ts tests/e2e/editor-geometry.spec.ts tests/e2e/editor-richtext.spec.ts tests/e2e/editor-settings.spec.ts tests/e2e/autosave.spec.ts tests/e2e/export.spec.ts tests/e2e/templates.spec.ts` 与 `pnpm exec vitest run packages/poster-editor`。核验 1440/1024/768/390/320px、图层、缩放、几何、富文本、自动保存、撤销及实际导出。
- [ ] **T10.8** 提交 `feat(editor): redesign desktop and mobile workspace`。

### T11 收尾、清理和完整验收

**Files:** 检查 `packages/ui/package.json`、`src/index.ts`、旧 `*.module.css`、两站样式和 `pnpm-lock.yaml`，删除确认无引用的旧实现。补齐 `docs/verification/2026-11-05-antd-migration.md`。

**Interfaces:** 已迁移的公开控件接口沿用任务 2–10 的验收。生产入口使用构建输出中的正常资产。方案截图可与实际页面同视口对比。

- [ ] **T11.1** 扫描 `rg -n '@base-ui/react' apps packages`，确认源码引用都已迁移后用 `pnpm --filter @fastposter/ui remove @base-ui/react`。重新检查源码、依赖树和锁文件。清理确实无引用的样式和库专用 DOM 断言，保留稳定的业务及可访问性标记。
- [ ] **T11.2** 执行 `pnpm install --frozen-lockfile`、`pnpm verify`、`pnpm exec turbo run build --force`。按 T02 复验静态入口，分别记录入口与总 gzip 体积变化。核对 `git diff` 中生成契约、schema 和导出运行时的范围。契约生成器或环境不可用时记录具体命令、原因和补验条件。
- [ ] **T11.3** 运行 `pnpm exec playwright test --list`，对照 T01 记录和新增用例列出完整验收清单。每个 spec 使用独立临时栈，输出目录按执行批次保留。截图文件需在同一进程内启用两项用例，导出文件在同一环境采集 after 样本。以下命令按顺序运行并检查每条退出码。

  ```bash
  fp_run_dir="$PWD/.cache/fastposter-antd-migration"
  mkdir -p "$fp_run_dir/after"
  while IFS= read -r fp_spec; do
    case "$fp_spec" in
      tests/e2e/ui-baseline.spec.ts|tests/e2e/export.spec.ts) continue ;;
    esac
    fp_antd_e2e T11 "$fp_spec" || exit 1
  done < <(rg --files tests/e2e -g '*.spec.ts' | sort)
  FP_UI_BASELINE=1 FP_UI_BASELINE_OUT="$fp_run_dir/after" \
    fp_antd_e2e T11 tests/e2e/ui-baseline.spec.ts
  FP_EXPORT_BASELINE_PATH="$fp_run_dir/after/export.png" \
    fp_antd_e2e T11 tests/e2e/export.spec.ts
  magick compare -metric AE "$fp_run_dir/before/export.png" "$fp_run_dir/after/export.png" null:
  ```

- [ ] **T11.4** 检查 PNG 对照尺寸和像素。相同机器、Chrome 和字体资产下，`magick compare` 预期差异像素为 0。确认前后都是通过真实预览和下载一致性测试的样本。任一文件失败后记下剩余未运行项目，修复或记录阻塞后跑完清单。Go 测试按实际改动范围单列。
- [ ] **T11.5** 核验 UI-13 矩阵。对照截图检查各宽度的加载、空、错误、焦点、抽屉滚动、画布和内容比例。真机输入法与 Chrome 模拟分开记录。汇总实际命令、退出码、通过/失败/跳过、截图、PNG SHA-256、入口包体与已知限制。
- [ ] **T11.6** 对 T01–T10 逐项确认结果、提交和需求覆盖。检查退出时无迁移过程专用入口或调试代码。报告通过、失败和待补验项，按用户要求处理后续集成。
- [ ] **T11.7** 提交 `chore(ui): remove legacy controls and record migration verification`。
