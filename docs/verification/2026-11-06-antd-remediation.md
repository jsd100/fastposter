# Ant Design 迁移后修正 — A/B 批共用执行记录

创建于 A01 阶段（实际补建于 A02 开工前，见「遗留与裁定」）。权威需求：

- 规范：`docs/superpowers/specs/2026-11-06-antd-post-migration-remediation-design.md`（FP-00 … FP-14）
- A 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-a-implementation.md`
- B 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-b-implementation.md`
- 原始布局规范：`docs/superpowers/specs/2026-11-05-antd-layout-design.md`（UI-06、UI-08、UI-09）

> 上述规范、计划、原布局规范在分析时仍是**未跟踪文件**。A10 必须把它们纳入同一次文档提交，否则新检出无法解析本记录的引用。逐任务的流水与评审包另见执行账本 `.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/`（git 忽略，仅本机证据）。

## 当前状态

```yaml
batch: A
status: IN_PROGRESS
authorization: "2026-11-06 用户：深度分析后继续该任务；并转述前序建议『先执行 A 批，逐任务独立评审』"
execution_mode: subagent-driven-development (fresh implementer + task reviewer per task)
workspace: "/Users/aaa/acode/FastPoster" (in-place, no linked worktree)
branch: feat/fastposter
review_baseline: "124b4ea5d2dc7b1b58183749a393a3c4759fe47b"
execution_baseline: "71257c3"
last_verified_commit: "846e183"
task: A06
next_step: A06.1 (awaiting the user's go-ahead; A05 completed 2026-11-08)
spec_ids: [FP-06]
actual_paths: ["apps/web/src/features/projects/project-creation.ts", "apps/web/src/features/projects/project-creation.test.ts", "apps/web/src/features/projects/ProjectsPage.tsx", "apps/web/src/features/templates/TemplatePicker.tsx", "tests/e2e/image-upload.spec.ts", "tests/e2e/templates.spec.ts", "tests/e2e/session-sync.spec.ts"]
red: ["A05 E2E RED: 基线重试按钮为「重试导入」（重新上传）而非创建级「重试」", "A05 E2E RED: 基线无「结果未确认」通知（Expected 1 / Received 0）", "A05 E2E RED: 基线迟到 Create 回应跨账号导航到 /projects/e2e-stale-project/edit", "A05 单元 RED: 长中文 130 码点 / 控制字符未剥离 / 空标题未回退", "A05 单元诚实通过: 原始尺寸与素材引用基线本就正确"]
green: ["202/202 单测（31 文件）", "pnpm typecheck exit 0", "project-creation.test.ts 4/4", "3 个 A05 验收 E2E 各 1 passed", "控制器独立复跑 8 个 E2E（3 验收 + 5 回归）全部 exit 0"]
decisions: ["Ruling 9 移除 matchMedia 运行时订阅", "Ruling 17-21 A02 修复轮裁定", "Ruling 23 PNG 导出 SKIP", "Ruling 24-30 A03 修复轮裁定", "Ruling 31 429 中断后按原节奏续跑 A04", "Ruling 34-42 A04 修复轮裁定", "Ruling 44 「继续」仅授权 A05", "Ruling 45-53 A05 边界/失败分类/诚实标准裁定", "Ruling 54-55 A05 DONE_WITH_CONCERNS 处置", "Ruling 56-60 A05 评审 ⚠️ 逐项裁定与 Minor 延迟"]
artifacts: [".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A05-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A05-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-2f06ad4..846e183.diff"]
blockers: []
open_verification_items: ["Chrome 157 vs 锁定 156：export.spec.ts 2 个 + editor-fonts.spec.ts 2 个 PNG 导出用例标 SKIP，A10 须在匹配环境重跑；A03 不因此标为完全 VERIFIED", "A05 新增环境 SKIP：templates.spec.ts 的 administrator publishes a template… 在 line 350 导出步骤同样失败；实现者用 git apply -R 回退产品补丁对照，基线在完全相同行失败，证明先于 A05；A10 须在 Chrome 156 重跑", "A04 三张视觉证据 PNG 位于 /tmp/fp-a04-evidence/，A10 须落到受控路径或在执行记录中留可追踪引用", "A04 未新增真实具名「更多」DOM 入口（清单外文件限制），按 FP-14 写回规格建议，A10/后续任务评估", "FP-13 背景库创建的「结果未确认」覆盖属 A06：A06 派发时必须消费 A05 导出的 buildProjectFromBackground / classifyCreationFailure / useCreationScope 并补背景库未知结果 E2E（Ruling 56）", "FP-13 「注入上传失败」由既有 notifications.spec.ts 回归用例覆盖并重跑通过，无 A05 新增最小失败用例（Ruling 57），A10 矩阵复核", "A05 评审 5 项 Minor + A01-A04 累计 40 项 Minor 均推迟全分支评审（Ruling 60）"]
```

