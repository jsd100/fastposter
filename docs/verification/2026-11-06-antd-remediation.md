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
last_verified_commit: "579c771" (A08 product verification)
task: A08
next_step: A09.1 (awaiting the user's go-ahead; A08 completed 2026-11-09)
spec_ids: [FP-09]
actual_paths: ["apps/web/src/features/projects/ProjectsPage.tsx", "apps/web/src/features/projects/collection-position.ts", "apps/web/src/features/projects/collection-position.test.ts", "apps/web/src/features/projects/useProjectDeletion.ts", "apps/admin/src/features/Metadata.tsx", "apps/admin/src/features/Resources.tsx", "apps/admin/src/features/templates/TemplateList.tsx", "apps/admin/src/features/copy/CopyPage.tsx", "apps/admin/src/features/projects/pagination.ts", "apps/admin/src/features/projects/pagination.test.ts", "tests/e2e/projects.spec.ts", "tests/e2e/admin-catalog.spec.ts", "tests/e2e/templates.spec.ts", "tests/e2e/copy.spec.ts"]
red: ["A08 E2E RED（真实基线 01f2f6e）: 第 2 页 500 后错误块消失、页码弹回第 1 页（projects.spec.ts:603，控制器纯基线复核为 :605，Expected visible / element(s) not found）；改名冲突无冲突 UI（:814，控制器复核 :808）；后台背景/模板/文案第 2 页删末行后空态锁死、无 page=1 请求（Expected true / Received false）；契约单测 4 个新符号 is not a function", "A08 控制器独立基线复核：837 行产品补丁 git apply -R（REVERSE_CHECK_OK / REVERSE_APPLIED），两个关键 RED 在纯基线产品代码上 exit 1，恢复后 HEAD 579c771、索引与工作树干净", "A08 诚实记录：deleting final second-page row returns to page one 在基线即 GREEN，标为回归守卫而非红灯"]
green: ["209/209 单测（31 文件）", "pnpm typecheck exit 0", "聚焦 vitest 3 文件 / 18 tests", "Prettier --check 全通过", "5 栈 E2E 9 passed（3 命名 + 3 后台缩页 + 3 既有缩页回归）", "控制器独立复跑 18 个 E2E 全部 exit 0（9 验收/回归 + 9 跨任务回归）"]
decisions: ["Ruling 9 移除 matchMedia 运行时订阅", "Ruling 17-21 A02 修复轮裁定", "Ruling 23 PNG 导出 SKIP", "Ruling 24-30 A03 修复轮裁定", "Ruling 31 429 中断后按原节奏续跑 A04", "Ruling 34-42 A04 修复轮裁定", "Ruling 44 「继续」仅授权 A05", "Ruling 45-53 A05 边界/失败分类/诚实标准裁定", "Ruling 54-55 A05 DONE_WITH_CONCERNS 处置", "Ruling 56-60 A05 评审 ⚠️ 逐项裁定与 Minor 延迟", "Ruling 61 两条消息合并授权 A06 且中断无中间状态", "Ruling 62-68 A06 基线/文件边界/替换模式契约/携带项裁定", "Ruling 69-74 A06 评审 6 项 ⚠️ 逐项裁定", "Ruling 75 A06 8 项 Minor 延迟", "Ruling 76-89 A07 单任务授权/基线/替换范围/antd Button loading 英文播报矛盾/reduced-motion/业务边界/清点/环境 SKIP/诚实标准", "Ruling 90-101 A07 评审裁定、修复轮、终验与完成", "Ruling 102-116 A08 单任务授权/基线 01f2f6e/严格文件边界/沿用纯函数/成功与查询身份门禁/失败保留本页与重试/后台四列表补齐与清单外 gap/改名冲突完整状态机/三条命名 E2E 与请求序列/PNG-safe/RED 诚实/56 项 Minor 延迟/A05-A09 携带项/验证集", "Ruling 117 FP-09「发现版本变化」按 409 REVISION_CONFLICT 响应式处理，A10 矩阵须注明", "Ruling 118-120 三项 ⚠️ 由控制器终验与 git apply -R 纯基线复核闭合", "Ruling 121 admin ProjectDeletionQueue.tsx 成功门禁缺口确认转 A10", "Ruling 122 A08 6 项 Minor 延迟（累计 62 项）", "Ruling 123 A08 完成（无修复轮、无新增环境 SKIP）"]
artifacts: [".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-01f2f6e..579c771.diff"]
blockers: []
open_verification_items: ["A08 Ruling 121：apps/admin/src/features/projects/ProjectDeletionQueue.tsx 的 pageAfterShrink 仍只判 q.data、缺成功门禁（清单外未改）。A10 须补门禁 + 第 2 页 500 失败注入 E2E；3 条既有缩页回归在 A08 终验仍全绿", "A08 Ruling 117：FP-09「或发现版本变化」由 SaveProject 409 REVISION_CONFLICT 响应式触发，未做提交前主动 GetProject 探测（FP-12 明确列表摘要契约非本轮所需）。A10 的 FP-09 验收矩阵须写明「版本变化经 409 检测」", "A08 评审 6 项 Minor 延迟（累计 62 项）：4 处同构 admin 校正 useEffect 建议抽 useAdminPageCorrection hook（优先候选）、fetchStatus 类型过宽、resultIdentity 近恒真比较、删除队列与 4 个后台门禁无失败注入 E2E、baseline-GREEN 缩页用例、两处 waitForTimeout", "A08 新增 /tmp/fp-a08-* 测试证据待 A10 汇总落盘；本轮无新增环境 SKIP，所有新增 E2E 均 PNG-safe", "Chrome 157 vs 锁定 156：export.spec.ts 2 个 + editor-fonts.spec.ts 2 个 PNG 导出用例标 SKIP，A10 须在匹配环境重跑；A03 不因此标为完全 VERIFIED", "A05 环境 SKIP：templates.spec.ts 的 administrator publishes a template… 在 line 350 导出步骤失败；A05 基线对照证明先于 A05", "A06 新增/复核共 5 处 PNG 导出 SKIP：admin-catalog.spec.ts:100（实现者基线对照）、admin-catalog.spec.ts:242、full-flow.spec.ts:201、image-upload.spec.ts:67、templates.spec.ts:350；后四处由控制器用 456 行产品补丁 git apply -R 做纯基线对照，均在完全相同行失败，证明先于 A06、非产品回归。A10 须在 Chrome 156 重跑；A06 不因此标为完全 VERIFIED", "A06 评审 ⚠️：FP-13 FP-05 行的「没有素材 / 分页错误 / 重新选择」无 A06 新增断言，A10 矩阵补；「返回来源」/空目录/飞行中舍弃分支同样无断言（Ruling 72/74）", "FP-05 「替换背景」可见确认按钮文案按 Ruling 63 未实现（保留「选用 X」旧契约以维护 full-flow / admin-catalog 回归），按 FP-14 写回规格，A10/后续任务评估", "A06 评审 8 项 Minor + A01-A05 累计 45 项 Minor（共 53 项）推迟全分支评审；其中 clearInvalid 未 refetch q.data 导致改版后重选可能重复同一错误、须改筛选或重开选择器恢复，列为全分支评审优先候选（Ruling 75）", "FP-13 「注入上传失败」由既有 notifications.spec.ts 回归用例覆盖并重跑通过，无 A05 新增最小失败用例（Ruling 57），A10 矩阵复核", "A04 三张视觉证据 PNG 位于 /tmp/fp-a04-evidence/，A10 须落到受控路径；A05/A06/A07 的 /tmp/fp-a0*-* 测试证据同样需 A10 汇总", "A07 修复轮新增环境 SKIP：admin-catalog.spec.ts:242 下载原尺寸 PNG；实现者用 git apply -R 纯基线对照证明在 795da03 同一行同样失败（RESTORE 一致、HEAD/索引未变），前置 ResourcesPage 断言全过，非产品 RED，A10 重跑", "A07 评审 3 项 Minor 延迟（累计 56 项）：目录「文案」等待未断言、· admin 第二步三条近恒真断言已按 Ruling 95 标注为 regression guard、Ruling 85 字面张力已由 Ruling 90 澄清", "A07 全入口清点第 27 行（Resources.tsx 首屏网格 Skeleton）与五类状态 antd 组件表已写入报告 §11.6，A10 汇总 FP-02 验收矩阵时引用", "Ruling 90：Ruling 85 的字面要求「把进度说明切到 Button busy」与 TemplatePicker 实际 DOM 结构不符，控制器裁定保留现状；若后续要物理移入按钮内部，属独立小修"]
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

### A06 提供背景库创建与替换的共用交互 — DONE（含 5 处环境 SKIP）

- 提交：`d4cdebc feat(web): start posters from the published background library`（4 个文件，+656/-33，全部在 A06 清单内；显式路径暂存，未触碰 23 个未跟踪用户资产）。用户授权为 「继续」（2026-11-08 10:40，派发前中断）+「请接着之前中断的任务继续执行」（2026-11-09 09:27），按 Ruling 61 合并为 A06 单任务开工指示；恢复检查确认无中间状态。
- 需求：FP-05、FP-06（背景库条款）、FP-13（FP-05 / FP-06 行）、FP-14；前置 A01、A05。
- 实现要点：
  - `ProjectsPage` 顶栏「新建海报」与空态主动作统一打开 `Dialog title="新建海报"`（`createStep: "menu" | "library" | null`），选项为「上传本地图片」「从背景库选择」「取消」；拖放仍直接导入。隐藏 `<input aria-label="导入背景图文件">` 保持 always-mounted 与 `onChange → upload(file)`，因此 `helpers.ts::openPoster` 与大量既有 E2E 无需改动（Ruling 65）。
  - `BackgroundPicker` 新增 `mode: "create" | "replace"`、`onChoose(asset, resource)`、`onBack`；create 模式单选卡片（`aria-label="选择 X"` / `aria-pressed` / 「已选中」）+「用此背景创建」确认，保留返回来源、空目录、搜索、分类与分页；replace 模式保持「选用 X」一次点击直接 `onChoose` 的旧契约与 `ProjectWorkspace` 的异尺寸预检/事务（Ruling 63）。
  - 确认时以当前筛选/分页重发 `routes.ListCatalog`，按账号 + 查询 + 四字段选中身份（资源 ID/版本、素材 ID/版本）隔离迟到响应；下架/改版/素材不可用/素材更新分别清除选中、说明原因、保留筛选分页、零创建请求；复查失败保留筛选分页与选中供重试、零创建请求；改搜索/分类/页码即时清除不可见选中（Ruling 66、Review Focus #4）。
  - `handleGalleryCreate` 复用 A05 的 `scope.claim()` → `createAndFinish(op, source)` → `scope.release(op)`，走 `buildProjectFromBackground` / `classifyCreationFailure` / `useCreationScope`，零本地上传，画布取目录原始宽高、背景取 assetId/version、标题取 `resource.title`，并沿用「结果未确认」只读刷新与迟到响应账号隔离（Ruling 64 / Ruling 56 携带项已闭合）。
- TDD（真实基线 `3a6b1e0`，仅先加测试）：三个新增用例均因 `getByRole('dialog', { name: '新建海报' })` 元素不存在而失败——基线「新建海报」直接打开原生文件选择器、无来源选择与背景库入口。首轮两个用例为 150000ms 超时，补显式 dialog 可见性断言后得到清晰的 `element(s) not found`；早期 RED 的 `PIPESTATUS` 退出码未打印数字已如实披露并改用 `> log 2>&1; echo EXIT=$?` 复跑，未伪造、未弱化。GREEN：3 个新增用例 3 passed。
- 独立评审（任务级门禁）：Spec ✅、Task quality **Approved**、0 Critical / 0 Important / 8 Minor、6 项 ⚠️。评审者自行核实两处具名风险：全仓 `<BackgroundPicker` 仅两个调用点且都传了 `mode`；`ProjectList.tsx:95-105` 空态按钮走 `onUpload`，父级已改为 `setCreateStep("menu")`，故该文件确无改动必要。控制器按 Rulings 69–74 逐项裁定 6 项 ⚠️，均为跨任务或已由控制器终验补齐的证据项；8 项 Minor 按 Ruling 75 延迟全分支评审，未进入修复轮。
- 验证（控制器独立复跑，本会话）：`pnpm typecheck` exit 0；`pnpm test` 31 文件 / **202 用例** exit 0；**20 个 E2E 全部 exit 0** —— `projects` 新增 3 + 既有 3（6/6）、`editor-mobile` 分两组 9/9、`templates` 4/4、`image-upload` 1/1 及其余回归；各命令独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output /tmp/fp-a06-ctrl-*`。另复跑 `full-flow.spec.ts:143` 以验证「选用」旧按钮与已引用背景下架后可用路径：「选用 X」点击、已保存、下架、reload、`naturalWidth === 1200` 等前置断言全部通过。
- **环境 SKIP（共 5 处，非 A06 回归）**：`admin-catalog.spec.ts:100`（实现者基线对照）、`admin-catalog.spec.ts:242`、`full-flow.spec.ts:201`、`image-upload.spec.ts:67`、`templates.spec.ts:350`（Ruling 54）均失败在「下载原尺寸 PNG」导出步骤。控制器用 456 行产品补丁 `git apply -R` 做纯基线对照（`REVERSE_CHECK_OK` / `REVERSE_APPLIED` / 基线 diff 0 行），后四处在**完全相同行**同样失败；恢复后 `RESTORED`、HEAD 仍 `d4cdebc`、索引与工作树干净。属 Chrome `157.0.8103.38` vs 锁定 `156.0.8078.48` 的导出差异。A10 须在匹配环境重跑；A06 不因此标为完全 VERIFIED。
- 遗留：8 项 Minor 延迟全分支评审（累计 53 项），其中 `clearInvalid` 未 `q.refetch()` 导致改版后重新选择仍可能重复同一错误、需改筛选或重开选择器恢复，列为全分支评审优先候选；FP-05 「替换背景」可见确认按钮文案按 Ruling 63 未实现（保留「选用 X」旧契约），按 FP-14 写回规格；来源 dialog 的取消/空态触发焦点断言、FP-13 FP-05 行三个子项、返回来源/空目录/飞行中舍弃分支的 E2E 证据归 A07 / A10。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A06-report.md`（179 行）、`task-A06-brief.md`、`review-3a6b1e0..d4cdebc.diff`。

### A07 全站等待态改用 Ant Design — DONE（含 1 处环境 SKIP、修复轮 1 次）

- 提交：`795da03 fix(ui): standardize loading states on Ant Design`（23 文件，+471/-115）+ 修复轮 `26c0ed3 fix(ui): close A07 font, offline and gallery waiting coverage`（2 文件，+292/-1）。均由显式路径暂存，未触碰 23 个未跟踪用户资产。用户授权为 2026-11-09 的「继续」，按 Ruling 76 仅授权 A07；评审基线 `b1a5238`。
- 需求：FP-02、FP-01（忙碌态保留）、FP-04（缩减动效）、FP-06（迟到回调不动）、FP-13（FP-02 行）、FP-14；前置 A03、A04、A06。
- 实现要点：
  - 新增 `packages/ui/src/LoadingState.tsx`：`LoadingState({ label, size })` 封装区域 antd `Spin` + 单一 `role="status" aria-busy="true"`，`Spin` 带 `aria-hidden`，`data-fp-loading` 供测试定位；只读播报一次状态文案，不出现英文 `loading`。
  - `button-appearance.ts::busySpinner()` 由自绘 `.spinner` 改为 antd `Spin` 作为 `loading.icon`：`Button / IconButton / ToggleButton` 自动获得 `ant-btn-loading` 与 `aria-busy`，且不引入 `role="img" aria-label="loading"` 的英文噪音（Ruling 79）。`form-contract.test.ts` 契约改写但保留两条无障碍断言。
  - 所有用于等待的 `<Status>`（蓝色 info Alert）改为 `LoadingState`，覆盖两站会话/路由/草稿/字体/目录/上传/创建/导出/后台表格等入口；`Status` 继续承担 `tone="error"`、离线静态提示与需人工操作的重试提示。`ProjectDeletionStatus` 清理中、导出轮询改 antd `Spin`；首屏作品网格改 antd `Skeleton` 并复用真实卡片几何；`apps/web/src/styles.css` 与 `packages/ui/src/styles.css` 清除自绘 `.project-skeleton` / `.spinner` / `@keyframes spin|pulse`。
  - 缩减动效为纯 CSS（`@media (prefers-reduced-motion: reduce) { .ant-spin-dot-spin, .ant-skeleton-active * { animation: none !important } }`），**无运行时 `matchMedia` 订阅**、未改 ConfigProvider（A01 Ruling 9 / A07 Ruling 80）。控制器静态核验 antd 6.7.0 `dist/antd.css` 含四个类名，且 `apps/web/src/main.tsx:22`、`apps/admin/src/main.tsx:25` 均引入 `@fastposter/ui/styles.css`。
  - 已正确的后台 antd `Table loading` / `Spin`（`Metadata.tsx:200,410,482`、`ExportJobs.tsx:148,197`、`CopyPage.tsx`）保持不变；`SaveStatus.tsx` 持久状态文字与 `TemplatePicker.tsx:274` 进度说明保持静态、不额外加 Spin（Ruling 78/85，Ruling 90 澄清字面张力）。A05/A06 的创建失败分类、账号/操作隔离、迟到回调守卫与异尺寸预检/撤销事务均未改（Ruling 82/83）。
- TDD（真实基线 `b1a5238`，先加测试）：三栈 RED 共 10 个真实产品失败，均为旧蓝色 `ant-alert-info` 等待块、自绘骨架无 `aria-busy` / 无 `.ant-skeleton`、清理态无 `[data-fp-loading]`；另有 2 个契约单测 RED。A06 → A07 的焦点携带项（Ruling 69 / 81）在基线即通过，如实记为回归断言、未伪造红灯。GREEN：三栈 11 passed。
- 独立评审（任务级门禁）：Spec ❌ / **Needs fixes**、0 Critical / **3 Important（全为 plan-mandated）** / 3 Minor / 4 ⚠️。控制器按 Rulings 90–96 逐项裁定并**恢复原实现者进入修复轮 1**：(1) A07.1 逐字要求的「字体」延迟家族缺失；(2) A07.4 / FP-13 的「离线 / 任务完成 / 可重试失败」状态迁移无验证；(3) 清单内 `Resources.tsx` pending 网格完全空白、无 Skeleton，且 A07.4 清点表漏登记并误称「已正确」。另加 Ruling 93 的真实浏览器 reduced-motion 断言与 Ruling 95 的恒真断言标注。
- 修复轮 1（`26c0ed3`）：新增 `· font`（gate 挂住 `GET /api/v1/fonts`）、`· offline`（`route.abort("internetdisconnected")` 驱动 保存中→离线草稿→已保存）、`· completion`（清理任务 running→retry_wait→completed）、`· gallery`（延迟 `/api/v1/admin/resources/`）、`· motion`（页面加载前 `browser.newContext({ reducedMotion: "reduce" })`，断言 `animationName === "none"` 并以正常动效作非恒真对照）；`Resources.tsx` 在 `q.isPending` 时渲染 3 个复用 `admin-resource-*` 类、内嵌 `Skeleton active` 的几何一致占位卡，并把该入口补进清点表第 27 行、更正报告 §2 结论。唯一真实产品 RED 是 `· gallery` 的空白网格；其余 4 个新用例是对已正确行为的新覆盖，按 Ruling 88 如实说明。
- 定向复评审：5 项（3 Important + Ruling 93/95）全部 **ADDRESSED**，修复 diff 无新 Critical/Important 破坏、无 out-of-scope 观察。
- 验证（控制器独立复跑，本会话，HEAD `26c0ed3`）：`pnpm typecheck` exit 0；`pnpm test` 31 文件 / **202 用例** exit 0；**26 个 E2E 全部 exit 0** —— 新增 spec 四互斥栈 A5/B4/C5/D2（16 passed）+ A07.5 四回归（export / cleanup / notifications / controls）+ A01 缩减动效、A02 手机撤销、A05 创建重试与迟到回调、A06 背景库创建共 6 个跨任务回归；各命令独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output /tmp/fp-a07-ctrl-*`。
- **环境 SKIP（1 处，非 A07 回归）**：修复轮的 admin 后台回归在 `admin-catalog.spec.ts:242` 「下载原尺寸 PNG」失败；实现者用 `git apply -R` 纯基线对照证明在 `795da03` 完全相同行同样失败（恢复后补丁与原件 `diff -q` 一致、HEAD/索引未变），前置 ResourcesPage 断言全过。属 Chrome 157 vs 锁定 156，A10 在匹配环境重跑。
- 遗留：A07 的 3 项 Minor 按 Ruling 95 延迟（累计 **56 项**），全分支评审分诊；`Resources.tsx` 整体 Prettier 不合规为基线既有、本轮只保留新增行且未新增 CSS（报告 §11.8 披露）；`/tmp/fp-a07-*` 证据待 A10 汇总。Ruling 90 澄清 Ruling 85 字面要求与 `TemplatePicker` 实际结构不符，保留现状。
- 证据：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A07-report.md`（381 行，含修复轮 §11）、`task-A07-brief.md`、`review-b1a5238..795da03.diff`、`review-795da03..26c0ed3.diff`。

### A08 按真实分页结果恢复页面，并处理并发改名 — DONE

- 产品提交 `579c771 fix(web): recover pagination and rename conflicts safely`（基线 `01f2f6e`，14 文件 +1151/-73），无修复轮、无新增环境 SKIP。
- 新增 `collectionIdentity` / `canCorrectPage`（用户站）与 `adminPageIdentity` / `canCorrectAdminPage`（后台）四个门禁纯函数；`lastValidPage` / `pageAfterShrink` 签名与既有断言逐字保留。校正仅在 `isSuccess && !isError && fetchStatus === "idle"` 且结果身份与当前账号/筛选/页码一致时执行；失败保留本页与可见错误，「重新加载」经 `query.refetch()` 重请求原页；滚动恢复的 `query.error` 门禁原样保留。`Resources.tsx` / `TemplateList.tsx` / `CopyPage.tsx` 原本完全没有缩页校正，本轮补齐；`Metadata.tsx` 与用户站 `useProjectDeletion.ts` 补成功门禁。
- 改名冲突：409 后保留用户输入、清空旧的「重试」、用 `routes.GetProject` 读最新快照、同时展示云端当前标题与用户输入，**只有**点击新按钮「使用云端版本并保存」才用同一新快照的 `document` + `revision` 重交；二次冲突重复流程；`renameCtx` + `renameSeq` + `activeUser` 三重守卫迟到回调，关闭/切账号/删除即失效；无新 revision 拼旧文档、无新端点、无 IDL/服务端改动。
- 验证：控制器独立复跑 `pnpm typecheck` exit 0、`pnpm test` 31 文件 / **209 用例** exit 0、聚焦 vitest 3 文件 / 18 用例、**18 个 E2E 全部 exit 0**（3 条 A08 命名用例 + 3 条后台缩页 + 3 条既有缩页回归 + 9 条 A01/A02/A05/A06/A07 跨任务回归）。两个关键 RED 由控制器用 837 行产品补丁 `git apply -R` 在纯基线上独立复核（`:605` 错误块消失、`:808` 无冲突 UI，均 exit 1），恢复后 HEAD/索引/工作树干净。
- 任务评审 **Spec ✅ / Approved**、0 Critical / 0 Important / 6 Minor / 5 ⚠️，⚠️ 由 Ruling 117–121 逐项裁定闭合；6 项 Minor 延迟（累计 62 项）。

### A09 … A10

待执行，且 **A09 尚未获得用户开工指示**（Ruling 102：本轮授权仅到 A08）。A09 与 A07 共享 `CategoryTree.tsx` / `CopyList.tsx`（`LoadingState`），与 A08 共享 `CopyPage.tsx`（文案列表校正），必须严格串行并保留两者成果。A10 负责 `pnpm verify`、逐 spec E2E、五档视觉矩阵、固定导出样本像素对比、三份维护文档、全部 PNG 导出用例在匹配 Chrome 156 环境下的重跑、**62 项**延迟 Minor 的全分支分诊、FP-05「替换背景」文案写回、A07.4 清点表与五类状态 antd 组件表的 FP-02 矩阵汇总、A08 的 admin 删除队列成功门禁与失败注入 E2E（Ruling 121）、FP-09 矩阵注明「版本变化经 409 检测」（Ruling 117），以及 `/tmp/fp-a0*-*` 证据落盘。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致，A10.2 未点名，已纳入 A10 验收清单。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明由 A10 补齐。
