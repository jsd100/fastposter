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
last_verified_commit: "83f5408"
task: A04
next_step: A04.1
spec_ids: [FP-01, FP-03]
actual_paths: ["packages/poster-editor/src/Editor.tsx", "packages/poster-editor/src/store.ts", "packages/poster-editor/src/history.ts", "packages/poster-editor/src/text/RichTextEditor.tsx", "packages/poster-editor/src/panels/ColorField.tsx", "packages/poster-editor/src/panels/TextPanel.tsx", "packages/poster-editor/src/panels/StylePanel.tsx", "packages/poster-editor/src/panels/ParagraphPanel.tsx", "packages/ui/src/NumberField.tsx", "packages/poster-editor/src/store.test.ts", "tests/e2e/editor-richtext.spec.ts", "tests/e2e/editor-settings.spec.ts", "tests/e2e/export.spec.ts"]
red: ["A03 RED: 仅打开色板即阻塞导出", "A03 RED: 跨断点 Escape 回 12 而非会话起点 0", "A03 RED: 删除再撤销带回旧块草稿 12.", "A03 RED: 色板关前提前 PUT", "A03 fix RED: tidy 全量清空导致 read(left) 为 undefined", "A03 fix RED: position Escape 产生额外历史 Received 650"]
green: ["198/198 单测", "pnpm typecheck exit 0", "4 个新增 E2E + position Escape 通过", "autosave 4 passed", "A02 手机回归 3 passed", "导出可用性 1 passed"]
decisions: ["Ruling 9 移除 matchMedia 运行时订阅", "Ruling 17-21 A02 修复轮裁定", "Ruling 23 PNG 导出 SKIP", "Ruling 24-30 A03 修复轮裁定"]
artifacts: [".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A03-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-438dfe0..8bf42b0.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-8bf42b0..83f5408.diff"]
blockers: []
open_verification_items: ["Chrome 157 vs 锁定 156：export.spec.ts 2 个 + editor-fonts.spec.ts 2 个 PNG 导出用例标 SKIP，A10 须在匹配环境重跑；A03 不因此标为完全 VERIFIED"]
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

### A04 … A10

待执行。A10 负责 `pnpm verify`、逐 spec E2E、五档视觉矩阵、固定导出样本像素对比、三份维护文档，以及上述 4 个 PNG 导出用例在匹配环境下的重跑。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致，A10.2 未点名，已纳入 A10 验收清单。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明由 A10 补齐。