B 批状态：`NOT_AUTHORIZED`（FP-11 涉及 IDL、生成代码与服务端事务，需用户单独授权；A 批不处理）。

## 环境记录（A 批开工时实测）

| 项 | 实测值 |
| --- | --- |
| Node / pnpm | v22.22.2 / 11.25.0（AGENTS.md、README 声明 Node 24；基线类型检查与单测在此环境通过） |
| Go / ImageMagick / Python | go1.27.2 / 7.1.2-34 / 3.13.12 |
| Chrome | macOS 默认路径存在（`CHROME_PATH` 在 `.env.local`） |
| renderer | `apps/renderer/dist/index.html` 已构建；每任务开工前按计划重跑 `pnpm --filter @fastposter/renderer build` |
| MySQL | `.env.local` 未配置 `FASTPOSTER_TEST_MYSQL_DSN` → Go 集成测试预期 SKIP；E2E 使用仓库保护器与 `fastposter_test_*` 临时库 |
| 基线验证 | `pnpm typecheck` exit 0；`pnpm test` 30 文件 / 186 用例 exit 0 |
| 工作区 | 普通 checkout（GIT_DIR == GIT_COMMON），非 linked worktree；23 个未跟踪文档为用户资产，全程不修改、不暂存、不提交 |

## A 批 · 任务分区

### A01 让缩减动效下的浮层和键盘恢复可用 — DONE

- 提交：`2b6a635 fix(ui): preserve overlay behavior with reduced motion`、`71257c3 fix(ui): cover admin workbench focus and stabilize reduced motion`
- 需求：FP-04、FP-13（FP-04 行）、FP-14
- 根因：共享 CSS 的 `@media (prefers-reduced-motion: reduce)` 使用全局 `animation: none !important` / `transition: none !important`，冻结 rc-motion 的进入首帧，浮层停在 `0×0` 且无法关闭。改为按 `matchMedia` 在 provider 初始化时读取一次偏好，交给 antd 公开 `motion` seed；应用自身非必要动效限定到自有组件。
- 焦点：模板工作台改为 portal + `#root.inert` + Tab 循环，保留编辑快捷键与显式关闭；`AdminLayout` 手机 Drawer 改为挂到 `#root` 内，使其同样被隔离；手机背景库关闭后经 `restoreFocusTo?` 把焦点还给底栏「背景」。
- 独立评审（任务级门禁）：Spec ❌ 4 项 + 1 个 Important（plan-mandated）+ 11 Minor，Task quality Approved。修复轮 1/5 全部 ADDRESSED，复评审无新增 Critical/Important 破坏。
- 关键裁定 Ruling 9：移除运行时 `matchMedia` change 订阅。运行时翻转 `token.motion` 会让 antd 6 `MotionWrapper` 改变元素结构、重挂载 ConfigProvider 子树并丢失未保存草稿；FP-04 的验收是两种模式下浮层可用，而自动保存/草稿契约优先。代价：会话中切换系统动效偏好需刷新。
- 修复轮额外发现并修复的真实缺陷：后台手机导航 Drawer 默认 portal 到 body，逃逸 `#root.inert`，全屏工作台打开时仍可被键盘聚焦（新增用例真实 RED → GREEN）。
- 验证（控制器独立复跑，本会话）：
  - `pnpm typecheck` → exit 0
  - `pnpm test` → 30 文件 / 186 用例 exit 0
  - `pnpm test:e2e tests/e2e/ui-controls.spec.ts -g 'reduced motion leaves overlays usable'` → 1 passed, exit 0
  - 实现者另跑 4 个 spec 共 32 个 E2E 全通过（逐文件独立临时栈），无 429 / 环境阻塞
