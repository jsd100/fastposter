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
last_verified_commit: "71257c3"
task: A02
next_step: A02.1
spec_ids: [FP-07]
actual_paths: []
red: []
green: []
decisions: []
artifacts: []
blockers: []
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

### A02 恢复手机撤销并让属性面板下的选区可见 — IN_PROGRESS

- 需求：FP-07、FP-13（FP-07 行）；依赖 A01 的浮层与焦点机制。
- 计划接口：`fitSelectionIntoViewport(view, bounds, viewport)` 落在 `geometry.ts`；`Rect = Point & Size`；Stage 接收纯视图输入 `visibleViewport?: Rect`；手机工具条复用 `store.undo/redo` 与 `state.canUndo/canRedo`。
- 开工前预检：`geometry.ts` 有 `Point`/`Size`/`ViewTransform`，尚无 `Rect`；桌面历史按钮在 `Editor.tsx:662/672`；手机底栏从 `Editor.tsx:801` 开始；`geometry.test.ts`、`tests/e2e/editor-geometry.spec.ts`、`tests/e2e/editor-mobile.spec.ts` 均存在。
- 结果：待 A02 完成后填写（命令、退出码、用例数、证据路径）。

### A03 … A10

待执行。A10 负责 `pnpm verify`、逐 spec E2E、五档视觉矩阵、固定导出样本像素对比与三份维护文档。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致，A10.2 未点名，已纳入 A10 验收清单。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明由 A10 补齐。
