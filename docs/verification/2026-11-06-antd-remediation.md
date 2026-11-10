# Ant Design 迁移后修正 — A/B 批共用执行记录

创建于 A01 阶段（实际补建于 A02 开工前，见「遗留与裁定」）。**引用完整性说明（Ruling 158）**：

- 以下 4 份权威规范/计划在本机仍是**未跟踪输入**，按 A 批长期裁定全程不修改、不暂存、不重命名、不提交；新检出无需解析它们：
  - 规范：`docs/superpowers/specs/2026-11-06-antd-post-migration-remediation-design.md`（FP-00 … FP-14）
  - A 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-a-implementation.md`
  - B 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-b-implementation.md`
  - 原始布局规范：`docs/superpowers/specs/2026-11-05-antd-layout-design.md`（UI-06、UI-08、UI-09）
- 基线：`124b4ea5d2dc7b1b58183749a393a3c4759fe47b`（`124b4ea`）；`docs/verification/2026-11-05-antd-migration.md` 是**已跟踪**的历史验收记录。
- **实施必需契约已在本记录「A10.2 维护契约逐字重述」、`AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 逐字重述**（色板、字号/控件高度/触控目标/对比度、四个断点、五档尺寸、`antd@6.7.0`、共享 `UIProvider`、renderer forbidden 边界、截图/导出采样开关、逐文件临时栈、预构建 renderer、Chrome 差异、`pnpm verify` 组成），从而消除「新检出无法解析引用」。依据 spec FP-12 `:143`「不要把忽略目录设为唯一交接来源」与 plan :188 的「或」路径；本轮不 `git add` 任何 `??` 文档。
- 逐任务的流水与评审包另见执行账本 `.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/`（git 忽略，仅本机证据）；B 批计划仅引用，不执行。

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
last_verified_commit: "4610e25" (A09 fix verification; unchanged by A10 — no product code changes)
task: A10
next_step: "A10 delivered as documentation, five-width visual matrix and evidence; A batch stays IN_PROGRESS. Re-run A10.4 fixed PNG sample pixel comparison and the 3 pre-existing PNG export cases in a matching Chrome 156 / Node 24 environment; re-run the post-helper-fix full screenshot spec once a WorkBuddy runtime without the brokered-fs/safe-delete shim is available; then re-review VERIFIED. B batch needs a separate authorization (B03.3)."
spec_ids: [FP-12, FP-13, FP-14]
actual_paths: ["apps/admin/src/main.tsx", "apps/admin/src/AdminLayout.tsx", "apps/admin/src/features/Metadata.tsx", "apps/admin/src/features/Resources.tsx", "apps/admin/src/features/copy/CategoryTree.tsx", "apps/admin/src/features/copy/CopyPage.tsx", "apps/admin/src/features/templates/TemplateEditor.tsx", "apps/admin/src/features/templates/TemplateList.tsx", "apps/web/src/features/catalog/BackgroundPicker.tsx", "apps/web/src/features/catalog/CopyPicker.tsx", "apps/web/src/features/templates/TemplatePicker.tsx", "packages/api-client/src/catalog-pages.ts", "packages/api-client/src/catalog-pages.test.ts", "packages/api-client/src/index.ts", "tests/e2e/admin-catalog.spec.ts", "tests/e2e/admin-layout.spec.ts", "tests/e2e/copy.spec.ts", "tests/e2e/templates.spec.ts", "apps/web/src/features/projects/ProjectsPage.tsx", "apps/web/src/features/projects/collection-position.ts", "apps/web/src/features/projects/collection-position.test.ts", "apps/web/src/features/projects/useProjectDeletion.ts", "apps/admin/src/features/Metadata.tsx", "apps/admin/src/features/Resources.tsx", "apps/admin/src/features/templates/TemplateList.tsx", "apps/admin/src/features/copy/CopyPage.tsx", "apps/admin/src/features/projects/pagination.ts", "apps/admin/src/features/projects/pagination.test.ts", "tests/e2e/projects.spec.ts", "tests/e2e/admin-catalog.spec.ts", "tests/e2e/templates.spec.ts", "tests/e2e/copy.spec.ts"]
red: ["A09 RED（真实基线 8c900f2）: R3 admin-layout 3 failed / 1 passed —— 延迟重置后 dialog 不可见、5xx 与网络中断无「结果未确认」；R4 copy 2 failed —— Expected: \"1:100|2:100\" / Received: \"1:100\"、缺可见子级 option；R5 admin-catalog 与 R6 templates 各 1 failed（只读首页）。R1 Cannot find module 与 R2 TS2307 如实标为接口缺失、不计产品行为 RED；known reset failure 基线即 GREEN 标为 regression guard", "A09 修复轮 RED（真实未修复产品代码 51d6651）: admin-layout -g reset result survives brand link and browser history navigation 2 failed，两条均在导航后 getByRole(dialog) element(s) not found（:696 / :715），证明 brand 与 popstate 会卸载令牌 UI", "A08 E2E RED（真实基线 01f2f6e）: 第 2 页 500 后错误块消失、页码弹回第 1 页（projects.spec.ts:603，控制器纯基线复核为 :605，Expected visible / element(s) not found）；改名冲突无冲突 UI（:814，控制器复核 :808）；后台背景/模板/文案第 2 页删末行后空态锁死、无 page=1 请求（Expected true / Received false）；契约单测 4 个新符号 is not a function", "A08 控制器独立基线复核：837 行产品补丁 git apply -R（REVERSE_CHECK_OK / REVERSE_APPLIED），两个关键 RED 在纯基线产品代码上 exit 1，恢复后 HEAD 579c771、索引与工作树干净", "A08 诚实记录：deleting final second-page row returns to page one 在基线即 GREEN，标为回归守卫而非红灯"]
green: ["A09 控制器独立复跑（HEAD 4610e25）: pnpm typecheck exit 0、pnpm test 32 文件 / 218 用例 exit 0、catalog-pages.test.ts 9/9 exit 0", "A09 控制器终验 28 个 E2E 全部 exit 0：新增/相关 14（brand+popstate 2、三条命名、失败与结果不明 3、admin-layout 既有 4、后台完整树 1、模板失败重试 1）+ A01-A08 跨任务回归 14，各命令独立临时栈、GOPROXY=off GOSUMDB=off、--output /tmp/fp-a09-ctrl-*、互斥 -g 分栈", "A09 实现者提交前：renderer build、typecheck、218/218、9/9、4 栈新增 E2E 8 passed、四个 spec 的 12 个非 PNG 既有用例全 GREEN、Prettier 全 18 文件合规", "209/209 单测（31 文件）", "pnpm typecheck exit 0", "聚焦 vitest 3 文件 / 18 tests", "Prettier --check 全通过", "5 栈 E2E 9 passed（3 命名 + 3 后台缩页 + 3 既有缩页回归）", "控制器独立复跑 18 个 E2E 全部 exit 0（9 验收/回归 + 9 跨任务回归）"]
decisions: ["Ruling 124-140 A09 单任务授权/基线 8c900f2/严格文件边界/会话容器置于 main.tsx/Dialog onClose 守卫与 closable/导航 preventDefault 与会话失效例外/令牌生命周期/结果不明分类/复制与完成/合成令牌与隐私证据/loadCatalogPages 精确规格/全调用点与不公布残缺树/公开根提升与后台不完整/E2E 分配与请求序列/RED 诚实与 PNG-safe/62 项 Minor 延迟/A05-A08 携带项/验证集与聚焦提交", "Ruling 141-149 A09 评审裁定：I-1 brand 与 popstate 绕过导航锁定确认为 Important，Ruling 128 澄清为机制描述、FP-10 spec 优先；修复策略为结构性保持 UsersPage 挂载 + brand 守卫，不改 packages/ui；M-1/M-2 延迟；Ruling 145 批准 test.use 文件级偏差；W-3/W-4/W-5/W-6 闭合；W-7 由控制器终验闭合", "Ruling 150-155 A09 终裁：定向复评审 8/8 ADDRESSED、I-1 ADDRESSED、无新 Critical/Important、无越界，修复轮 1 闭合；两个 ⚠️ 裁为 Minor 延迟；累计 66 项 Minor；A09 完成（两产品提交 51d6651 + 4610e25）", "Ruling 9 移除 matchMedia 运行时订阅", "Ruling 17-21 A02 修复轮裁定", "Ruling 23 PNG 导出 SKIP", "Ruling 24-30 A03 修复轮裁定", "Ruling 31 429 中断后按原节奏续跑 A04", "Ruling 34-42 A04 修复轮裁定", "Ruling 44 「继续」仅授权 A05", "Ruling 45-53 A05 边界/失败分类/诚实标准裁定", "Ruling 54-55 A05 DONE_WITH_CONCERNS 处置", "Ruling 56-60 A05 评审 ⚠️ 逐项裁定与 Minor 延迟", "Ruling 61 两条消息合并授权 A06 且中断无中间状态", "Ruling 62-68 A06 基线/文件边界/替换模式契约/携带项裁定", "Ruling 69-74 A06 评审 6 项 ⚠️ 逐项裁定", "Ruling 75 A06 8 项 Minor 延迟", "Ruling 76-89 A07 单任务授权/基线/替换范围/antd Button loading 英文播报矛盾/reduced-motion/业务边界/清点/环境 SKIP/诚实标准", "Ruling 90-101 A07 评审裁定、修复轮、终验与完成", "Ruling 102-116 A08 单任务授权/基线 01f2f6e/严格文件边界/沿用纯函数/成功与查询身份门禁/失败保留本页与重试/后台四列表补齐与清单外 gap/改名冲突完整状态机/三条命名 E2E 与请求序列/PNG-safe/RED 诚实/56 项 Minor 延迟/A05-A09 携带项/验证集", "Ruling 117 FP-09「发现版本变化」按 409 REVISION_CONFLICT 响应式处理，A10 矩阵须注明", "Ruling 118-120 三项 ⚠️ 由控制器终验与 git apply -R 纯基线复核闭合", "Ruling 121 admin ProjectDeletionQueue.tsx 成功门禁缺口确认转 A10", "Ruling 122 A08 6 项 Minor 延迟（累计 62 项）", "Ruling 123 A08 完成（无修复轮、无新增环境 SKIP）"]
artifacts: [".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A09-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A09-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-8c900f2..51d6651.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-51d6651..4610e25.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-01f2f6e..579c771.diff"]
blockers: ["Chrome 157.0.8103.51 vs locked 156.0.8078.48, Node v22.22.2 vs 24.21.0 — A10.4 fixed PNG sample pixel comparison and the 3 pre-existing PNG export cases (admin-catalog.spec.ts:11/:111, templates.spec.ts:274) are BLOCKED (Ruling 160)", "First per-spec E2E pass (empty /tmp/fastposter-gomod + GOPROXY=off + proxy 502) ran 0 cases; cache warmed via goproxy.cn and the full 19-spec suite re-ran 139 cases / 125 passed / 14 failed (11 Chrome-157 PNG exports + 3 single-stack login-state URL timeouts, all SKIP/BLOCKED, not A10 regressions)", "Post-helper-fix full screenshot spec and guards re-run are blocked by WorkBuddy runtime shims (Brokered host mkdir + safe-delete bulk guard on reused --output), 4 attempts exit 1; 34 real PNGs and guards 5-passed GREEN from the full-chain re-run remain valid evidence", "B batch NOT_AUTHORIZED (B03.3 threshold); A batch IN_PROGRESS — re-review VERIFIED only after a matching Chrome 156 / Node 24 re-run"]
open_verification_items: ["A09 Ruling 145：tests/e2e/admin-layout.spec.ts 文件顶层 test.use({trace:'off', screenshot:'off'}) —— Playwright 不允许 describe/test 级设置，属获批偏差；A10 须在验证矩阵记录，且不得声称该 spec 的 4 个既有用例拥有视觉失败证据", "A09 新增 4 项 Minor 延迟（累计 66 项）：M-1 loadCatalogPages 用原始累加而非去重累加判断停止（结果等价）、M-2 unknown 态未纳入 locked 可被 Escape 关闭、brand E2E 未断言 navBlocked 可见提示且无法区分双层守卫、§11.2 未逐字记录产品代码回退命令（RED 日志实体已反证）", "A09 3 个既有 PNG 导出用例 SKIP：admin-catalog.spec.ts:11/:111、templates.spec.ts:274，由 git apply -R 纯基线对照（12 个 tracked 产品文件、HEAD/索引未变、dev server 实时编译）证明先于本任务；属 Chrome 157 vs 锁定 156，A10 须在匹配环境重跑；A09 不因此标为完全 VERIFIED", "A09 /tmp/fp-a09-red-*、/tmp/fp-a09-green-*、/tmp/fp-a09-fix-*、/tmp/fp-a09-ctrl-* 证据待 A10 汇总落盘；本轮无新增环境 SKIP，所有新增 E2E 均 PNG-safe", "A08 Ruling 121：apps/admin/src/features/projects/ProjectDeletionQueue.tsx 的 pageAfterShrink 仍只判 q.data、缺成功门禁（清单外未改）。A10 须补门禁 + 第 2 页 500 失败注入 E2E；3 条既有缩页回归在 A08 终验仍全绿", "A08 Ruling 117：FP-09「或发现版本变化」由 SaveProject 409 REVISION_CONFLICT 响应式触发，未做提交前主动 GetProject 探测（FP-12 明确列表摘要契约非本轮所需）。A10 的 FP-09 验收矩阵须写明「版本变化经 409 检测」", "A08 评审 6 项 Minor 延迟（累计 62 项）：4 处同构 admin 校正 useEffect 建议抽 useAdminPageCorrection hook（优先候选）、fetchStatus 类型过宽、resultIdentity 近恒真比较、删除队列与 4 个后台门禁无失败注入 E2E、baseline-GREEN 缩页用例、两处 waitForTimeout", "A08 新增 /tmp/fp-a08-* 测试证据待 A10 汇总落盘；本轮无新增环境 SKIP，所有新增 E2E 均 PNG-safe", "Chrome 157 vs 锁定 156：export.spec.ts 2 个 + editor-fonts.spec.ts 2 个 PNG 导出用例标 SKIP，A10 须在匹配环境重跑；A03 不因此标为完全 VERIFIED", "A05 环境 SKIP：templates.spec.ts 的 administrator publishes a template… 在 line 350 导出步骤失败；A05 基线对照证明先于 A05", "A06 新增/复核共 5 处 PNG 导出 SKIP：admin-catalog.spec.ts:100（实现者基线对照）、admin-catalog.spec.ts:242、full-flow.spec.ts:201、image-upload.spec.ts:67、templates.spec.ts:350；后四处由控制器用 456 行产品补丁 git apply -R 做纯基线对照，均在完全相同行失败，证明先于 A06、非产品回归。A10 须在 Chrome 156 重跑；A06 不因此标为完全 VERIFIED", "A06 评审 ⚠️：FP-13 FP-05 行的「没有素材 / 分页错误 / 重新选择」无 A06 新增断言，A10 矩阵补；「返回来源」/空目录/飞行中舍弃分支同样无断言（Ruling 72/74）", "FP-05 「替换背景」可见确认按钮文案按 Ruling 63 未实现（保留「选用 X」旧契约以维护 full-flow / admin-catalog 回归），按 FP-14 写回规格，A10/后续任务评估", "A06 评审 8 项 Minor + A01-A05 累计 45 项 Minor（共 53 项）推迟全分支评审；其中 clearInvalid 未 refetch q.data 导致改版后重选可能重复同一错误、须改筛选或重开选择器恢复，列为全分支评审优先候选（Ruling 75）", "FP-13 「注入上传失败」由既有 notifications.spec.ts 回归用例覆盖并重跑通过，无 A05 新增最小失败用例（Ruling 57），A10 矩阵复核", "A04 三张视觉证据 PNG 位于 /tmp/fp-a04-evidence/，A10 须落到受控路径；A05/A06/A07 的 /tmp/fp-a0*-* 测试证据同样需 A10 汇总", "A07 修复轮新增环境 SKIP：admin-catalog.spec.ts:242 下载原尺寸 PNG；实现者用 git apply -R 纯基线对照证明在 795da03 同一行同样失败（RESTORE 一致、HEAD/索引未变），前置 ResourcesPage 断言全过，非产品 RED，A10 重跑", "A07 评审 3 项 Minor 延迟（累计 56 项）：目录「文案」等待未断言、· admin 第二步三条近恒真断言已按 Ruling 95 标注为 regression guard、Ruling 85 字面张力已由 Ruling 90 澄清", "A07 全入口清点第 27 行（Resources.tsx 首屏网格 Skeleton）与五类状态 antd 组件表已写入报告 §11.6，A10 汇总 FP-02 验收矩阵时引用", "Ruling 90：Ruling 85 的字面要求「把进度说明切到 Button busy」与 TemplatePicker 实际 DOM 结构不符，控制器裁定保留现状；若后续要物理移入按钮内部，属独立小修"]
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

### A09 保存重置结果并补齐分类分页 — DONE（一次修复轮，无新增环境 SKIP）

- 用户授权：2026-11-10「请接着之前中断的任务继续执行」；恢复检查确认 HEAD `8c900f2`、索引与工作树干净、无 A09 中间状态，按 Ruling 124 仅授权 A09 单任务；评审基线 `8c900f2`。
- 产品提交两个：`51d6651 fix(admin): keep reset results and complete catalog filters`（18 文件 / +1258/-112）与修复轮 `4610e25 fix(admin): keep reset flow mounted across in-app navigation`（3 文件 / +85/-3）。均按显式路径暂存，未触碰 23 个未跟踪用户资产，未改 `packages/ui/**`、`idl/**`、`server/**`、`generated.ts`。
- **重置会话**：`main.tsx` 内定义 `ResetSessionProvider`（`phase: idle|running|result|unknown` + 内存令牌 + `start/succeed/fail/finish/clear`，无新增文件）；`session-expired`、登录、非 admin 退出、logout 全部 `clear()`。`Dialog` 的 `onClose` 在 running/result 态为空操作守卫 + `closable={!locked}`，`confirm()` 有同步防重守卫；`AdminLayout` 的菜单 `Link onClick` 与 brand `<Link>` 均在活动态 `preventDefault()` 并给出可见提示。5xx / 网络中断 / `INVALID_RESPONSE` / 非 JSON 进入 `unknown`，提示「旧凭据可能已被撤销」+ 只读核对 + 由用户走现有「重置密码」入口再次签发，**无自动重发**。成功态有「复制」（含「已复制」）与「完成」（唯一解锁动作），保留 `aria-label="一次性重置令牌"` 与 `.reset-token`；令牌只存内存，不进日志/通知/缓存/URL/截图/trace，E2E 用固定合成串 + 布尔值断言。
- **完整分类分页**：新增 `packages/api-client/src/catalog-pages.ts` 的 `loadCatalogPages(fetchPage)`（签名逐字不变、`pageSize=100`、按 ID 去重、稳定 total、提前空页、请求失败、页数硬上限 → 统一可重试 `CatalogPagesError` 并保留 `cause`，**绝不返回部分结果**）与 9 例单测，从 `index.ts` 导出。admin `Resources` / `TemplateList` / `TemplateEditor`（共用 queryKey 两处同改）/ `CopyPage` / `CategoryTree` 与 web `BackgroundPicker` / `TemplatePicker` / `CopyPicker`（替换内联 `page<=1000` 循环）全部接入，只在 `isSuccess` 且聚合成功后把 `ResourceDTO[]` 交给组树/下拉，失败可见 + `query.refetch()` 保持原作用域。公开树把缺可见父级的已发布节点提升为根并携带可见后代；后台完整读取后仍缺父显示「目录不完整，请重新加载」。未改服务端可见性过滤、五级深度与 IDL。
- TDD（真实基线 `8c900f2`）：4 条真实产品 RED（延迟重置 dialog 缺失、无「结果未确认」、`Expected: "1:100|2:100" / Received: "1:100"`、缺可见子级 option）；R1 `Cannot find module` 与 R2 `TS2307` 如实标为接口缺失、不计产品行为 RED，`known reset failure` 基线即 GREEN 标为 regression guard。
- 独立任务评审（reasoning model）：**Spec ✅ / Needs fixes**，0 Critical / **1 Important** / 2 Minor / 7 ⚠️。I-1 = brand 链接与浏览器 popstate 绕过导航锁定：`AdminLayout.tsx:214` 未挂守卫、`main.tsx:232` 按 path 条件渲染 `UsersPage`，而 `target`/Dialog 是 `UsersPage` 局部状态、`phase=result` 留在 Provider，导致令牌 UI 不可达且菜单仍被锁死。控制器按 Rulings 141-149 确认并恢复原实现者进入**修复轮 1**：`main.tsx` 在活动态（`running`/`result`/`unknown`）无论 `path` 都保持 `<UsersPage />` 挂载（结构性覆盖 popstate 与任何绕过 `onClick` 的内部 `navigate()`），并给 brand `<Link>` 补 `onClick={handleNav}`；不改 `packages/ui/**`。修复 RED 为 `51d6651` 上 `2 failed`（导航后 `getByRole('dialog')` `element(s) not found`）。
- 定向复评审：**8/8 ADDRESSED、I-1 ADDRESSED、无新 Critical/Important、无越界改动**；Rulings 150-155 裁定闭合，两个 ⚠️（brand E2E 未断言 `navBlocked`、§11.2 未逐字记录回退命令）裁为 Minor 延迟，累计 **66 项** Minor 留全分支评审。
- 验证（控制器独立复跑，HEAD `4610e25`）：`pnpm typecheck` exit 0；`pnpm test` 32 文件 / **218 用例** exit 0；`catalog-pages.test.ts` 9/9 exit 0；**28 个 E2E 全部 exit 0** —— 新增/相关 14（brand+popstate 2、三条命名用例 3、失败与结果不明 3、后台完整树 1、模板失败重试 1、admin-layout 既有 4）与 A01–A08 跨任务回归 14（缩减动效/按钮阴影、手机撤销/选区、A05 创建重试与迟到回调、A06 背景库创建、A07 加载态、A08 分页与改名冲突及三个后台缩页）；各命令独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output /tmp/fp-a09-ctrl-*`、互斥 `-g` 分栈，无注册限流或 Go 代理失败。
- **环境 SKIP（3 处，既有、非 A09 回归）**：`admin-catalog.spec.ts:11/:111`、`templates.spec.ts:274` 的「下载原尺寸 PNG」失败；实现者用 982 行产品补丁 `git apply -R` 做纯基线对照，三处在完全相同行复现，恢复后 HEAD/索引未变。属 Chrome `157.0.8103.38` vs 锁定 `156.0.8078.48`，A10 在匹配环境重跑；A09 不因此标为完全 VERIFIED。
- 遗留：A09 新增 4 项 Minor 延迟（累计 66 项）；`test.use({trace,screenshot})` 为文件级获批偏差（Ruling 145），A10 须在验证矩阵记录且不得声称 4 个既有 `admin-layout` 用例有视觉失败证据；`/tmp/fp-a09-*` 证据待 A10 汇总。
- 证据：`task-A09-brief.md`、`task-A09-report.md`（332 行，含修复轮 §11）、`review-8c900f2..51d6651.diff`、`review-51d6651..4610e25.diff`。

### A10 把验收、视觉证据和维护入口一起交付 — DONE_WITH_CONCERNS（环境阻塞）

- 授权（Ruling 156）：2026-11-10「继续」仅授权 A10 单任务；基线 `3b61d53`（HEAD `3b61d53`）、上一已验证产品提交 `4610e25`；branch `feat/fastposter`；B 批 `NOT_AUTHORIZED`。
- 性质（Ruling 157）：全分支验收汇总，唯一允许修改的已跟踪文件为 `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json`、`docs/verification/2026-11-06-antd-remediation.md`、`tests/e2e/ui-baseline.spec.ts`。**未改任何 A01–A09 产品代码**；未改 `tests/e2e/export.spec.ts`、`tests/e2e/helpers.ts`、`playwright.config.ts`、其它 `tests/e2e/*.spec.ts`、`apps/admin/src/features/projects/ProjectDeletionQueue.tsx`（Ruling 159）；未 `git add`、未修改、未重命名 23 个未跟踪用户资产（Ruling 158）。
- 结论：文档、五档矩阵、验证命令、三入口审计与证据齐备；`pnpm verify` 四步全 exit 0。缓存修复后逐 spec E2E 真实重跑 19 spec / **139 用例 / 125 passed / 14 failed**（14 例均归类 SKIP/BLOCKED，非 A10 产品回归），五档守卫断言 `5 passed` 基线即 GREEN，产出 **34 张真实截图**，三入口审计 3 PASS。A10.4 固定导出样本像素对比与 Chrome-156 PNG 重跑因环境不匹配标 `BLOCKED`；修复 helper 后的完整截图 spec 重跑被 WorkBuddy 运行时 shim 拦截（4 次，见 A10.3 补记），列为未闭合关注点。**未跑的不写成通过，已跑的不写成未跑**。A 批保持 `status: IN_PROGRESS`，**未写成 `VERIFIED`**。

#### A10.1 五档视觉矩阵（`tests/e2e/ui-baseline.spec.ts`）

- 保留原 2 个 `describeCapture`（`desktop 1440x1000` 原 `:104`、`mobile 390x844` 原 `:304`）、2 个 test、22 个 `shoot` 名称、`settle()` / `shoot()` 实现与 seed 顺序（plan :192 为「扩展」）。
- 新增三档 `tablet landscape 1024x768`（前缀 `t1-`）、`tablet portrait 768x1024`（前缀 `t2-`）、`mobile 320x700`（前缀 `n3-`），经文件内新增的 `captureWidthStates()` 复用 desktop seed 覆盖登录、作品列表、模板库浮层、编辑器工作台、文案库浮层、后台登录/壳层；**未引入完整 PNG 导出步骤**（Ruling 137/162），未改 `tests/e2e/helpers.ts`。
- 新增 `five-width layout guards (default runnable)` 独立 `test.describe`（**不在 `describeCapture` 内**，故普通执行不依赖 `FP_UI_BASELINE`、不会全 skip，Ruling 161），对 1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×700 五档逐档断言 `document.documentElement.scrollWidth <= innerWidth`、可见文本选区矩形落在视口内、登录按钮与用户名输入框 `toBeInViewport()`（关键操作可达）。
- 五档尺寸：`1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×700`；四个编辑器断点：`≥1200px / 881–1199px / 681–880px / ≤680px`。
- 可重放命令（截图由开关控制、`OUT` 不指向 `test-results/`）：
  ```sh
  # 默认可运行的五档断言（无需 FP_UI_BASELINE）
  pnpm test:e2e tests/e2e/ui-baseline.spec.ts -g 'five-width layout guards'
  # 五档截图（绝对路径）
  FP_UI_BASELINE=1 FP_UI_BASELINE_OUT=/绝对路径/2026-11-10-antd-remediation/screenshots \
    pnpm test:e2e tests/e2e/ui-baseline.spec.ts --output /绝对路径/2026-11-10-antd-remediation/results/ui-baseline
  ```
- **人工核对项（可重放命令 → 证据路径 → 结论，不只写「已核对」）**：

  | 核对项 | 可重放命令 | 证据路径（相对证据根目录） | 本轮结论 |
  | --- | --- | --- | --- |
  | 字体层级与字号 | 上面 `FP_UI_BASELINE=1` 命令；看 `d-10-font-menu-preview` / `m-10-font-menu-preview` / `t1-*` / `t2-*` / `n3-*` | `screenshots/*.png`（本轮 34 张已产出） | 逐字字号契约在 A10.2 第 11 项登记、源码可核；截图已产出可目视复核；像素级人工比对需人工目视，本轮记录为「待人工目视复核」，不只写「已核对」 |
  | 色样（7 个 HEX、棋盘底/真实色两层） | 同上；看 `d-04-editor-panel` / `m-04-editor` | `screenshots/*.png` + `packages/poster-editor/src/panels/ColorField.module.css` | 色板 7 HEX 与两层色样契约逐字登记；截图已产出，像素级色样比对待人工目视复核 |
  | 对比度（普通文字 ≥4.5:1） | `pnpm test:e2e tests/e2e/ui-controls.spec.ts -g 'resting shadow\|trigger center'`（A04 既有断言） | `ui-controls.spec.ts.rerun.log` / `results/ui-controls.spec.ts/` | 本轮 `ui-controls.spec.ts` 20 用例 19 passed；`:1103 closed select values share the trigger center` 因单栈登录态 `toHaveURL(/\/login/)` 超时（A09 互斥分栈终验为绿）标 `SKIP`，视觉断言本身未报错；对比度契约逐字登记 |
  | 触控目标（≥44×44px） | `pnpm test:e2e tests/e2e/editor-mobile.spec.ts -g 'phone can undo\|phone inspector keeps\|add text capacity'`（A02 既有断言） | `editor-mobile.spec.ts.rerun.log` / `results/editor-mobile.spec.ts/` | 本轮 `editor-mobile.spec.ts` **9/9 全通过**；触控目标契约在 A10.2 第 11 项逐字登记 |
  | 320px 无意外横向溢出 | `pnpm test:e2e tests/e2e/ui-baseline.spec.ts -g 'five-width layout guards'` | `guards.rerun.log` / `results/` | 本轮五档守卫断言 **5 passed（exit 0）**，含 320×700 的 `scrollWidth <= innerWidth`、选区可见、操作可达；**基线即 GREEN / regression guard**（Ruling 169） |

#### A10.2 维护契约逐字重述（Ruling 163 的 12 项）

同批更新的已跟踪文件：`AGENTS.md`（新增「Ant Design 前端约定」章节）、`README.md`（新增「Ant Design 界面契约与视觉证据」章节 + 预设色数量修正）、`deploy/toolchain.lock.json`（最小改动，补 `selected.antd` 与 Chrome 路径/环境说明）、本验收入口。以下 12 项逐字值可从交付版本取得：

1. **固定 `antd@6.7.0`**：声明位置 `packages/ui/package.json:15`、`packages/poster-editor/package.json:15`、`apps/web/package.json:17`、`apps/admin/package.json:17`。
2. **共享 `UIProvider`**：`packages/ui/src/UIProvider.tsx:25`（`export function UIProvider`）、`apps/web/src/main.tsx:90`、`apps/admin/src/main.tsx:320`；两站共用，任何直接使用 antd 的页面仍走共享 provider。
3. **renderer 隔离 forbidden 规则**：`tools/check-entry-boundary.mjs:8-12` 的 `forbidden` —— renderer 不得含 `node_modules/antd/`、`packages/ui/src/`、`@fastposter+ui@`；web/admin 不得含 `@tiptap/`、`prosemirror-`。
4. **背景库入口与创建/替换契约**（A05/A06 产物）：`BackgroundPicker` 的 `mode: "create" | "replace"`；create 以「用此背景创建」确认并复用 `buildProjectFromBackground` 创建事务（零本地上传）；replace 保留 `aria-label="选用 ${title}"` 一次点击旧契约与异尺寸预检/撤销（Ruling 63）。
5. **手机历史与撤销**（A02/A03 产物）：390px / 320px 工作台提供可点击「撤销」「重做」，命中区 ≥44×44px；编辑手势、数值草稿与自动保存按会话边界收敛。
6. **截图开关**：`FP_UI_BASELINE=1`（启用截图，`tests/e2e/ui-baseline.spec.ts:9`）、`FP_UI_BASELINE_OUT`（`:8`，默认 `test-results/ui-baseline`，运行时须指向 `test-results/` 之外的绝对路径）、`FP_EXPORT_BASELINE_PATH`（`tests/e2e/export.spec.ts:41-42`，把固定导出用例下载字节写到指定位置）。
7. **逐文件独立临时测试栈与互斥 `-g`**：每个 spec 独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output <证据目录>/results/<suite>`、日志 `tee`；单文件注册限流时按互斥 `-g` 分栈（A04/A07/A09 惯例）。
8. **预构建 renderer**：开工先 `pnpm --filter @fastposter/renderer build`（Global Constraints :47）。
9. **当前 Chrome 设置方式**：Playwright 取 `CHROME_PATH`（`playwright.config.ts:12-15`，默认 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）；`deploy/toolchain.lock.json:8` 锁定 `156.0.8078.48`，本机实测 `157.0.8103.51`（验收入口 `:94/:117/:133` 记 A 批开工 `157.0.8103.38`），Node `v22.22.2` ≠ `24.21.0`；差异影响见 A10.4 `BLOCKED`。
10. **五档尺寸与四个断点**：`1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×700`；`≥1200px / 881–1199px / 681–880px / ≤680px`。
11. **色板 7 个 HEX 与字号/控件高度/触控目标/对比度逐字值**：`#FFFFFF`（内容表面）、`#F3F5F4`（工作区）、`#E6EAE7`（画布外围）、`#202C25`（主要文字）、`#526159`（辅助）、`#2E694F`（主操作）、`#A63232`（危险色）；普通文字对比度 ≥4.5:1。常规控件 36px、桌面紧凑 32px、触控主操作 ≥44×44px；页面标题 24–29px、区域标题 14–16px、正文及常规值 14px、标签 13px、说明/单位/状态 12px、触控文本输入 16px；标签间距 4–8px、字段组间 12–16px、面板内边距 12–16px。
12. **`pnpm verify` 实际组成**：`package.json:12` → `pnpm contracts:check && pnpm typecheck && pnpm test && pnpm build`（`contracts:check → typecheck → test → build`），**不含 Go 与 E2E**，须按改动范围补跑。

**历史验证与当前结果必须区分**：`docs/verification/2026-11-05-antd-migration.md:415` 的 `magick compare -metric AE = 0 (0)` 与 SHA-256 `f36c78f9…`、`:417` 起「逐文件 E2E（每个文件独立新临时栈，合计 89/89）」均为**基线 `124b4ea` 的历史验证**，不是本轮结果；本轮结果见 A10.3 与 A10.4，`magick compare` 本轮**未执行**、不得引用历史 `0 (0)` 当证据。

#### A10.3 `pnpm verify`、逐 spec E2E、截图 spec 与三入口审计（真实执行）

**环境记录（本轮实测，2026-11-10）**：HEAD `3b61d53`、branch `feat/fastposter`、Node `v22.22.2`、pnpm `11.25.0`、Go `go1.27.2 darwin/arm64`、Chrome `157.0.8103.51`、ImageMagick `7.1.2-34`、Python `3.13.12`；`.env.local` 的 `CHROME_PATH` 指向 macOS 默认路径，未配置 `FASTPOSTER_TEST_MYSQL_DSN`，MySQL 服务在 `127.0.0.1:3306` 监听、`15173/15174/18080` 空闲；测试数据来源为仓库保护器的合成 `fastposter_test_*` 临时库。

**开工构建与 `pnpm verify`**（证据：`evidence/verify/verify.log`）：

| 命令 | exit code | 结果 |
| --- | --- | --- |
| `pnpm --filter @fastposter/renderer build` | 0 | 119 modules，`apps/renderer/dist` 生成 |
| `GOPROXY=off GOSUMDB=off pnpm contracts:check` | 0 | `generated contracts match the Thrift IDL`，基线不漂移（控制器预检一致） |
| `pnpm typecheck` | 0 | `tsc --noEmit` |
| `pnpm test` | 0 | 32 文件 / 218 用例 |
| `pnpm build` | 0 | turbo 8/8 |
| `GOPROXY=off GOSUMDB=off pnpm verify`（完整重跑 `contracts:check → typecheck → test → build`） | 0 | 四步均通过 |
| `pnpm typecheck`（编辑 spec 后再次） | 0 | 新增断言 TS 无误 |
| `pnpm exec prettier --write` / `--check tests/e2e/ui-baseline.spec.ts` | 0 | 合规 |
| `python3 -m json.tool deploy/toolchain.lock.json` / `prettier --check` | 0 | JSON 合法 |

**三入口 manifest/sourcemap 审计**（Ruling 167；产物落证据目录，不提交）：

```sh
for app in web admin renderer; do
  pnpm --filter "@fastposter/$app" exec vite build --manifest --sourcemap --outDir <证据目录>/$app
done
node tools/check-entry-boundary.mjs <证据目录>/web <证据目录>/admin <证据目录>/renderer
```

真实结果（`evidence/entry-boundary.log`，exit 0）：

```text
web: PASS 2 entry chunk(s), 764 source(s)
admin: PASS 6 entry chunk(s), 748 source(s)
renderer: PASS 1 entry chunk(s), 35 source(s)
```

**逐 spec E2E 首轮（环境阻塞，如实记录）**：按 plan :204-213 循环脚本执行（`rg` 本机不可用，改用 `git ls-files 'tests/e2e/*.spec.ts' | sort` 等价检索），每个 spec 独立临时栈、`GOPROXY=off GOSUMDB=off`、`--output <证据目录>/results/<suite>`、日志单独保存。首轮 **19 个 spec + guards + 截图 spec 全部 exit 1，0 个用例执行**（`evidence/e2e-index.log`）。根因：`/tmp/fastposter-gomod` 模块缓存为空（0B），`GOPROXY=off` 下 `server/gen/kitex/common/k-base.go:11:2: module lookup disabled by GOPROXY=off`，Playwright `webServer` 无法编译启动（`evidence/guards.log` 与每个 `<suite>.log` 同一报错）。去除 `GOPROXY=off` 的探测（`evidence/guards-retry.log`）则遇 `proxy.golang.org` 对 `github.com/cloudwego/gopkg@v0.2.1` 返回 **502 Bad Gateway**。二者均属 Ruling 169 明确排除的「构建错误 / Go 代理 502」，**不算产品 RED，也不算通过、未跑的不写成通过**。
- 环境修复（仅本机缓存，未改仓库文件、未改 HEAD/索引）：`GOMODCACHE=/tmp/fastposter-gomod GOPROXY=https://goproxy.cn,direct GOSUMDB=off go mod download all` → exit 0，缓存 0B → 735M（`evidence/go-mod-warmup.log`）。
- 修复后按同一循环**带 `GOPROXY=off GOSUMDB=off` 重跑**（`evidence/run-a10-e2e-rerun.sh`），真实用例数与结果见下方「A10.3 补记」。

**五档新增断言的 RED/GREEN（Ruling 169）**：在**未改动产品代码的 `3b61d53`** 上，以 `pnpm test:e2e tests/e2e/ui-baseline.spec.ts -g 'five-width layout guards'` 只运行新增的 5 个默认可运行断言（不带 `FP_UI_BASELINE`）。首轮因上述 webServer 环境阻塞无法执行，标 `BLOCKED`（既非产品 RED、也非 baseline-GREEN，严禁伪造）；缓存修复后 `evidence/guards.rerun.log` 真实 **exit 0 / 5 passed（25.5s）**，结论为**基线即 GREEN / regression guard**，详见「A10.3 补记」。模块/用例缺失、构建错误、注册限流、Go 代理 502、Chrome 157 的 PNG 失败均不计作 RED。

**截图 spec**：`FP_UI_BASELINE=1 FP_UI_BASELINE_OUT=<证据目录>/screenshots pnpm test:e2e tests/e2e/ui-baseline.spec.ts --output <证据目录>/results/ui-baseline`；首轮因 webServer 阻塞，缓存修复后的全链重跑与 helper 修复后 4 次单独重跑的真实结果见「A10.3 补记」。

#### A10.3 补记 —— 缓存修复后的真实重跑结果（Ruling 166/169/170，2026-11-10）

**逐 spec E2E 真实用例数**：`evidence/run-a10-e2e-rerun.sh` → `e2e-rerun-index.log` 与各 `<suite>.rerun.log`。Go 模块缓存预热后按 plan :204-213 循环、`GOPROXY=off GOSUMDB=off`、每个 spec 独立临时栈、`--output <证据目录>/results/<suite>`、日志单独保存，`git ls-files 'tests/e2e/*.spec.ts' | sort` 全量 19 个 spec **无跳过未跑**：共 **139 用例 / 125 passed / 14 failed / 0 skipped**。

| spec | 用例 | passed | failed | 失败归类 |
| --- | --- | --- | --- | --- |
| admin-catalog.spec.ts | 4 | 2 | 2 | PNG `:11/:111` |
| admin-layout.spec.ts | 10 | 8 | 2 | 登录态 `toHaveURL` `:685/:705` |
| autosave.spec.ts | 4 | 4 | 0 | — |
| copy.spec.ts | 4 | 4 | 0 | — |
| editor-fonts.spec.ts | 12 | 10 | 2 | PNG `:151/:455` |
| editor-geometry.spec.ts | 1 | 1 | 0 | — |
| editor-mobile.spec.ts | 9 | 9 | 0 | — |
| editor-richtext.spec.ts | 5 | 5 | 0 | — |
| editor-settings.spec.ts | 8 | 8 | 0 | — |
| export.spec.ts | 3 | 1 | 2 | PNG `:5/:78` |
| full-flow.spec.ts | 3 | 1 | 2 | PNG `:39/:143` |
| image-upload.spec.ts | 2 | 1 | 1 | PNG `:5` |
| loading-states.spec.ts | 16 | 16 | 0 | — |
| notifications.spec.ts | 6 | 6 | 0 | — |
| project-permanent-deletion.spec.ts | 13 | 12 | 1 | PNG `:335` |
| projects.spec.ts | 9 | 9 | 0 | — |
| session-sync.spec.ts | 3 | 3 | 0 | — |
| templates.spec.ts | 7 | 6 | 1 | PNG `:274` |
| ui-controls.spec.ts | 20 | 19 | 1 | 登录态 `toHaveURL` `:1103` |
| **合计** | **139** | **125** | **14** | 11 PNG + 3 登录态 |

**14 个失败的归类与处置（SKIP / BLOCKED，不计为 A10 产品回归，未写成通过）**：
- **11 个「下载原尺寸 PNG」导出用例**（`admin-catalog:11/:111`、`editor-fonts:151/:455`、`export:5/:78`、`full-flow:39/:143`、`image-upload:5`、`project-permanent-deletion:335`、`templates:274`）在 `getByRole('link',{name:'下载原尺寸 PNG'}).toBeVisible()` 超时 —— Chrome `157.0.8103.51` ≠ 锁定 `156.0.8078.48`，匹配环境重跑标 `BLOCKED`（A10.4）。多个日志另附 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`（`count:50`）为 WorkBuddy 运行时 shim 在测试清理阶段的附加噪音，非用例断言失败。
- **3 个登录/导航用例**（`admin-layout:685/:705` 的 `toHaveURL(/\/admin\/overview$/)`、`ui-controls:1103` 的 `toHaveURL(/\/login/)`）因单栈后台登录未成功超时，符合 A04/A07/A09 记录的「单文件注册限流需互斥 `-g` 分栈」模式（A09 控制器互斥分栈终验为绿），本轮标 `SKIP`，不计产品回归。
- **先于 A10 的对照证据（Ruling 166）**：`git diff --name-only` 显示 A10 仅改 5 个已跟踪文件、`apps/**` / `packages/**` / `server/**` / `idl/**` 零改动（`evidence/a10-changes.patch`，499 行）；上述 9 个失败用例所在 spec 的 `git diff HEAD -- <spec>` **全为 0 行**（A10 完全未触碰）；`git apply --check -R evidence/a10-changes.patch` **exit 0**（可逆、check-only，未改 HEAD/索引/工作区）。A03–A09 章节已有的 `git apply -R` 纯基线对照进一步证明这些 PNG 失败先于各任务。故 14 个失败均非 A10 引入。

**五档守卫断言 RED/GREEN 真实结果（Ruling 169）**：`pnpm test:e2e tests/e2e/ui-baseline.spec.ts -g 'five-width layout guards'` → `evidence/guards.rerun.log` **exit 0 / 5 passed（25.5s）**：1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×700 五档 `scrollWidth <= innerWidth`、选区可见、关键操作可达全部通过。**基线即 GREEN / regression guard**，320px / 768×1024 无真实横向溢出或操作不可达，不伪造产品 RED。修复 `captureWidthStates()` helper（移除作品列表页误点的「文案」按钮、admin 侧只拍登录页）后 `pnpm typecheck` / Prettier 均 exit 0，但守卫断言再次运行（`guards.postfix.log`）与完整截图 spec 均被下述沙箱拦截、未在修复后二次 GREEN 复跑；helper 改动未触及 guards 断言代码，原始 5 passed 仍是有效基线证据。

**截图 spec 与 WorkBuddy 沙箱阻塞（如实列为未闭合关注点）**：全链重跑中 `FP_UI_BASELINE=1` 的截图 spec（`ui-baseline.rerun.log`）原两档 22 张 + 5 个守卫断言通过；三档 `captureWidthStates()` 因 helper 缺陷（作品列表页误点「文案」按钮）在 240s 超时前各落盘 4 张，合计 **34 张真实 PNG**（`evidence/screenshots/`，五档覆盖）。修复 helper 后 4 次单独重跑完整截图 spec 均被 WorkBuddy 运行时 shim 拦截，**未完成修复后的完整通过复跑**：

| 尝试 | 日志 | exit | 根因（均为环境 shim，非产品/Playwright） |
| --- | --- | --- | --- |
| 1 | `ui-baseline.final.log` | 1 | `Process from config.webServer was not able to start` |
| 2 | `ui-baseline.final2.log` | — | `Brokered host mkdir requires an available runtime file rule`（tee 新建目录） |
| 3 | `ui-baseline.final3.log` | 1 | `[safe-delete]` 批量保护 `count:1873 > 50`（复用 `--output` 累积）+ `mkdir` 拦截 |
| 4 | `ui-baseline.clean.log`（`run-a10-ub-clean.sh`，全新空 `--output`） | 1 | `webServer` 启动失败 + `mkdir` 拦截 |

`e2e-index.log` 记录 `UI_BASELINE_FINAL_EXIT=1` / `UI_BASELINE_FINAL3_EXIT=1` / `UI_BASELINE_CLEAN_EXIT=1`（第 2 次因 shim 中断未落数值）。全链重跑那次 webServer 正常启动并跑完 139 用例，说明阻塞来自后续单独后台任务的运行时文件规则上下文，非产品缺陷。**修复后三档截图的完整通过复跑待无 shim 环境补做**；现有 34 张截图与守卫 5 passed 是本轮真实产出证据，不写成失败、也不写成完整通过。

**代表性截图尺寸与 SHA-256**（`evidence/screenshots/`，合成 seed 数据，Ruling 168；完整 34 张清单见报告 §11，可用 `shasum -a 256 evidence/screenshots/*.png` 重放）：

| 截图 | 尺寸 | SHA-256 |
| --- | --- | --- |
| `d-01-login.png` | 1440×1000 | `593dbb2f8f36d087ec5a04291a97436bcf896fb894969dd6bcfb77cddd29d70e` |
| `m-01-login.png` | 780×1688 | `05eb0940d1415b2679cb1dd97ade0c637e4d06e207d053d0ba13ed01e5dbde4f` |
| `t1-01-login.png` | 1024×768 | `656f8747c0167aeb8660a51e3ff631a9f10ac040c75c6d61c6f1d438887acbe6` |
| `t2-01-login.png` | 768×1024 | `47a1e27f833b903b7fbee38ab8743e4efe43154a650c80ee537d6e0608421d11` |
| `n3-01-login.png` | 640×1400 | `2ea7a7a70cb3e077622e1b14a3658c1a27d9278fcf87e4ac964ce2f300f5bf05` |

固定导出样本 PNG 本轮 `BLOCKED` 未生成，故无该样本尺寸/SHA-256；不得引用历史 `docs/verification/2026-11-05-antd-migration.md:415` 的 `f36c78f9…` 当本轮结果。

#### A10.4 固定导出样本像素对比与 Chrome-156 PNG 重跑 — BLOCKED

- **环境缺口（Ruling 160）**：本机实测 Chrome `157.0.8103.51` ≠ `deploy/toolchain.lock.json:8` 锁定 `156.0.8078.48`；Node `v22.22.2` ≠ 锁定 `24.21.0`；Chrome 156 可执行文件不存在。固定导出样本像素对比与基线 `124b4ea` 单独临时工作区采样**无法在匹配环境完成** → 标 **`BLOCKED`**。本轮**未执行** `magick compare`、**未伪造**输出、**未引用**历史 `docs/verification/2026-11-05-antd-migration.md:415` 的 `0 (0)` 当本轮结果。
- **完整复现命令**（待匹配环境）：

  ```sh
  # 两边各自构建 renderer，使用同一合成文档、字体、Chrome 与运行环境
  pnpm --filter @fastposter/renderer build
  FP_EXPORT_BASELINE_PATH=/绝对路径/sample.png \
    pnpm test:e2e tests/e2e/export.spec.ts -g 'flushes latest edits and previews the exact native PNG'
  # 基线 124b4ea 在单独临时工作区采样（已自带该钩子，export.spec.ts:41-42）
  magick compare -metric AE baseline.png current.png null:   # 固定样本预期像素差为 0
  ```

  环境前提：Chrome `156.0.8078.48` 可执行文件（`CHROME_PATH`）、Node `24.21.0`、ImageMagick `7.1.2-34`、同一合成文档与字体、两边各自构建的 renderer、同一运行参数；记录尺寸与 SHA-256。
- **3 个既有 PNG 导出用例**（`admin-catalog.spec.ts:11/:111`、`templates.spec.ts:274`）的 Chrome-156 重跑同样标 `BLOCKED`；缓存修复后本轮已在 Chrome 157 下**实际执行**这些用例（连同其余 8 个「下载原尺寸 PNG」用例共 11 个 `toBeVisible` 超时，见 A10.3 补记），但因匹配环境缺失无法重跑，标 `BLOCKED`。A03–A09 已用 `git apply -R` 产品补丁**纯基线对照**（不改 HEAD/索引）证明这些失败先于各任务；A10 另以 `git diff --name-only`（仅 5 文件、零产品代码）、9 个失败 spec 的 `git diff HEAD -- <spec>` 全 0 行、`git apply --check -R evidence/a10-changes.patch` **exit 0**（可逆、check-only）证明先于 A10、不计为 A10 产品回归。本轮**未**做产品补丁的实际反向重跑（不建 worktree / 不改 HEAD 索引 / 不改产品代码）。
- 导出样本 PNG 本轮**未生成**，故无尺寸/SHA-256；代表性截图的尺寸与 SHA-256 见「A10.3 补记」与「证据目录与隐私」。

#### A10.5 FP-13 验收矩阵（FP-01 … FP-10、FP-12 共 11 行）

口径：A01–A09 的产品提交与控制器终验 E2E 为**历史已验证证据**；本轮 A10 是汇总，缓存修复后逐 spec E2E 已真实重跑 **19 spec / 139 用例 / 125 passed / 14 failed**（A10.3 补记），14 例均归类 SKIP/BLOCKED（11 个 Chrome-157 PNG 导出、3 个单栈登录态），不计产品回归。**未跑的不写成通过，已跑的不写成未跑**；视觉/交互细项的人工目视与 Chrome-156 匹配环境补跑仍为缺口。

| 编号 | 必须观察结果 | 本轮证据（命令/用例/commit） | 状态 | 缺口 |
| --- | --- | --- | --- | --- |
| FP-01 | 两站默认/主/危险按钮静止无底部投影，键盘焦点、描边与禁用态清晰 | A04 提交 `95b8447`/`ffc9039`；A09 终验 `ui-controls -g 'resting shadow\|trigger center'`（历史 exit 0）；本轮 `ui-controls.spec.ts` 20 用例 19 passed、`:1103 trigger center` 因单栈登录态 `toHaveURL(/\/login/)` 超时（A09 互斥分栈终验绿）标 `SKIP`；`pnpm verify` 四步 exit 0 | `BLOCKED` | 视觉细项未逐项人工目视复核；FP-01 `border-color` 独立断言为 Minor 写回项 |
| FP-02 | 分别延迟各请求，加载可见且无蓝色等待块；成功/空/失败/刷新/离线各自状态；记录各入口 antd 组件 | A07 提交 `795da03`/`26c0ed3`；**A07.4 清点表 27 行与五类状态 antd 组件表见 `task-A07-report.md §11.6`**（首次 / 局部刷新 / 可恢复错误 / 离线 / 任务完成）；本轮 `loading-states.spec.ts` **16/16 全通过** | `PASS` | 清点表与五类状态表已引用；PNG 证据本轮 `BLOCKED`（A10.4） |
| FP-03 | 两站与编辑器关闭态垂直中心 ≤2px；五档截图人工核对字体层级、触控尺寸、对比度、无横向溢出 | A04 提交；本轮新增 `five-width layout guards` **5 passed / exit 0**（`guards.rerun.log`，`scrollWidth <= innerWidth`、选区可见、关键操作可达，基线即 GREEN）；产出 34 张五档截图；A10.1 人工核对表 | `PASS` | 「垂直中心 ≤2px」与字体/触控/对比度的像素级人工目视待复核；修复 helper 后完整截图 spec 重跑被 shim 拦截（A10.3 补记） |
| FP-04 | 普通与缩减动效两种模式真实操作菜单/下拉/色板/抽屉/对话框，Escape 退层、焦点归还、无滚动锁 | A01 提交 `2b6a635`/`71257c3`；A09 终验回归（历史 exit 0）；本轮相邻 `notifications.spec.ts` 6/6、`editor-richtext.spec.ts` 5/5、`copy.spec.ts` 4/4 全通过 | `BLOCKED` | 缩减动效细项本轮无新增断言，以历史控制器终验为准 |
| FP-05 | 顶栏与空态进入新建、取消无写入、背景原尺寸创建并重开、替换可撤销；下架/更新/无素材/分页错误/重选覆盖 | A06 提交 `d4cdebc`；Ruling 63 保留 `aria-label="选用 ${title}"` 旧契约 | `GAP` | 「确认按钮写作「替换背景」」可见文案偏差按 **Ruling 63 记为 FP-14 写回项**；「没有素材 / 分页错误 / 重新选择」「返回来源 / 空目录 / 飞行中舍弃」无 A06 新增断言（Ruling 72/74），A10 矩阵补记 |
| FP-06 | 上传失败/上传成功而创建被拒/结果不确定/重复操作/账号切换；可重试仅一次上传、迟到回调无跨账号副作用 | A05 提交 `846e183`；A09 终验回归（历史 exit 0）；本轮 `image-upload.spec.ts` 2 用例 1 passed、`:5` 因 Chrome-157 PNG 导出标 `SKIP` | `BLOCKED` | 上传状态机细项以历史终验为准；PNG 导出证据本轮 `BLOCKED`（A10.4） |
| FP-07 | 390px/320px 触控删除/撤销/重做、抽屉打开后选区可见、100 块限制两端一致 | A02 提交 `57ecf6d`/`8bda815`；A09 终验回归（历史 exit 0）；本轮 `editor-mobile.spec.ts` **9/9 全通过**、五档守卫断言含 320px 操作可达 5 passed | `PASS` | 「100 块限制两端一致」细项以历史终验为准；触控目标契约逐字登记（A10.2 第 11 项） |
| FP-08 | 色板手势、数值草稿、Escape 恢复会话起点、删除后撤销恢复最后有效文档值；保留输入法/字形预检/导出回归 | A03 提交 `8bf42b0`/`83f5408`；A09 终验回归（历史 exit 0）；本轮 `editor-geometry.spec.ts` 1/1、`editor-settings.spec.ts` 8/8、`editor-richtext.spec.ts` 5/5 全通过，`editor-fonts.spec.ts` 12 用例 10 passed / 2 PNG 导出 `SKIP` | `BLOCKED` | 手势/草稿细项以历史终验为准；PNG 导出证据本轮 `BLOCKED`（A10.4） |
| FP-09 | 第 2 页 500 保持第 2 页并重试、成功缩页 25→24 回第 1 页、并发改名保留用户输入 | A08 提交 `579c771`；**逐字「版本变化经 409 检测」**（Ruling 117：`SaveProject` 返回 409 `REVISION_CONFLICT`，`server/internal/projects/service.go:62`、`transport/hertz.go:101`，未做提交前主动 `GetProject` 探测）；本轮 `projects.spec.ts` 9/9、`project-permanent-deletion.spec.ts` 13 用例 12 passed（1 个 PNG 导出 `SKIP`） | `GAP` | **Ruling 121 未闭合 gap**：`apps/admin/src/features/projects/ProjectDeletionQueue.tsx` 的 `pageAfterShrink` 仍只判 `q.data`、缺成功门禁 + 第 2 页 500 失败注入 E2E；按 **Ruling 159 不改该产品代码**（代码层缺口，3 条既有缩页回归仍绿），列为 FP-14 写回/后续归属 |
| FP-10 | 延迟重置响应时取消/遮罩/Escape/应用内导航无法隐藏对话；成功后令牌可复制；分类 >100/跨页/公开父级未发布/任一页失败反映真实结果 | A09 提交 `51d6651`/`4610e25`；A09 控制器终验 28 E2E 全 exit 0（历史）；本轮 `session-sync.spec.ts` 3/3、`autosave.spec.ts` 4/4、`admin-layout.spec.ts` 10 用例 8 passed（2 个登录态 `toHaveURL` `SKIP`） | `BLOCKED` | 重置令牌细项本轮无新增断言，以 A09 控制器终验为准；2 个登录态失败需互斥 `-g` 分栈复核 |
| FP-12 | 新工作区能定位现行文档/命令/测试夹具/证据；构建边界检查 web/admin 无富文本依赖、renderer 无 antd/UI 依赖 | 本轮 `pnpm verify` 四步 exit 0、三入口审计 `web/admin/renderer` 3 PASS exit 0、三份维护文档 + 本验收入口齐备、34 张截图与证据目录、可重放命令（A10.2 十二项契约） | `PASS` | 固定导出样本像素对比 `BLOCKED`（A10.4），不属本行通过所需架构改造 |

**Ruling 145 单列（获批偏差）**：`tests/e2e/admin-layout.spec.ts:20` 的 file-level `test.use({trace:"off",screenshot:"off"})`（另含 `actionTimeout:8_000`）为**获批偏差** —— Playwright 拒绝在 `describe`/`test` 内设置 `test.use({trace, screenshot})`（会强制新 worker），文件级是唯一可强制作用域。**不得声称**该 spec 的 4 个既有用例拥有视觉失败证据；本轮也未对其做任何视觉失败断言。本轮 `admin-layout.spec.ts` 10 用例 8 passed，2 个 `toHaveURL(/\/admin\/overview$/)` 超时属单栈后台登录限流（A09 修复轮互斥 `-g` 分栈终验为绿），标 `SKIP`、非视觉失败、不计产品回归（A10.3 补记）。

#### 66 项 deferred Minors 全分支分诊（Ruling 165）

按任务条数 + 账本行号定位（`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/progress.md`）：

| 任务 | 条数 | 账本行号定位 | 严重度复判 | 处置分类 |
| --- | --- | --- | --- | --- |
| A01 | 11 | `:75/:84/:95` | 全 Minor（1 Important 已在 A01 修复轮闭合），无升级项 | 延迟后续任务 |
| A02 | 11 | `:101/:108/:120` | 全 Minor（2 Important 已在 A02 修复轮闭合） | 延迟后续任务 |
| A03 | 12 | `:147/:152` | 全 Minor（3 Important 已在 A03 修复轮闭合） | 延迟后续任务 |
| A04 | 7 | `:160/:172/:184` | 全 Minor（5 Important 已在 A04 修复轮闭合）；`border-color` 断言、具名「更多」/真实 `title` 为文档写回项 | 本批文档关闭（写回）/ 延迟后续任务 |
| A05 | 5 | `:221/:227/:231-232` | 全 Minor | 延迟后续任务 |
| A06 | 8 | `:265/:274/:288` | 全 Minor；`clearInvalid` 未 `q.refetch()` 为优先候选，仍属 Minor | 延迟后续任务 |
| A07 | 3 | `:359/:389` | 全 Minor；A07.4 清点表 27 行已写入报告 §11.6 | 本批文档关闭（FP-02 矩阵已引用）/ 延迟 |
| A08 | 6 | `:418/:420/:429` | 全 Minor；4 处同构 admin 校正 `useEffect` 抽 `useAdminPageCorrection` hook 为优先候选，仍属 Minor | 延迟后续任务 |
| A09 | 4 | `:487`（M-1/M-2）、`:516`（Rulings 151/152） | 全 Minor | 延迟后续任务 |
| **逐任务之和** | **67** | — | — | — |
| **Ruling 154 权威累计** | **66** | `:516`、`:540` | — | 本表以 **66** 为准 |

**差异如实标注（不凑数）**：逐任务条数之和为 **67**（11+11+12+7+5+8+3+6+4），而 Ruling 154 的权威累计为 **66**；账本分段累计 `:197`=40、`:243`=45、`:274`=53、`:389`=56、`:429`=62、`:487`=64、`:516`=66 均比「按逐任务条数累进」少 1（差异自 A01–A04 段即存在）。按 Ruling 165，**以 66 为准，不自行凑数、不改账本、不改产品代码**。

**严重度复判结论**：全分支分诊未发现需升级为 `Important` 的项；A06 `clearInvalid`、A08 同构 hook 抽取、A09 M-1/M-2 仍是 Minor 优先候选。若后续复核发现需升级项，按 Ruling 165 **只记录并标 `BLOCKED`，不在 A10 改产品代码**。

**处置分类**：① 本批文档关闭 —— 纯文档/证据类（Ruling 145 偏差记录、A07.4 清点表与五类状态表引用、FP-05 文案写回、FP-09 409 注明、`/tmp/fp-a0*-*` 证据登记、README 预设色数量核对）已在本记录关闭；② 延迟后续任务 —— 全部代码层 Minor 继续保持延迟，A10 **不批量修改产品代码**。

#### 批次状态（Ruling 160 / B03.3）

- **B 批：`NOT_AUTHORIZED`**（FP-11 涉及 IDL、生成代码与服务端事务，需用户单独授权）。引用 B 批计划 `docs/superpowers/plans/2026-11-06-antd-remediation-b-implementation.md` `:78` 的 **B03.3 门槛**：「运行下方最终门槛…按 A 批 A10 命令执行 renderer、入口边界和固定导出样本检查，若当前 A 批未执行，按实际产品基线记录」。A10 **不执行** B 批任何工作（IDL / `server/**` / Go 事务 / MySQL 集成）。
- **A 批：`status: IN_PROGRESS`**，保持不改为 `VERIFIED`。环境阻塞清单见 front matter `blockers`：(1) Chrome `157.0.8103.51` ≠ 锁定 `156.0.8078.48`、Node `v22.22.2` ≠ `24.21.0` → A10.4 固定导出样本像素对比与 3 个既有 PNG 导出用例 `BLOCKED`；(2) 首轮 Go 模块缓存/代理障碍曾致逐 spec E2E 0 用例执行，缓存经 `goproxy.cn` 预热修复后已重跑 19 spec / 139 用例（125 passed / 14 failed，均 SKIP/BLOCKED，见 A10.3 补记）；(3) 修复 helper 后的完整截图 spec 重跑 4 次被 WorkBuddy 运行时 shim（`Brokered host mkdir` / `[safe-delete]` 批量保护）拦截，未完成修复后通过复跑；(4) B 批 `NOT_AUTHORIZED`。**待 Chrome 156 / Node 24 与无 shim 环境补跑后可复议 `VERIFIED`**；本轮按 FP-00 `:24` 与 A10.5 逐字标记实际阻塞状态。

#### FP-14 写回与未闭合 gap

- **FP-05 文案写回（Ruling 63）**：`mode="replace"` 保留既有交互契约与 `aria-label="选用 ${title}"`；「确认按钮写作「替换背景」」的可见文案偏差未实现，按 Ruling 63 记为 **FP-14 spec 写回项**，不是 A06 阻塞项。写回建议：后续授权任务统一可见文案并同步 full-flow / admin-catalog 回归。
- **Ruling 121 未闭合 gap（Ruling 159）**：`apps/admin/src/features/projects/ProjectDeletionQueue.tsx` 的 `pageAfterShrink` 仍只判 `q.data`、缺成功门禁 + 第 2 页 500 失败注入 E2E。风险：后台删除队列第 2 页返回 500 时仍可能用陈旧 `data` 校正页码；3 条既有成功缩页 E2E 在 A08 实现者与控制器终验均为 green，属**代码层缺口而非已证实产品缺陷**。A10 按 Ruling 159 **不改该产品代码、不新增该文件的 E2E**，在 FP-09 矩阵行列为未闭合 gap，后续归属单独授权任务。
- **其它写回/待处理项**：A04 具名「更多」DOM 入口与真实 `title` 属性、A04 FP-01 `border-color` 独立断言、A06「没有素材 / 分页错误 / 重新选择」「返回来源 / 空目录 / 飞行中舍弃」分支断言（Ruling 72/74）、A09 brand E2E 未断言 `navBlocked` 与 §11.2 回退命令逐字记录 —— 均按 FP-14 :166「验收矩阵缺项、旧测试误命中或仅截图无法证明交互时记录为待处理」。
- **仅截图无法证明交互**：五档 PNG 矩阵（34 张）记录代表状态，交互正确性以断言与逐 spec E2E 为准；本轮已重跑 139 用例，14 个 SKIP/BLOCKED 与像素级人工目视项待补，不作为通过证据。

#### 证据目录与隐私核对（Ruling 168）

- **证据根目录**：`.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/evidence/`（相对仓库根）。该目录被 `.gitignore:1` 的 `.superpowers/` 忽略，故提交后 `git status --porcelain=v1` 仍只剩既有 10 个顶层 `??` 条目；属 Ruling 168「等价可访问路径」。若需在仓库内另存可访问副本，可重放（本轮**不执行**，以免新增未跟踪目录）：
  ```sh
  cp -R .superpowers/sdd/2026-11-06-antd-remediation-a-implementation/evidence/screenshots \
        docs/verification/screenshots/2026-11-10-antd-remediation/
  ```
  大体量 PNG **不提交**（避免仓库膨胀），但可重放命令齐备，满足 spec :142「记录相对路径、生成命令和必要的校验值」与 :143「不要把忽略目录设为唯一交接来源」（已跟踪文档内已有契约重述）。
- **生成命令**：`evidence/run-a10-e2e.sh`（首轮，环境阻塞证据）、`evidence/run-a10-e2e-rerun.sh`（缓存修复后重跑 19 spec / 139 用例）、`evidence/run-a10-ub-clean.sh`（修复 helper 后截图 spec 第 4 次重试）、`evidence/go-mod-warmup.log`、`evidence/verify/verify.log`、`evidence/a10-changes.patch`（A10 改动范围 + `git apply --check -R` 可逆对照）；三入口审计命令见 A10.3。
- **文件清单**：`verify/verify.log`、`e2e-index.log` / `e2e-rerun-index.log`、各 `<suite>.log` / `<suite>.rerun.log`、`guards*.log`、`ui-baseline.*.log`、`results/` 各栈、`screenshots/*.png`、`web/` `admin/` `renderer/` 构建产物、`entry-boundary.log`、`vite-*.log`、`a10-changes.patch`。
- **尺寸与 SHA-256**：固定导出样本本轮 `BLOCKED` 未生成（无尺寸/SHA-256）；`evidence/screenshots/` 本轮产出 **34 张真实 PNG**（五档覆盖：`d-` 1440×1000 ×11、`m-` 780×1688 ×11、`t1-` 1024×768 ×4、`t2-` 768×1024 ×4、`n3-` 640×1400 ×4），五档代表性截图的尺寸与完整 SHA-256 见「A10.3 补记」表格，报告 §11 有 34 张完整清单；可重放 `shasum -a 256 evidence/screenshots/*.png`。关键日志与脚本 SHA-256 见报告 §11。
- **隐私**：证据仅含合成 seed 数据（`ui_baseline` 测试账号、`a secure test password`、`fastposter-test-only-password`、合成背景「共享风景」/「晨雾山谷」、合成文案「山海之间」等）；**不含业务图片、真实密码、一次性令牌、真实用户内容**。密码重置令牌按 FP-10 只存内存，不进日志/截图/trace。
- **`/tmp/fp-a0*-*` 历史证据清单**（仅登记路径与用途，不复制入仓库）：`/tmp/fp-a04-evidence/`（A04 三张视觉证据 PNG）、`/tmp/fp-a05-ctrl-*`（A05 控制器 E2E）、`/tmp/fp-a06-ctrl-*`（A06 控制器 E2E）、`/tmp/fp-a07-*`（A07 证据）、`/tmp/fp-a08-*`（A08 证据）、`/tmp/fp-a09-red-*` / `fp-a09-green-*` / `fp-a09-fix-*` / `fp-a09-ctrl-*`（A09 验证/修复/终验）、`/tmp/fp-a10-precheck-contracts.log`（控制器 `contracts:check` 预检，exit 0）。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致 —— **A10.2 已核对并处置**：`packages/poster-editor/src/panels/color-presets.ts` 实测 `grep -c "value:"` = **116** 个预设色条目；`README.md` 功能段已由「24 种预设文字颜色」更正为「116 种」并注明定义文件。此项闭合。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明 —— **A10.2 已补齐**：`AGENTS.md` 新增「Ant Design 前端约定（A 批迁移后，FP-12）」、`README.md` 新增「Ant Design 界面契约与视觉证据」、`deploy/toolchain.lock.json` 补 `selected.antd = "6.7.0"` 与 `chromePath` / `chromeEnvironmentNote`；12 项主题逐字值见本记录「A10.2 维护契约逐字重述」。此项闭合。