- 遗留：11 项 Minor 推迟到全分支评审；A01.1 要求的本执行记录在 A01 阶段未建立（见「遗留与裁定」）。

### A02 恢复手机撤销并让属性面板下的选区可见 — DONE

- 提交：`57ecf6d fix(editor): restore phone history and selection visibility`、`8bda815 fix(editor): prove phone selection visibility and stabilize viewport measurement`
- 需求：FP-07、FP-13（FP-07 行）；依赖 A01 的浮层与焦点机制。
- 计划接口：`geometry.ts` 新增 `Rect = Point & Size` 与纯函数 `fitSelectionIntoViewport(view, bounds, viewport)`（文档坐标投影到 Stage 局部像素、平移优先、必要时缩放、过高块保留前缘、幂等）；Stage 接收纯视图输入 `visibleViewport?: Rect`；手机工具条复用 `store.undo/redo` 与 `state.canUndo/canRedo`。
- 实现要点：`Editor.tsx` 新增单一 `operations` 可用性模型，桌面工具栏、手机工具条、选区动作、桌面/手机 `EditorInspector` 共用回调与禁用原因（字体就绪、100 块上限、选区、文案忙碌、历史状态）；手机底栏新增具名「撤销」「重做」，两轴命中区 ≥44px；抽屉打开时的可见带取 stage、抽屉顶边、`visualViewport` 的交集，视图调整只经 `store.setView`（纯视图，不写文档/历史），关闭时恢复打开前的手动视图。
- 独立评审（任务级门禁）：Spec ❌ 3 项、2 Important（含 1 plan-mandated）、0 Critical、11 Minor，Task quality Needs fixes。核心质疑是测试夹具在红灯基线没有把选区推到抽屉后面，使「可见交集 + 属性值变化」验收断言退化为恒真，真正红灯只证明「视图被调整」这一机制动作。
- 修复轮（Ruling 17–21）：重写夹具让选区确实落在抽屉之后；在**真实基线产品代码**上（临时 `git apply -R`，HEAD/索引未变）观察到真实产品红灯 `Received: -351.33`（选区与缩小可见带交集为负，消息 `the lower selection must stay visible above the open drawer`）；把属性变化锚定到修复后才可见的选区；补切换文字块断言；`measure()` 加宽高守卫、无效帧保留上一有效 band、panel 缺失不静默退化、用有上限的连续 rAF + `transitionend`/`animationend` 取代固定 300ms 定时器。复评审：5 条发现全部 ADDRESSED，无新增 Critical/Important 破坏。
- 验证（控制器独立复跑，本会话）：
  - `pnpm typecheck` → exit 0
  - `pnpm test` → 30 文件 / 191 用例 exit 0（基线 186 + 本任务 5 个 geometry 用例）
  - `pnpm test:e2e tests/e2e/editor-mobile.spec.ts -g 'phone can undo|phone inspector keeps|add text capacity'` → 3 passed, exit 0
  - `pnpm test:e2e tests/e2e/templates.spec.ts -g 'workbench contains tab focus and keeps editor shortcuts'` → 1 passed, exit 0
  - `pnpm test:e2e tests/e2e/editor-mobile.spec.ts -g 'mobile background picker returns focus'` → 1 passed, exit 0（A01 回归）
  - `pnpm exec vitest run packages/poster-editor/src/geometry.test.ts` → 11/11；`editor-geometry.spec.ts` → 1 passed（实现者侧）
  - E2E 统一带 `GOPROXY=off GOSUMDB=off`：实现者修复了 `/tmp` 下遗留的不完整 Go 模块缓存（代理 502），未改仓库文件
- 遗留：11 项 Minor 推迟到全分支评审；reduced-motion + 键盘 + 安全区组合交 A10 五档矩阵；`onMotionEnd` 祖先过滤为 Minor 观察，rAF/resize/ResizeObserver 兜底。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A02-report.md`（含 §11 fix report）、`review-7d783e1..57ecf6d.diff`、`review-57ecf6d..8bda815.diff`。

### A03 统一编辑手势和数值草稿 — DONE（含未完成验收项）

- 提交：`8bf42b0 fix(editor): scope gestures and drafts to the edit session`、`83f5408 fix(editor): scope draft tidy and prove color gesture cleanup`
- 需求：FP-08、FP-13（FP-08 行）。
- 实现要点：`history.ts` 给事务加 token 与 `matches()`；`store.ts` 新增 `TransactionHandle { session, target, id, owner }`、`acquire()`、`finish(handle, "commit" | "cancel")`（只结束仍匹配的事务）、`activeTransaction()`、`invalidateSession()` 与会话级 `NumberDraftSession`。`ColorField` 首次有效变更才开事务、未改打开/关闭无写入且不阻塞导出；`RichTextEditor` 的 650ms timer 与 blur 只结束自身事务、外部样式更新仍写真实选区与内容、IME 边界复刻基线。`NumberDraftBinding` 升级为 `NumberDraftSnapshot = { raw, baseline, lastValid }`，由会话按「作品/模板、块、属性、目标」作用域持有并关联事务身份；按钮与快捷键删除共用 `deleteSelected()`，先结束手势再清该块草稿。`useProjectAutosave.ts` / `autosave.ts` 未改（`inTransaction` 布尔语义足够，A03 计划允许仅在传递不足时改动）。
- 独立评审：Spec ❌ 4 项、3 Important（1 plan-mandated）、0 Critical、11 Minor，Needs fixes。修复轮按 Ruling 24–26 处理三项：`tidy(scope)` 改为按作用域把悬挂 raw 折叠回 `lastValid` 并保留其他块/目标；`NumberField` Escape 判据改为「是否有草稿绑定」，position 这类混合调用者改走 `history.rollbackTo(depth)` 事务回滚（保持每次写入立即提交以满足 autosave 的「已保存」时序），不新增历史、文档与显示串都回 baseline；`color gesture owns range changes until close` 补上「选区两次改色 → 关前零写入 → 换目标/删除 → 撤销删除保留最后有效色」链路。复评审 5 条发现全部 ADDRESSED，无新增 Critical/Important 破坏。
- 验证（控制器独立复跑）：`pnpm typecheck` exit 0；`pnpm test` 30 文件 / **198 用例** exit 0；`editor-settings` 3 个新增用例 3 passed；`editor-richtext -g 'color gesture owns range changes until close'` 1 passed；`export -g 'unmodified picker does not block export'` 1 passed；`autosave.spec.ts` 4 passed；`editor-mobile` A02 回归 3 passed。实现者另跑 `editor-settings` 8 passed、`editor-richtext` 5 passed、`editor-fonts` 10 passed / 2 SKIP、`export` 1 passed / 2 SKIP。
- **未完成验收项（SKIP，环境不匹配）**：本机 Chrome `157.0.8103.38`，`deploy/toolchain.lock.json` 锁定 `156.0.8078.48`。`export.spec.ts` 的 `flushes latest edits and previews the exact native PNG available for download`、`closing the export dialog mid-flight reopens the same job and unlocks the page`，以及 `editor-fonts.spec.ts` 的 `a new Chinese family renders, saves, reloads and exports at the same version`、`new bundled Chinese families load and the final choice saves, reloads and exports` 共 4 个 PNG 导出用例稳定失败（「文字渲染失败」/「文字超出画布」）。实现者用 `git stash` 做纯 HEAD 基线对照，基线同样失败；`apps/renderer/dist` 为未变的 gitignored 静态产物、`server/` 与导出 worker 未改、`apps/renderer/src/main.tsx` 不导入 A03 模块。按 FP-13 标 SKIP 并记录影响：**已保存 revision 的端到端 PNG 导出证据在本机不完整，A10 必须在匹配 Chrome 156 的环境重跑并重建 `apps/renderer/dist`**。A03 因此**不标记为完全 VERIFIED**。
- 遗留：11 项 Minor 推迟到全分支评审；两处非阻塞理论边界（`rollbackTo` 清 `future` 的窄 redo 场景、折叠记录保留旧 `sessionDepth`）；Ruling 28/29 已裁定的断言覆盖说明。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A03-report.md`（780 行，含 §12 fix report）、`review-438dfe0..8bf42b0.diff`、`review-8bf42b0..83f5408.diff`。

### A04 收敛主题、Select 和属性面板的视觉规则 — DONE

- 提交：`95b8447 fix(ui): align shared controls and inspector typography`、`ffc9039 fix(ui): prove control alignment and scope visual assertions`
- 需求：FP-01、FP-03、FP-13（FP-01 / FP-03 行）；前置 A01，五档截图人工核对在 A10.1。
- 实现要点：`theme.ts` 的 `components.Button` 增加 `defaultShadow` / `primaryShadow` / `dangerShadow = "none"`，保留描边、禁用、忙碌、按下与 focus-visible 反馈；`Select.tsx` / `Combobox.tsx` 经 antd 6.7.0 公开语义槽 `classNames.content` 引入共享 `.content`，去掉 `.ant-select-content { height:100% }`（该节点为 `display:block`，`align-items:center` 无效导致文字偏上 ~7.1px），改 `align-self:center`。`ColorField` 色样改两层（`.swatch` 棋盘底 + `.swatchColor` 前景承接 inline `backgroundColor`），六位 hex 完整实色、八位 hex 按 alpha 混合；A03 的 `ColorField.tsx` 手势/事务逻辑逐字未动。属性区收敛为标签 13px / 常规值 14px / 说明单位状态 12px，新增 `--fp-text:#202C25` / `--fp-text-secondary:#526159`，字段 gap 6px、去掉 `.panel-field` 自身 margin 避免与 grid gap 叠加，四组「文字/段落/效果/位置」保留。320px 顶栏以纯 CSS 控制溢出，修复轮去掉过宽 `!important` 与硬编码中文 `aria-label` 字面量、补 44×44 命中区与 CSS-only tooltip。
- 独立评审：Spec ❌、5 Important（4 plan-mandated）、0 Critical、7 Minor，Needs fixes。核心质疑是验收断言不达标：A04.1 逐字 8 项覆盖缺「空值/禁用」独立断言；阴影用单次 `getComputedStyle` 快照导致 RED 是 `0.0237px` 过渡中间帧且 `dangerShadow` 无实例验证；「样式不作用到海报文档节点」与「Tab 后可见焦点」断言部分恒真；320px `!important` + `font-size:0` 脆弱。控制器另行核实出第 6 项真实缺陷：`.geometry-fields`（位置组）直接挂在 `.inspector-content` 下、不在 `.panel-field` 内，触控 16px 规则未覆盖，390/320px 实际输入仍是 14px（违反 FP-01 / A04.4）。
- 修复轮（Ruling 34–42）：补空值（后台「编辑素材」未分类）与禁用 Select 的真实 `expectCentered`（真实基线 RED `valueOffset=6`）；阴影改 `toHaveCSS` 稳定读取并在真实基线取得 `rgba(0,0,0,0.02) 0px 2px 0px 0px` 静止 2px 投影，显式断言 `button.button-danger` 及禁用/按下/忙碌/focus-visible 反馈；作用域断言改为读 `[data-text-block]` computed 值比对 A04 规则；焦点断言改为定位具体按钮并校验 `:focus-visible` + 3px outline；320px 去 `!important`、收敛选择器、补 44×44 与 CSS-only tooltip（RED `Received: 20` → GREEN 44）；位置组补 16px 并断言 390/320 两档（RED `Received: "14px"`）。#3 / #4 基线本就正确，如实记为「回归断言，未发现产品缺陷」，未伪造红灯。复评审：6 条发现全部 ADDRESSED，无新增 Critical/Important 破坏。
- 验证（控制器独立复跑，本会话）：`pnpm typecheck` exit 0；`pnpm test` 30 文件 / **198 用例** exit 0；两个新增 E2E（含全部新增断言）2 passed；`ui-controls -g 'reduced motion leaves overlays usable'` 1 passed（A01）；`editor-mobile` A02 回归 3 passed；`editor-richtext -g 'color gesture owns range changes until close'` 1 passed（A03）；`export -g 'unmodified picker does not block export'` 1 passed —— 合计 8 passed，全部 exit 0。实现者另按互斥 `-g` 组分栈完成完整 `ui-controls` 20/20（单栈 19/20 为注册限流，已如实记录）。
- 遗留：7 项 Minor 推迟到全分支评审；FP-01「边框」反馈未单独写 `border-color` 断言（Minor，其余四类反馈已覆盖）；三张视觉证据 PNG 位于 `/tmp/fp-a04-evidence/`，A10 须落到受控路径；真实具名「更多」DOM 入口需清单外 `ProjectWorkspace.tsx`，按 FP-14 写回规格建议；真实 `title` 属性同理，本轮以 CSS-only tooltip + 保留 `aria-label` 替代。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A04-report.md`（442 行，含 §12 fix report）、`review-22ccfe9..95b8447.diff`、`review-95b8447..ffc9039.diff`。

### A05 让创建和上传在失败时可以安全接续 — DONE（含环境 SKIP）

- 提交：`846e183 fix(web): separate upload and project creation recovery`（7 个文件，+632/-23，全部在 A05 文件清单内；显式路径暂存，未触碰 23 个未跟踪用户资产）
- 需求：FP-06、FP-13（FP-06 行）、FP-14；前置 A01。
- 实现要点：新增 `project-creation.ts` 公共入口——`ProjectBackground = Pick<AssetDTO, "id" | "version" | "width" | "height">`、`buildProjectFromBackground(title, asset): CreateProjectInput`（`schemaVersion:1` / canvas 原始宽高 / background 素材引用 / 空 `fonts` 与 `textBlocks`）、`normalizeTitle`（去扩展名、按 `Array.from` 计 120 Unicode 码点、剥离控制字符、空值回退「未命名海报」）、`classifyCreationFailure`（`AUTH_REQUIRED` → auth-required；`INVALID_RESPONSE`/5xx/网络错误/超时 → unknown-outcome；其余 4xx 业务码 → known-rejection）、`useCreationScope`（同步 `claim()` 提交锁 + 当前用户 + 操作 ID + 页面有效期）。`ProjectsPage` 改为选择 → 上传 → 持有素材 → 创建 → 结果五阶段；已知拒绝保留已上传素材，重试只重发 Create；「结果未确认」清空持有素材、只给「重新加载作品列表」只读刷新，禁止自动重提交与编辑器导航；成功/失败分支均先过 `scope.isValid(op)`。`TemplatePicker` 的 apply / ZIP import 接入同一未知结果规则与迟到响应保护，保留 40 MiB 图片与 80 MiB 模板包限制。列表分页、改名、删除、回收站行为未改。
- TDD（Ruling 53，真实基线、产品改动前）：3 个 E2E 产品红灯——基线重试按钮为「重试导入」（证明重新上传）、基线无「结果未确认」通知（`Expected 1 / Received 0`，trace.network 证实 create POST 收到 500）、基线迟到 Create 回应在账号切换后仍导航到 `/projects/e2e-stale-project/edit`；3 个单元红灯（长中文 130 码点 / 控制字符未剥离 / 空标题未回退）+ 1 个基线本就正确而**诚实记录为通过**的原始尺寸用例。脚手架模块解析失败、注册限流、PNG 环境失败均未计作 RED。
- 独立评审（任务级门禁）：Spec ✅（在 A05 授权范围内）、Task quality **Approved**、0 Critical / 0 Important / 5 Minor。评审者自行核实三处具名风险：`instanceof ApiClientError` 经两个包入口解析到同一类（Ruling 48 五类均可到达）、「重新加载作品列表」是 `cache.invalidateQueries` 只读刷新、五个提交入口都汇入同步 `claim()` 锁。4 项 ⚠️ 由控制器按 Rulings 56–59 逐项裁定：背景库未知结果覆盖属于 A06 并已作为 A06 派发的硬性携带项；「注入上传失败」由既有 `notifications.spec.ts` 用例覆盖并重跑通过；Review Focus #5 的两个半场由两个命名用例分别证明；过程证据由控制器独立复核。
- 验证（控制器独立复跑，本会话）：`pnpm typecheck` exit 0；`pnpm test` 31 文件 / **202 用例** exit 0；`project-creation.test.ts` 4/4；3 个 A05 验收 E2E 各 1 passed；`notifications -g 'failed upload creates one toast|account switch clears old notices'` 2 passed；`session-sync -g 'switching accounts does not resurrect|switching accounts in another tab drops'` 2 passed；`templates -g 'workbench contains tab focus and keeps editor shortcuts'`（A01 同文件回归）1 passed —— 合计 8 个 E2E 全部 exit 0，各命令独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output /tmp/fp-a05-ctrl-*`。
- **环境 SKIP（非 A05 回归）**：`templates.spec.ts` 的 `administrator publishes a template, user applies and re-imports an independent package, unpublication preserves the applied work` 在 line 350 的 PNG 导出步骤失败。实现者把产品补丁 `git apply -R` 临时回退到基线（HEAD/索引未变）对照运行，基线在**完全相同行**失败，apply 阶段已通过；属 Chrome `157.0.8103.38` 与锁定 `156.0.8078.48` 的导出差异。A10 须在匹配环境重跑。新增的三个 A05 验收用例与模板 apply/import 的未知结果分支已由 `unknown creation outcome only refreshes list` 独立覆盖并 GREEN。
- 遗留：5 项 Minor 推迟全分支评审（重复派发 `session-expired`、AUTH_REQUIRED 落到即将卸载的选择器错误态、「结果未确认」文案两处重复、瞬态 `creating`/`unknownError` 清理依赖 `scope.isValid`、`classifyCreationFailure`/`useCreationScope` 无直接单测）；A01–A04 的 40 项 Minor 同样保持延迟。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A05-report.md`（155 行）、`task-A05-brief.md`、`review-2f06ad4..846e183.diff`。

### A06 … A10

待执行，且 **A06 尚未获得用户开工指示**（Ruling 44：「继续」仅授权 A05）。A06 派发时必须携带 Ruling 56 的背景库未知结果覆盖要求与 A05 导出的公共接口。A10 负责 `pnpm verify`、逐 spec E2E、五档视觉矩阵、固定导出样本像素对比、三份维护文档，以及上述 PNG 导出用例在匹配 Chrome 156 环境下的重跑。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致，A10.2 未点名，已纳入 A10 验收清单。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明由 A10 补齐。
