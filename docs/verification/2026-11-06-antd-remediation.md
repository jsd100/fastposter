# Ant Design 迁移后修正 — A/B 批共用执行记录

> 本文记录当时的设计或验收基线。当前默认主题、页面布局和开发约定见[前端验收](2026-11-13-antd-default-appearance.md)及 [AGENTS.md](../../AGENTS.md)。

创建于 A01 阶段（实际补建于 A02 开工前，见「遗留与裁定」）。**引用完整性说明（Ruling 158）**：

- 以下 4 份规范与计划是 A/B 批执行时的输入，已随 `a86d9ab` 纳入版本控制：
  - 规范：`docs/superpowers/specs/2026-11-06-antd-post-migration-remediation-design.md`（FP-00 … FP-14）
  - A 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-a-implementation.md`
  - B 批计划：`docs/superpowers/plans/2026-11-06-antd-remediation-b-implementation.md`
  - 原始布局规范：`docs/superpowers/specs/2026-11-05-antd-layout-design.md`（UI-06、UI-08、UI-09）
- 基线：`124b4ea5d2dc7b1b58183749a393a3c4759fe47b`（`124b4ea`）；`docs/verification/2026-11-05-antd-migration.md` 是**已跟踪**的历史验收记录。
- **交付 A 批时，实施必需契约已在本记录「A10.2 维护契约逐字重述」、当时的 `AGENTS.md`、`README.md` 与 `deploy/toolchain.lock.json` 中重述**（色板、字号/控件高度/触控目标/对比度、四个断点、五档尺寸、`antd@6.7.0`、共享 `UIProvider`、renderer forbidden 边界、截图/导出采样开关、逐文件临时栈、预构建 renderer、Chrome 差异、`pnpm verify` 组成），从而消除「新检出无法解析引用」。依据 spec FP-12 `:143`「不要把忽略目录设为唯一交接来源」与 plan :188 的「或」路径；本轮不 `git add` 任何 `??` 文档。
- 逐任务的流水与评审包另见执行账本 `.superpowers/sdd/2026-11-06-antd-remediation-a-implementation/`（git 忽略，仅本机证据）；B 批计划仅引用，不执行。

## 当前状态

```yaml
batch: A
status: VERIFIED
authorization: "2026-11-06 用户：深度分析后继续该任务；并转述前序建议『先执行 A 批，逐任务独立评审』；2026-11-13 用户『继续执行 未执行清单 内容』授权 A10.4 再基线化与批次级复议（Rulings 312-316）"
execution_mode: subagent-driven-development (fresh implementer + task reviewer per task)
workspace: "/Users/aaa/acode/FastPoster" (in-place, no linked worktree)
branch: feat/fastposter
review_baseline: "124b4ea5d2dc7b1b58183749a393a3c4759fe47b"
execution_baseline: "71257c3"
last_verified_commit: "55ccf59" (2026-11-13 controller final gate on HEAD 55ccf59; A batch's own last product commit remains 4610e25 — A10 had no product code changes, the new value reflects the verified HEAD including EXPORT-DIAG)
task: A10
next_step: "A10 done and controller-final-verified; A batch stays IN_PROGRESS. Only remaining blocker: re-run A10.4 fixed PNG sample pixel comparison and the 3 pre-existing PNG export cases in a matching Chrome 156 / Node 24 environment, then re-review VERIFIED. The post-helper-fix full screenshot spec was re-run by the controller (10 passed / exit 0, 37 PNGs), so that shim concern is CLOSED. B batch was separately authorized on 2026-11-11 and B01 is complete (see the B section); B02/B03 still require a further explicit go-ahead. [A10-era wording retained for provenance: B02/B03 were in fact authorized and COMPLETE on 2026-11-12. The Chrome-156 attribution in this line was disproved on 2026-11-13 — root cause is host Chrome sandbox initialization; see A10.4-R and the EXPORT-DIAG section.] 2026-11-13 RECONCILIATION: the batch verdict was re-reviewed and set to VERIFIED after A10.4-R, the full E2E matrix, the locked Node 24 regression and a 14/14 final gate — see the last section of this document."
spec_ids: [FP-12, FP-13, FP-14]
actual_paths: ["apps/admin/src/main.tsx", "apps/admin/src/AdminLayout.tsx", "apps/admin/src/features/Metadata.tsx", "apps/admin/src/features/Resources.tsx", "apps/admin/src/features/copy/CategoryTree.tsx", "apps/admin/src/features/copy/CopyPage.tsx", "apps/admin/src/features/templates/TemplateEditor.tsx", "apps/admin/src/features/templates/TemplateList.tsx", "apps/web/src/features/catalog/BackgroundPicker.tsx", "apps/web/src/features/catalog/CopyPicker.tsx", "apps/web/src/features/templates/TemplatePicker.tsx", "packages/api-client/src/catalog-pages.ts", "packages/api-client/src/catalog-pages.test.ts", "packages/api-client/src/index.ts", "tests/e2e/admin-catalog.spec.ts", "tests/e2e/admin-layout.spec.ts", "tests/e2e/copy.spec.ts", "tests/e2e/templates.spec.ts", "apps/web/src/features/projects/ProjectsPage.tsx", "apps/web/src/features/projects/collection-position.ts", "apps/web/src/features/projects/collection-position.test.ts", "apps/web/src/features/projects/useProjectDeletion.ts", "apps/admin/src/features/Metadata.tsx", "apps/admin/src/features/Resources.tsx", "apps/admin/src/features/templates/TemplateList.tsx", "apps/admin/src/features/copy/CopyPage.tsx", "apps/admin/src/features/projects/pagination.ts", "apps/admin/src/features/projects/pagination.test.ts", "tests/e2e/projects.spec.ts", "tests/e2e/admin-catalog.spec.ts", "tests/e2e/templates.spec.ts", "tests/e2e/copy.spec.ts", "AGENTS.md", "README.md", "deploy/toolchain.lock.json", "docs/verification/2026-11-06-antd-remediation.md", "tests/e2e/ui-baseline.spec.ts"]
red: ["A09 RED（真实基线 8c900f2）: R3 admin-layout 3 failed / 1 passed —— 延迟重置后 dialog 不可见、5xx 与网络中断无「结果未确认」；R4 copy 2 failed —— Expected: \"1:100|2:100\" / Received: \"1:100\"、缺可见子级 option；R5 admin-catalog 与 R6 templates 各 1 failed（只读首页）。R1 Cannot find module 与 R2 TS2307 如实标为接口缺失、不计产品行为 RED；known reset failure 基线即 GREEN 标为 regression guard", "A09 修复轮 RED（真实未修复产品代码 51d6651）: admin-layout -g reset result survives brand link and browser history navigation 2 failed，两条均在导航后 getByRole(dialog) element(s) not found（:696 / :715），证明 brand 与 popstate 会卸载令牌 UI", "A08 E2E RED（真实基线 01f2f6e）: 第 2 页 500 后错误块消失、页码弹回第 1 页（projects.spec.ts:603，控制器纯基线复核为 :605，Expected visible / element(s) not found）；改名冲突无冲突 UI（:814，控制器复核 :808）；后台背景/模板/文案第 2 页删末行后空态锁死、无 page=1 请求（Expected true / Received false）；契约单测 4 个新符号 is not a function", "A08 控制器独立基线复核：837 行产品补丁 git apply -R（REVERSE_CHECK_OK / REVERSE_APPLIED），两个关键 RED 在纯基线产品代码上 exit 1，恢复后 HEAD 579c771、索引与工作树干净", "A08 诚实记录：deleting final second-page row returns to page one 在基线即 GREEN，标为回归守卫而非红灯", "A10: no product RED claimed — five-width guards are baseline-GREEN regression guards on 3b61d53 (Ruling 169); GOPROXY-off empty Go cache, proxy 502 and runtime shim failures are explicitly excluded as environment blockers"]
green: ["A09 控制器独立复跑（HEAD 4610e25）: pnpm typecheck exit 0、pnpm test 32 文件 / 218 用例 exit 0、catalog-pages.test.ts 9/9 exit 0", "A09 控制器终验 28 个 E2E 全部 exit 0：新增/相关 14（brand+popstate 2、三条命名、失败与结果不明 3、admin-layout 既有 4、后台完整树 1、模板失败重试 1）+ A01-A08 跨任务回归 14，各命令独立临时栈、GOPROXY=off GOSUMDB=off、--output /tmp/fp-a09-ctrl-*、互斥 -g 分栈", "A09 实现者提交前：renderer build、typecheck、218/218、9/9、4 栈新增 E2E 8 passed、四个 spec 的 12 个非 PNG 既有用例全 GREEN、Prettier 全 18 文件合规", "209/209 单测（31 文件）", "pnpm typecheck exit 0", "聚焦 vitest 3 文件 / 18 tests", "Prettier --check 全通过", "5 栈 E2E 9 passed（3 命名 + 3 后台缩页 + 3 既有缩页回归）", "控制器独立复跑 18 个 E2E 全部 exit 0（9 验收/回归 + 9 跨任务回归）", "A10 controller final verification (HEAD 80badcc): contracts:check / typecheck / pnpm test 218-218 / pnpm build turbo 8-8 all exit 0; five-width guards 5 passed (16.4s); full FP_UI_BASELINE=1 ui-baseline spec 10 passed / exit 0 with 37 PNGs; 3 login-throttle cases re-run under mutually exclusive -g stacks all exit 0; A01/A05/A07/A08 cross-task regressions 6 cases all exit 0; git apply -R pure-baseline comparison on 3b61d53 product state reproduces the PNG failure at the same assertion (exit 1), proving it predates A10"]
decisions: ["Ruling 124-140 A09 单任务授权/基线 8c900f2/严格文件边界/会话容器置于 main.tsx/Dialog onClose 守卫与 closable/导航 preventDefault 与会话失效例外/令牌生命周期/结果不明分类/复制与完成/合成令牌与隐私证据/loadCatalogPages 精确规格/全调用点与不公布残缺树/公开根提升与后台不完整/E2E 分配与请求序列/RED 诚实与 PNG-safe/62 项 Minor 延迟/A05-A08 携带项/验证集与聚焦提交", "Ruling 141-149 A09 评审裁定：I-1 brand 与 popstate 绕过导航锁定确认为 Important，Ruling 128 澄清为机制描述、FP-10 spec 优先；修复策略为结构性保持 UsersPage 挂载 + brand 守卫，不改 packages/ui；M-1/M-2 延迟；Ruling 145 批准 test.use 文件级偏差；W-3/W-4/W-5/W-6 闭合；W-7 由控制器终验闭合", "Ruling 150-155 A09 终裁：定向复评审 8/8 ADDRESSED、I-1 ADDRESSED、无新 Critical/Important、无越界，修复轮 1 闭合；两个 ⚠️ 裁为 Minor 延迟；累计 66 项 Minor；A09 完成（两产品提交 51d6651 + 4610e25）", "Ruling 9 移除 matchMedia 运行时订阅", "Ruling 17-21 A02 修复轮裁定", "Ruling 23 PNG 导出 SKIP", "Ruling 24-30 A03 修复轮裁定", "Ruling 31 429 中断后按原节奏续跑 A04", "Ruling 34-42 A04 修复轮裁定", "Ruling 44 「继续」仅授权 A05", "Ruling 45-53 A05 边界/失败分类/诚实标准裁定", "Ruling 54-55 A05 DONE_WITH_CONCERNS 处置", "Ruling 56-60 A05 评审 ⚠️ 逐项裁定与 Minor 延迟", "Ruling 61 两条消息合并授权 A06 且中断无中间状态", "Ruling 62-68 A06 基线/文件边界/替换模式契约/携带项裁定", "Ruling 69-74 A06 评审 6 项 ⚠️ 逐项裁定", "Ruling 75 A06 8 项 Minor 延迟", "Ruling 76-89 A07 单任务授权/基线/替换范围/antd Button loading 英文播报矛盾/reduced-motion/业务边界/清点/环境 SKIP/诚实标准", "Ruling 90-101 A07 评审裁定、修复轮、终验与完成", "Ruling 102-116 A08 单任务授权/基线 01f2f6e/严格文件边界/沿用纯函数/成功与查询身份门禁/失败保留本页与重试/后台四列表补齐与清单外 gap/改名冲突完整状态机/三条命名 E2E 与请求序列/PNG-safe/RED 诚实/56 项 Minor 延迟/A05-A09 携带项/验证集", "Ruling 117 FP-09「发现版本变化」按 409 REVISION_CONFLICT 响应式处理，A10 矩阵须注明", "Ruling 118-120 三项 ⚠️ 由控制器终验与 git apply -R 纯基线复核闭合", "Ruling 121 admin ProjectDeletionQueue.tsx 成功门禁缺口确认转 A10", "Ruling 122 A08 6 项 Minor 延迟（累计 62 项）", "Ruling 123 A08 完成（无修复轮、无新增环境 SKIP）", "Ruling 171-182 A10 controller final adjudication: independent review Spec OK / Approved with 0 Critical / 0 Important / 3 Minor / 3 cross-task warnings; W1 W2 W3 all CLOSED by controller measurement; M1 documentation error corrected; M2 deferred Minor; M3 judged accurate; A batch stays IN_PROGRESS (Ruling 160)"]
artifacts: [".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A09-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A09-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-8c900f2..51d6651.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-51d6651..4610e25.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A08-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-01f2f6e..579c771.diff", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A10-brief.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/task-A10-report.md", ".superpowers/sdd/2026-11-06-antd-remediation-a-implementation/review-3b61d53..80badcc.diff"]
blockers: ["[A10-era historical — superseded 2026-11-13] Chrome 157.0.8103.51 vs locked 156.0.8078.48, Node v22.22.2 vs 24.21.0 — A10.4 fixed PNG sample pixel comparison and the 3 pre-existing PNG export cases (admin-catalog.spec.ts:11/:111, templates.spec.ts:274) were BLOCKED (Ruling 160). The version-mismatch attribution was disproved: both Chrome 157.0.8103.78 and official CfT 156.0.8078.47 abort with the same host sandbox-initialization failure without --no-sandbox. A10.4 has since been executed under the corrected contract (A10.4-R); these blockers are CLOSED, not merely re-labelled.", "First per-spec E2E pass (empty /tmp/fastposter-gomod + GOPROXY=off + proxy 502) ran 0 cases; cache warmed via goproxy.cn and the full 19-spec suite re-ran 139 cases / 125 passed / 14 failed (11 Chrome-157 PNG exports + 3 single-stack login-state URL timeouts, all SKIP/BLOCKED, not A10 regressions)", "[A10-era historical — superseded] B batch NOT_AUTHORIZED (B03.3 threshold); A batch IN_PROGRESS — re-review VERIFIED only after a matching Chrome 156 / Node 24 re-run. B01/B02/B03 were authorized and completed 2026-11-11/12; the Chrome-156 precondition was replaced by the corrected host-sandbox contract on 2026-11-13 (EXPORT-DIAG)."]
open_verification_items: ["A09 Ruling 145：tests/e2e/admin-layout.spec.ts 文件顶层 test.use({trace:'off', screenshot:'off'}) —— Playwright 不允许 describe/test 级设置，属获批偏差；A10 须在验证矩阵记录，且不得声称该 spec 的 4 个既有用例拥有视觉失败证据", "A09 新增 4 项 Minor 延迟（累计 66 项）：M-1 loadCatalogPages 用原始累加而非去重累加判断停止（结果等价）、M-2 unknown 态未纳入 locked 可被 Escape 关闭、brand E2E 未断言 navBlocked 可见提示且无法区分双层守卫、§11.2 未逐字记录产品代码回退命令（RED 日志实体已反证）", "A09 3 个既有 PNG 导出用例 SKIP：admin-catalog.spec.ts:11/:111、templates.spec.ts:274，由 git apply -R 纯基线对照（12 个 tracked 产品文件、HEAD/索引未变、dev server 实时编译）证明先于本任务；属 Chrome 157 vs 锁定 156，A10 须在匹配环境重跑；A09 不因此标为完全 VERIFIED", "A09 /tmp/fp-a09-red-*、/tmp/fp-a09-green-*、/tmp/fp-a09-fix-*、/tmp/fp-a09-ctrl-* 证据待 A10 汇总落盘；本轮无新增环境 SKIP，所有新增 E2E 均 PNG-safe", "A08 Ruling 121：apps/admin/src/features/projects/ProjectDeletionQueue.tsx 的 pageAfterShrink 仍只判 q.data、缺成功门禁（清单外未改）。A10 须补门禁 + 第 2 页 500 失败注入 E2E；3 条既有缩页回归在 A08 终验仍全绿", "A08 Ruling 117：FP-09「或发现版本变化」由 SaveProject 409 REVISION_CONFLICT 响应式触发，未做提交前主动 GetProject 探测（FP-12 明确列表摘要契约非本轮所需）。A10 的 FP-09 验收矩阵须写明「版本变化经 409 检测」", "A08 评审 6 项 Minor 延迟（累计 62 项）：4 处同构 admin 校正 useEffect 建议抽 useAdminPageCorrection hook（优先候选）、fetchStatus 类型过宽、resultIdentity 近恒真比较、删除队列与 4 个后台门禁无失败注入 E2E、baseline-GREEN 缩页用例、两处 waitForTimeout", "A08 新增 /tmp/fp-a08-* 测试证据待 A10 汇总落盘；本轮无新增环境 SKIP，所有新增 E2E 均 PNG-safe", "Chrome 157 vs 锁定 156：export.spec.ts 2 个 + editor-fonts.spec.ts 2 个 PNG 导出用例标 SKIP，A10 须在匹配环境重跑；A03 不因此标为完全 VERIFIED", "A05 环境 SKIP：templates.spec.ts 的 administrator publishes a template… 在 line 350 导出步骤失败；A05 基线对照证明先于 A05", "A06 新增/复核共 5 处 PNG 导出 SKIP：admin-catalog.spec.ts:100（实现者基线对照）、admin-catalog.spec.ts:242、full-flow.spec.ts:201、image-upload.spec.ts:67、templates.spec.ts:350；后四处由控制器用 456 行产品补丁 git apply -R 做纯基线对照，均在完全相同行失败，证明先于 A06、非产品回归。A10 须在 Chrome 156 重跑；A06 不因此标为完全 VERIFIED", "A06 评审 ⚠️：FP-13 FP-05 行的「没有素材 / 分页错误 / 重新选择」无 A06 新增断言，A10 矩阵补；「返回来源」/空目录/飞行中舍弃分支同样无断言（Ruling 72/74）", "FP-05 「替换背景」可见确认按钮文案按 Ruling 63 未实现（保留「选用 X」旧契约以维护 full-flow / admin-catalog 回归），按 FP-14 写回规格，A10/后续任务评估", "A06 评审 8 项 Minor + A01-A05 累计 45 项 Minor（共 53 项）推迟全分支评审；其中 clearInvalid 未 refetch q.data 导致改版后重选可能重复同一错误、须改筛选或重开选择器恢复，列为全分支评审优先候选（Ruling 75）", "FP-13 「注入上传失败」由既有 notifications.spec.ts 回归用例覆盖并重跑通过，无 A05 新增最小失败用例（Ruling 57），A10 矩阵复核", "A04 三张视觉证据 PNG 位于 /tmp/fp-a04-evidence/，A10 须落到受控路径；A05/A06/A07 的 /tmp/fp-a0*-* 测试证据同样需 A10 汇总", "A07 修复轮新增环境 SKIP：admin-catalog.spec.ts:242 下载原尺寸 PNG；实现者用 git apply -R 纯基线对照证明在 795da03 同一行同样失败（RESTORE 一致、HEAD/索引未变），前置 ResourcesPage 断言全过，非产品 RED，A10 重跑", "A07 评审 3 项 Minor 延迟（累计 56 项）：目录「文案」等待未断言、· admin 第二步三条近恒真断言已按 Ruling 95 标注为 regression guard、Ruling 85 字面张力已由 Ruling 90 澄清", "A07 全入口清点第 27 行（Resources.tsx 首屏网格 Skeleton）与五类状态 antd 组件表已写入报告 §11.6，A10 汇总 FP-02 验收矩阵时引用", "Ruling 90：Ruling 85 的字面要求「把进度说明切到 Button busy」与 TemplatePicker 实际 DOM 结构不符，控制器裁定保留现状；若后续要物理移入按钮内部，属独立小修", "A10 controller final verification: A10.4 fixed PNG sample pixel comparison and Chrome-156 PNG re-runs remain BLOCKED (Ruling 160); A10 M2 deferred Minor (three new widths lack independent settings/loading/failure screenshots, accepted under Ruling 162 discretion); deferred Minor total 66+1=67; FP-14 write-backs and Ruling 121 ProjectDeletionQueue gap remain open; B batch NOT_AUTHORIZED"]
```

B 批状态（**A10 时点历史，保留原文以存证**）：`AUTHORIZED (2026-11-11 用户明确选择『授权 B 批，从 B01 开始』)`；B01 已完成并经控制器终验，详见下方「B 批 · 任务分区」。按单任务惯例 B02/B03 仍为 `NOT_AUTHORIZED`，需再次明确授权；FP-11 涉及 IDL、生成代码与服务端事务。**订正（2026-11-13）**：B02/B03 已于 2026-11-12 分别获用户「继续」授权并 `COMPLETE`，B 批三个任务全部完成，详见「B 批 · 任务分区」；A10.4 的 Chrome-156 归因亦已订正，见文末「EXPORT-DIAG」章节与 A10.4-R。

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
- 新增三档 `tablet landscape 1024x768`（前缀 `t1-`）、`tablet portrait 768x1024`（前缀 `t2-`）、`mobile 320x700`（前缀 `n3-`），经文件内新增的 `captureWidthStates()` 覆盖 **5 个代表状态**：`${prefix}-01-login`、`-02-projects`、`-03-template-picker`、`-04-editor`、`-05-admin-login`。其中 admin 侧**仅拍登录页**，避免共享栈重复提交后台登录触发注册限流；原两档 `d-` / `m-` 截图已覆盖后台表单、后台壳层、文案库与背景库浮层。每档 5 张、三档合计 15 张；控制器终验在最终代码上跑出 **37 张完整五档截图**（原两档 22 + 三档 15）。**未引入完整 PNG 导出步骤**（Ruling 137/162），未改 `tests/e2e/helpers.ts`。
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

#### A10.4 固定导出样本像素对比与 Chrome-156 PNG 重跑 — BLOCKED（A10 时点历史，归因已订正）

> **2026-11-13 订正（Rulings 313/314）**：本节完整保留 A10 当时的 `BLOCKED` 结论以存证，但其归因「Chrome 157 vs 锁定 156」**事实错误**。真实根因是宿主不允许 Chrome 子进程初始化沙箱（`sandbox initialization failed: Operation not permitted` → `GPU process isn't usable. Goodbye.` → `signal: trace/BPT trap`）；官方 CfT `156.0.8078.47` 在不带 `--no-sandbox` 时逐字复现同一失败，因此「换 Chrome 156」既非根因也非充分条件。修正后的契约与 **本轮真实执行结果** 见紧随的 **A10.4-R** 与文末 **EXPORT-DIAG** 章节。

- **环境缺口（Ruling 160，历史记录）**：本机实测 Chrome `157.0.8103.51` ≠ `deploy/toolchain.lock.json:8` 锁定 `156.0.8078.48`；Node `v22.22.2` ≠ 锁定 `24.21.0`；Chrome 156 可执行文件不存在。固定导出样本像素对比与基线 `124b4ea` 单独临时工作区采样**无法在匹配环境完成** → 标 **`BLOCKED`**。本轮**未执行** `magick compare`、**未伪造**输出、**未引用**历史 `docs/verification/2026-11-05-antd-migration.md:415` 的 `0 (0)` 当本轮结果。
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
- 导出样本 PNG 本轮**未生成**，故无尺寸/SHA-256；代表性截图的尺寸与 SHA-256 见「A10.3 补记」与「证据目录与隐私」。（以上为 A10 时点记录；2026-11-13 的 A10.4-R 已真实生成两侧样本并记录尺寸/SHA-256。）

#### A10.4-R 固定导出样本像素对比（新契约，2026-11-13）— PASS

**授权与契约**：用户 2026-11-13「继续执行 未执行清单 内容」显式授权治理项 reconciliation 与 A10.4 再基线化，控制器以 Rulings 312–316 记录：解除 Rulings 295/306 的文档禁改限制、订正归因、把验收前提从「匹配精确 Chrome `156.0.8078.48`」改为「同一官方 CfT `156.0.8078.47` + 两侧均带 `chromedp.NoSandbox` + 同一合成文档/字体/ImageMagick」。`156.0.8078.48` 在官方 Chrome-for-Testing feed 中 **0 条**，不可得，如实记为环境缺口而非产品缺陷；`.47` 为同通道最近版本。

**基线侧构造（不建 linked worktree、不改 HEAD/索引/工作区）**：`git archive 124b4ea | tar -x -C /tmp/fp-a104-20261113/baseline`，复制 `.env.local`，把 `node_modules`（根与 7 个工作区包）从跨目录符号链接改为真实目录（内部条目仍为 pnpm 相对链接），设 `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` 供 pnpm 在临时根目录运行。**唯一产品代码差异**为 `server/internal/exports/renderer.go` 一行环境适配补丁：

```diff
-opts = append(opts, chromedp.ExecPath(r.ChromePath), chromedp.Flag("hide-scrollbars", true), chromedp.Flag("force-color-profile", "srgb"))
+opts = append(opts, chromedp.ExecPath(r.ChromePath), chromedp.NoSandbox, chromedp.Flag("hide-scrollbars", true), chromedp.Flag("force-color-profile", "srgb"))
```

该补丁只改 Chrome 启动参数、不触碰渲染逻辑；没有它基线侧在本宿主上无法启动 Chrome。两侧各自 `pnpm --filter @fastposter/renderer build`，产物同为 `dist/assets/index-tKLq5HrC.js`（119 modules），证明 renderer 前端源码在 `124b4ea` 与 HEAD 之间未变。

**本轮真实命令与结果**（`CHROME_PATH` 指向 CfT `156.0.8078.47`，`GOPROXY=off GOSUMDB=off`，`FASTPOSTER_CHROME_SANDBOX` 未设置，每次独立临时栈）：

| 侧                            | 命令                                                                                                                                                                                                                       | 结果                        | 样本                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------- |
| 基线 `124b4ea` + 环境适配补丁 | `FP_EXPORT_BASELINE_PATH=/tmp/fp-a104-20261113/samples/baseline.png pnpm test:e2e tests/e2e/export.spec.ts -g 'flushes latest edits and previews the exact native PNG available for download' --output …/results/baseline` | `1 passed (14.4s)` / exit 0 | `baseline.png` 56419 B |
| 当前 HEAD `55ccf59`           | 同上，路径 `samples/current.png`、`--output …/results/head`                                                                                                                                                                | `1 passed (10.8s)` / exit 0 | `current.png` 56419 B  |

```text
magick compare -metric AE baseline.png current.png null:   → 0 (0)   exit 0
cmp baseline.png current.png                              → identical
shasum -a 256: 两图均 f36c78f99c2d354c6dd2c4ee8f02cc645ee4988c9b03701c6af227d674c19e85
identify:      两图均 PNG 1200x1600 8-bit sRGB 56419B
```

**版本无关性交叉验证**：把 `CHROME_PATH` 改为本机系统 Chrome `157.0.8103.78`，在 HEAD 侧以同样用例复采 `current-chrome157.png` → `1 passed (9.4s)` / exit 0；SHA-256 仍为 `f36c78f9…`，`magick compare -metric AE` 对 `baseline.png` 仍为 `0 (0)`。CfT 156 与系统 Chrome 157 产出**字节相同**的固定样本，实验上排除「Chrome 版本差异导致像素变化」，也反向印证 Ruling 313 的宿主沙箱归因。

**诚实口径**：`docs/verification/2026-11-05-antd-migration.md:415` 的历史 `0 (0)` 与 `f36c78f9…` **未被当作本轮证据**；本轮独立采样后数值恰与历史一致，属真实复现而非引用。精确 `156.0.8078.48` 仍不可得，但既有 blocker 的因果关系已被推翻，故不再构成验收阻塞。A10.4 在新契约下判 **`PASS`**；3 个既有 PNG 用例在 EXPORT-DIAG 已真实 PASS，其余用例与全量矩阵见文末 EXPORT-DIAG 章节。

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

#### A10 控制器终验与终裁（2026-11-11，Rulings 171-182）

**恢复与授权**：用户 2026-11-11「请接着之前中断的任务继续执行」。中断点无残留：HEAD `80badcc`、索引与工作树干净、仅 10 个顶层未跟踪用户资产；A10 实现者提交 `80badcc`（5 文件 / +445/-20）、报告 §1-§12 与 75,351 字节评审包齐备。此前独立评审因推理模型配额 402 未派发成功，控制器改用默认模型重派同一评审提示词，**评审独立性未受损**（Ruling 171）。

**独立评审结论（Ruling 172）**：`Spec ✅ / Task quality Approved`，**0 Critical / 0 Important / 3 Minor / 3 ⚠️**。11 项必核条目全部落在 A10/FP-12/13/14 授权与 Ruling 157 文件边界内，无越界、无伪造、A 批未误标 `VERIFIED`。评审者读取 brief 全文、75 KB 完整 diff、报告全文，并做了 `git show` / `git diff` / JSON / YAML / 矩阵行数 / shoot 名称 / evidence 实体抽查等具名定点核查，未跑测试、未改文件、未跑 git 写操作。

**三个 ⚠️ 由控制器实测全部闭合**：

| 项 | 评审判定 | 控制器终验实测 | 裁定 |
| --- | --- | --- | --- |
| W1 提交但未验证的 helper | ⚠️ 最接近 Important，取决于控制器是否设「提交代码必须已跑通」硬门槛 | 在**最终代码 `80badcc`** 上：`-g 'five-width layout guards'` → **5 passed / 16.4s / exit 0**；`FP_UI_BASELINE=1` 完整截图 spec → **10 passed / exit 0 / 1.3m**（原 2 档 capture + 新增 3 档 capture + 5 守卫全绿），产出 **37 张完整五档截图** | **CLOSED**（Ruling 173）。实现者 4 次 shim 失败属运行时上下文相关的环境阻塞，非产品缺陷；A10.1 五档视觉证据成立，不需修复轮 |
| W2 `git apply -R` 未实际反向重跑 | ⚠️ 不构成 Important（A10 零产品代码改动，逻辑已充分） | 用评审包 `review-3b61d53..80badcc.diff` 做**纯基线对照**：`git apply -R` exit 0、HEAD 仍 `80badcc`、trap 恢复后工作树干净；在 `3b61d53` 产品状态下 `admin-catalog.spec.ts:11` PNG 用例仍 **exit 1** 且在同一 `getByRole('link',{name:'下载原尺寸 PNG'})` 断言失败 | **CLOSED**（Ruling 174）。11 个 PNG 失败先于 A10。另澄清：实现者的 `evidence/a10-changes.patch` 是**提交前工作树 diff**，HEAD 前进后已不可逆（现测 `--check -R` exit 1），属时序而非伪造；控制器以评审包重做补正 |
| W3 证据实体核查范围 | ⚠️ 无法从材料判定，交控制器 | 19 个 `<suite>.rerun.log` 逐行数字与报告 §5 表**逐行一致**（139 用例 / 125 passed / 14 failed，11 PNG + 3 登录态）；`evidence/screenshots/` 实测 34 张 PNG；`d-01-login.png` = `593dbb2f…`、`n3-01-login.png` = `2ea7a7a7…` 与报告 §11 完全吻合 | **CLOSED**（Ruling 175） |

**额外复核（Ruling 176）**：3 个登录限流用例按**互斥 `-g` 分栈**各 1 passed / exit 0（`brand link keeps the one-time token`、`browser history keeps the one-time token`、`closed select values share the trigger center`），证实实现者的 `SKIP` 归类正确、属单栈注册限流而非产品回归；A01 缩减动效、A05 创建重试、A07 加载态 ×2、A08 分页 ×2 共 **6 例跨任务回归全绿**。

**控制器静态复核（Ruling 177）**：串行重跑 `contracts:check` / `typecheck` / `pnpm test` **218/218** / `pnpm build` **turbo 8/8** 全部 exit 0；`toolchain.lock.json` JSON 合法；`prettier --check` 对 `ui-baseline.spec.ts` / `README.md` / `toolchain.lock.json` 三个 A10 改动文件通过。`AGENTS.md` 的 prettier 差异落在 `:35-47` **原有构建命令表**（仓库既有格式，非 A10 新增内容），按 AGENTS.md「避免无关的全仓格式化」不重排，判为**既有基线偏差、非 A10 缺陷**。

**3 项 Minor 裁定**：
- **M1 — CLOSED（Ruling 178）**：原 A10.1 段声称 `captureWidthStates()` 覆盖「文案库浮层、后台登录/壳层」，与提交代码不符（实际 5 个 shoot、admin 仅拍登录页）。本段已按代码实际更正，并补记控制器终验的 37 张截图口径。
- **M2 — 延迟 Minor（Ruling 179）**：新增三档无独立「设置 / 加载 / 失败」截图。按 Ruling 162 的「等代表状态」裁量与「不得引入完整 PNG 导出步骤」约束接受，如实记为待处理，不升级 Important。
- **M3 — 判定措辞准确（Ruling 179）**：FP-13 矩阵 11 行中 4 `PASS` / 2 `GAP` / 5 `BLOCKED`，口径段明确 A01–A09 为**历史已验证证据**，未把已验证成果记为未验证，符合 A10.5「按实际范围标记」；不改矩阵状态，仅记录分栈复核的补充证据。

**数字口径（Ruling 180）**：A10.3 补记的 **34 张**与 4 次 shim 失败是 2026-11-10 实现者**当时的真实历史状态**，按 A10.2「区分历史验证与当前结果」保留；控制器终验在最终代码上产出 **37 张完整五档截图**。累计延迟 Minor 以 Ruling 154 的 **66** 为权威基线，加 A10 M2 一项 → **67** 项；M1 已修正、M3 非缺陷不计；账本逐任务之和与分段累计的既有 1 项出入继续如实披露、不凑数。

**A 批状态（Ruling 181）**：`status: IN_PROGRESS` 保持，**不标 `VERIFIED`**（Ruling 160）。唯一剩余阻塞为 A10.4 固定导出样本像素对比、基线 `124b4ea` 采样与 3 个既有 PNG 导出用例的 Chrome-156 / Node-24 匹配环境重跑；W1 的 shim 阻塞已从 `blockers` 移除。`last_verified_commit` 沿用 `4610e25`（A10 无产品代码改动，与 A05–A09 惯例一致）。B 批 `NOT_AUTHORIZED`，按 B03.3 单独门槛处理。

**A10 完成（Ruling 182）**：A 批 10 个任务全部执行完毕。A10 交付为单一实现者提交 `80badcc`（4 份维护/验收文档 + `ui-baseline.spec.ts` 五档矩阵）+ 控制器终验文档提交；无产品代码改动、无新增环境 SKIP、无越界、用户 23 个未跟踪资产全程未动。下一步：在匹配 Chrome 156 / Node 24 环境补跑 A10.4 后复议 `VERIFIED`；B 批需用户单独授权。

## 遗留与裁定

- A01.1 要求「在 A01 开始时创建本执行记录」，A01 实现与任务评审均未落实。控制器在 A02 开工前补建，并把任务级状态流水保留在忽略目录的执行账本；A10 汇总后随文档提交一起交付。此项记为 A01 的过程缺口，不重开 A01 产品提交。
- 计划 `Review Focus` 与审查报告的「修复顺序建议」有偏差（报告建议先修重置令牌，计划放在 A09.3）；按依赖链维持计划顺序。
- README「24 种预设色」与实际 116 种不一致 —— **A10.2 已核对并处置**：`packages/poster-editor/src/panels/color-presets.ts` 实测 `grep -c "value:"` = **116** 个预设色条目；`README.md` 功能段已由「24 种预设文字颜色」更正为「116 种」并注明定义文件。此项闭合。
- 入口边界检查与包体追踪保持手动证据，不接入 `pnpm verify`（FP-12 明确延后为架构议题）。
- `AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 的 antd 版本与边界说明 —— **A10.2 已补齐**：`AGENTS.md` 新增「Ant Design 前端约定（A 批迁移后，FP-12）」、`README.md` 新增「Ant Design 界面契约与视觉证据」、`deploy/toolchain.lock.json` 补 `selected.antd = "6.7.0"` 与 `chromePath` / `chromeEnvironmentNote`；12 项主题逐字值见本记录「A10.2 维护契约逐字重述」。此项闭合。

## B 批 · 任务分区

本节由 B01 按 B 计划 :15「在同一个 `docs/verification/2026-11-06-antd-remediation.md` 中单列 B」创建（控制器 Ruling 184）。**2026-11-13 状态更新（Rulings 312-320）**：下方 YAML 与 A 批 front matter 均为**当前结论**（两批 `VERIFIED`，`blockers` 已清空）；A10、B01、B02、B03 各章节内「`IN_PROGRESS`」「`NOT_AUTHORIZED`」「A10.4 `BLOCKED`」等表述是各任务完成时点的历史结论，按「区分历史验证与当前结果」原则保留、不改写，一律以本状态块与文末「批次级复议」章节为准。A10.4 的 Chrome-156 归因已被推翻（根因是宿主 Chrome 子进程沙箱初始化失败），固定样本像素对比、全量 E2E 矩阵与锁定 Node 24 回归均已真实执行。逐任务流水、评审包与裁定见忽略目录 `.superpowers/sdd/2026-11-06-antd-remediation-b-implementation/`（仅本机证据，不入库）。

```yaml
batch: B
status: VERIFIED
authorization: "2026-11-11 用户明确选择『授权 B 批，从 B01 开始』；2026-11-12 用户回复『继续』逐任务授权 B02，同日再次回复『继续』逐任务授权 B03；按单任务惯例每次仅授权一个任务；2026-11-13 用户选择『授权诊断导出链路』完成 EXPORT-DIAG，同日『继续执行 未执行清单 内容』授权全部治理项与批次级复议（Rulings 312-316）"
execution_mode: subagent-driven-development (fresh implementer + independent task reviewer + controller final verification per task)
workspace: "/Users/aaa/acode/FastPoster" (in-place, no linked worktree)
branch: feat/fastposter
baseline: "9a0efbf" (A10 controller final verification)
b01_baseline: "9a0efbf"
b02_baseline: "be986a9"
review_baseline: "124b4ea5d2dc7b1b58183749a393a3c4759fe47b"
last_verified_commit: "55ccf59" (2026-11-13 controller final gate; EXPORT-DIAG product commits ef29768 + 55ccf59; B03 had no product code and the previous value 4d4f8e7 is historical)
task: B03 (COMPLETE); 2026-11-13 reconciliation batch — no B04 exists
b01_status: COMPLETE
b02_status: COMPLETE
b03: COMPLETE
b02_b03: "B02 COMPLETE / B03 COMPLETE"
export_diag: COMPLETE
spec_ids: [FP-11]
blockers: []
deferred_minors: 8
next_step: "Both batches VERIFIED by controller re-review on 2026-11-13 (Rulings 317-320). completion != deployment: no deployment, no whole-branch final review, no finishing-a-development-branch (Ruling 276). Remaining deferred Minor and open_verification_items are non-blocking and belong to a future whole-branch review."
```

### B01 使保存和分类移动共享版本前提 — COMPLETE

**提交（2 个单一聚焦的产品提交）**

| commit    | 消息                                                                | 规模                                                                  |
| --------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `05644d3` | `fix(catalog): enforce versions on resource and category writes`    | 24 files / +1554/-161：2 IDL、7 生成产物、5 Go、6 admin 前端、4 测试  |
| `c437757` | `fix(admin): recover quick publish conflicts with confirmed reload` | 5 files / +463/-11：3 admin TSX + 2 E2E spec（评审 Important 修复轮） |

父链 `9a0efbf → 05644d3 → c437757`，未改写历史、未 amend；仅显式路径 `git add`，10 个顶层未跟踪用户资产全程未修改、未暂存。

**需求映射（FP-11 / B01.1–B01.6）**：`ResourceInput` 字段 15 与 `MoveResourceInput` 字段 3 新增 `optional string expectedVersion (api.body="expectedVersion")`；`pnpm contracts:generate` 产出并随 IDL 提交全部 7 个生成产物，`contracts:check` sha256 一致。版本前提为正整数规范十进制字符串，已有资源更新缺失/空/非法 → `INVALID_INPUT` + 刷新提示，合法但过期 → `REVISION_CONFLICT` / 409；先鉴权、不泄露版本，比较在事务行锁内完成，锁/校验/行更新/版本行/引用/审计同一事务，无成功审计或部分写入。**无绕过路径**：创建无版本要求，内部 copy 发布包装同样携带 `ExpectedVersion: r.Version`。统一 `catalog.MoveCategory(ctx, p, id, parentID, expectedVersion string) error`，copy 服务委托，独立移动也 bump `current_version` 并写版本行与审计。新增管理员详情 `AdminGetResource GET /api/v1/admin/resources/:id/detail`（`IDRequest → ResourceReply`，仅管理员，缺失/已删除 → `NOT_FOUND`），供冲突按 ID 重载。分类表单把「先 move 再 save」两请求链收敛为一次原子 `AdminSaveResource`。

**冲突恢复**：4 个编辑表单 + 3 个列表/卡片快捷 toggle 共 7 条恢复链，均保留 pending 目标状态，冲突时按 ID 重载最新资源、显示新版本号/发布状态/标题，提供明确「确认重新提交」与「取消」，确认后以 `latest.version` 再提交；无自动重发、无静默合并或覆盖；`isGone`/失权终止重试，`isStaleClient` 保留刷新提示，成功后清除冲突态并刷新列表。快捷发布 B01 阶段仍走保存路由并携带同一快照版本，独立发布意图属 B02。

**真实 RED → GREEN**：MySQL 预检 `TestMigrationRoundTripAndEmojiJSON` PASS；4 个新增 Go 集成测试在真实 `fastposter_test_*` 库上取得并发覆盖/父级与字段回滚/移动版本与深度/HTTP 拒绝的行为红灯，修复后 **4 PASS**；`--all-server` 回归 **12 PASS**、全量集成 **58 PASS / 8 环境 SKIP**、`go test ./internal/...` 通过、`pnpm test:server` 17 `ok`。修复轮另在 `05644d3` 未修复产品代码上注入 409，两条 E2E 各 `1 failed`（`getByTestId('version-conflict')` 不可见，:553 / :634）为真实产品红灯，非构建/注册限流/DSN SKIP/PNG 失败。

**控制器独立终验（全部 exit 0）**：`pnpm contracts:check`、`pnpm typecheck`、`pnpm test` **32 文件 / 218 用例**、`pnpm verify` **turbo 8/8**、Go 定向 **4 PASS**；`git diff --check`、5 个修复文件 `prettier --check` 通过。主提交终验 E2E **9 组 / 12 用例 / 0 FAIL**；修复轮终验 **11 组 / 18 用例**，其中 `admin-existing` 组首次 2 例因临时栈 `127.0.0.1:15174` `ERR_CONNECTION_REFUSED` 失败（环境性，未计 RED/GREEN），控制器在独立新栈补跑 **2 passed / exit 0** 后闭合为 **18 / 0 FAIL**。后台脚本汇总 `exit 0` 未被当作绿灯证据，逐组日志另存 `/tmp/fp-b01-fix-ctrl-*.log`。

**独立评审与裁定**：任务级评审 **Spec ✅ / Task quality Approved**，0 Critical / 0 Important / 2 Minor / 6 ⚠️。控制器把 W1「快捷 toggle 缺冲突恢复链」升级为 **Important**（Ruling 199：Ruling 191、B01.5 :55、FP-11 :130 的恢复契约均未限定表单），触发修复轮 1/1。定向复评审（首次派发 502，重试成功）**9/9 ADDRESSED、I-1 ADDRESSED、无新增 Critical/Important、无越界**。W2（提交后 `s.Get` 重读）按 B02.3 归属接受，W3 覆盖按字面最小要求接受，W4 由本节闭合，W5 `api.ts` 为获批准的最小边界扩展，W6 契约优先任务的 RED 不可 `git apply -R` 复现属结构差异、非伪造。

**延迟 Minor（B 批共 4 项）**：M1 `apps/admin/src/api.ts:20` 依赖中文消息正则判定 stale client；M2 `server/internal/catalog/service.go` 锁序注释与 `Delete` 实现不符（行为无锁序倒置）；B-M3 单一 `conflict` state 未按资源 id 索引，并发冲突只能展示一个（每次 POST 仍各用自身版本，无数据串台）；B-M4 确认按钮防重依赖共享 `<Button busy>`，存在理论上的渲染前双击窗口。B-M3 / B-M4 交 B02.4 快捷发布重写评估。A 批 67 项延迟 Minor 未触碰。

**环境与 SKIP**：本机 Chrome `157.0.8103.51`、Node `v22.22.2` 与锁定 `156.0.8078.48` / `24.21.0` 不符；3 个既有 PNG 导出用例（`admin-catalog.spec.ts:11` / `:111`、`templates.spec.ts:274`）沿用环境 SKIP，未写成 PASS、未算 B01 回归；A10.4 固定导出样本像素对比未重试。`pnpm test:server` 中 `server/tests/integration` 因直接 `go test` 不读 `.env.local` 而 SKIP，真实 MySQL 断言由 `python3 tools/test-integration.py` 覆盖，已单列。

**部署兼容提示（B01 范围内）**：无 schema 迁移；`expectedVersion` 为可选 wire 字段，旧客户端缺少该字段的已有资源更新会被安全拒绝并提示刷新。B 计划 Global Constraints 要求核心服务、网关、管理站与生成客户端作为同一兼容单元切换；完整维护文档、回滚规则与 B03.3 最终门槛属 **B03（`NOT_AUTHORIZED`）**，本节不代替其交付，也不宣称 B 批 `VERIFIED`。

**B01 完成（Ruling 213）**：B 批仍 `IN_PROGRESS`，`last_verified_commit: c437757`；B02 / B03 保持 `NOT_AUTHORIZED`，需用户再次明确授权方可改动 IDL 与业务代码。A 批状态与阻塞项保持 A10 终验原样。

### B02 独立发布意图并保留版本引用 — COMPLETE

**提交（2 个聚焦提交，父链 `be986a9 → 07cd237 → 4d4f8e7`）**

- `07cd237 feat(catalog): publish resources with versioned intent` — **25 files / +1804/-83**：3 个 IDL、**9 个生成产物**、新增 `server/internal/catalog/publication.go`、6 个服务端文件、3 个 admin TSX、新增 `server/tests/integration/catalog_publication_test.go`、2 个 E2E spec。
- `4d4f8e7 test(catalog): cover save snapshot echo and publication HTTP 400 contract` — 修复轮，**2 个测试文件 / +288/-0**（新增 `server/internal/transport/publication_http_test.go`），**零产品代码改动**。
- 仅显式路径 `git add`，未用 `git add -A`；10 个顶层未跟踪用户资产全程未修改、未暂存；提交后索引干净。

**需求映射（FP-11 / B02.1–B02.5）**：新增 `PublishResourceInput`（字段 1 `required string id (api.path="id")`、2 `optional bool published (api.body="published")`、3 `required string expectedVersion (api.body="expectedVersion")`），`CatalogCall` 追加字段 8 `optional requests.PublishResourceInput publication`，新增 `AdminPublishResource POST /api/v1/admin/resources/:id/publication` 返回 `ResourceReply`；`pnpm contracts:generate` 产出并随 IDL 提交 **9 个生成产物**（B01 的 7 个 + 首次变动的 `kitex/common/calls.go`、`k-calls.go`），`contracts:check` sha256 一致。生成的 `bodyFields` 恰为 `["published","expectedVersion"]`，`id` 走 path。B02.1 的「缺字段或 null 返回 400」经控制器 Ruling 220 裁定专指 `published`：新增 `BAD_REQUEST → 400` 分支（不改既有映射），缺 `expectedVersion` 仍为 `INVALID_INPUT`/422 + 刷新提示。服务新增 `SetPublished(ctx, p, id, published, expectedVersion) (Resource, error)`，三重管理员设防（adapter 白名单、服务内 `RequireAdmin` 先于版本解析、copy 测试 FORBIDDEN），普通用户持合法版本也 403 且不回显版本。

**事务语义**：auth → `parseExpectedVersion` → `BeginTx` → 行 `FOR UPDATE` → 版本不等即 `REVISION_CONFLICT`/409（**先于**状态比较，故过期且目标状态相同仍冲突）→ 状态已相同则**成功零写入**（无新版本行、无审计、无 UPDATE，响应版本为事务内当前快照）。状态不同时在同一事务内按稳定顺序 `LockAssetVersions`、从已锁定的当前版本行 `INSERT … SELECT` 复制 title/元数据/资产版本/document/body、复制 `resource` 与 `resource-version` 两种 `asset_refs`、更新 `published`/`current_version`、写一条 `resource.publish` 审计；任何失败整体回滚。服务端不消费任何客户端内容快照。**B01 W2 闭合**：`service.go:375-385` 的提交后 `s.Get` 与新的 `SetPublished` 均改为事务内 `scanResource` 快照，写路径无提交后重读。

**前端与 E2E**：三处列表/卡片快捷 toggle 改走新路由，body 只有 `{id, published, expectedVersion}`；完整保留 B01 的 pending 目标态、`reloadResource`（`AdminGetResource`）、`data-testid="version-conflict"` 最新版本/状态/标题、「确认重新提交」+「取消」、`isGone` 终止与 `isStaleClient` 刷新提示。4 个编辑表单仍走 `AdminSaveResource` + 发布复选框，`TemplateEditor.tsx` / `CopyForm.tsx` 未改。copy 服务 `Publish`/`Unpublish` 扩签名并委托 `SetPublished`，保留 `RequireAdmin` 与 `copy`/`copy-category` 限定。**B01 两条冲突 E2E 是改写而非删除**（POST mock 换到 `/:id/publication`），保留全部断言语义并新增 body-only 断言；新增具名用例 `stale publication preserves newer resource and requires confirmation`。

**真实 RED → GREEN**：`pnpm contracts:generate` 前新测试引用新符号无法编译，如实标为 interface absence、不计 RED。生成后、服务实现前，3 个 Go 集成测试在真实 `fastposter_test_*` MySQL 上出现 3 个 `--- FAIL`（`INVALID_INPUT 未知素材操作`，`FAIL … 2.512s`），两条 E2E 出现 `Expected: 1 / Received: 0`（快捷 toggle 未 POST 到新路由）——均为真实行为失败，非构建错误、DSN SKIP、注册限流或 Chrome-157 PNG 失败。修复后 Go 定向 3 PASS、E2E 20 例全绿。实现期 A08 分页旧路由 mock 曾 1 failed（`Expected: true / Received: false`），提交前连带改写并复跑 4 passed，如实记录。契约优先任务无法用 `git apply -R` 做纯基线重跑（B01 Ruling 203/W6 的结构差异）。

**控制器独立终验（最终 HEAD `4d4f8e7`，全部 exit 0）**：`pnpm contracts:check`、`pnpm typecheck`、`pnpm test` **32 文件 / 218 用例**、`pnpm verify` **turbo 8/8**、Go 定向 `--all-server` **5 PASS**（transport 1 + integration 4）、全量集成 PASS `ok … 27.033s`、`pnpm test:server`、`go test ./internal/...`、手写 5 文件 `prettier --check`、`gofmt -l` 空、`git diff --check`。控制器最终 E2E **12 组 / 20 例 / 0 FAIL**，逐 spec 独立临时栈、互斥 `-g` 分组：B02 改写/新增发布用例 3、B01 原子保存 1、A08/A09 admin-catalog 2、copy 3、templates 3、A01 缩减动效 1、A05 创建重试 1、A07 加载态 2、A08 项目分页/改名冲突 2、A09 重置令牌 1、A09 五层文案树 1。日志 `/tmp/fp-b02-ctrl-*.log` 与 `/tmp/fp-b02-fix-ctrl-*.log`。

**独立评审与裁定**：任务级评审 **Spec ✅ / Changes requested**，0 Critical / 3 Important / 3 Minor / 8 ⚠️。控制器把 I-1（新测试文件未在报告登记为边界扩展）降为 Minor 一并修，确认 I-2（`Save` 快照改动缺回归测试）与 I-3（400 分支缺 HTTP 层测试）为 Important，进入修复轮 1/1。定向复评审 **9/9 ADDRESSED、I-1/I-2/I-3 全部 ADDRESSED、无新增 Critical/Important、无越界**；修复轮新增并发 `AdminSaveResource` 回显版本回归测试与真实 HTTP 层 400/null 测试，均如实标为**回归守卫（基线 GREEN）**，未伪造 RED。8 个 ⚠️ 全部由控制器证据审计或跨任务 E2E 回归闭合；B02.5 的「已引用背景下架后仍可用 / 过期应用模板」由 Go 集成测试覆盖，对应 E2E 属 A10.4 环境 SKIP。

**延迟 Minor（B 批共 8 项）**：B01 的 M1（`api.ts:20` 中文消息正则）、M2（`service.go` 锁序注释）、B-M3（单一 `conflict` state 未按 id 索引）、B-M4（确认按钮防重依赖共享 `<Button busy>`）——后两项在 B02.4 复评，路由变化未改变并发形态、每次 POST 仍各用自身版本、无数据串台，继续延迟；B02 新增 B-M5（`publication.go` `resource` owner 自复制 no-op）、B-M6（无故障注入回滚测试，已有 `defer tx.Rollback()` 与 stale/NOT_FOUND `assertUnchanged`）、B-M7（`bind.go` query 覆盖 `published` 的既有框架行为，无鉴权/版本泄露）、B-M8（I-2 回归守卫对「退回提交后重读」的区分力有限；无提交后重读已由两轮评审静态核实，更强的区分需产品内插桩，超出本任务边界）。A 批 67 项延迟 Minor 未触碰。

**环境与 SKIP**：Chrome `157.0.8103.51` / Node `v22.22.2` 与锁定 `156.0.8078.48` / `24.21.0` 不符；3 个既有 PNG 导出用例（`admin-catalog.spec.ts:11`、`:111`、`templates.spec.ts:274`）沿用 A10.4 环境 SKIP，未写成 PASS、未算 B02 回归；A10.4 固定导出样本像素对比未重试。`pnpm test:server` 中 `server/tests/integration` 因直接 `go test` 不读 `.env.local` 而 SKIP，真实 MySQL 断言由 `python3 tools/test-integration.py` 覆盖，已单列。

**部署兼容提示（B02 范围内）**：无 schema 迁移；新 `expectedVersion` 为 `required` 但运行时由 `parseExpectedVersion` 兜底；旧客户端发布仍走全量 `AdminSaveResource`，不受新路由影响。核心服务、网关、管理站与生成客户端仍须按同一兼容单元切换。完整维护文档、回滚规则与 B03.3 最终门槛属 **B03（`NOT_AUTHORIZED`）**，本节不代替其交付，也不宣称 B 批 `VERIFIED`。

**B02 完成（Ruling 265）**：B 批仍 `IN_PROGRESS`，`last_verified_commit: 4d4f8e7`；**B03 保持 `NOT_AUTHORIZED`**，需用户再次明确授权方可改动 IDL 与业务代码。A 批状态与 A10.4 阻塞项保持 A10 终验原样。

### B03 验收并记录升级和回滚条件 — COMPLETE

**任务定位**：B03 是 B 批最后任务（B 计划 `:39-43` 仅 B01/B02/B03，无 B04），纯文档 + 最终门槛，**零产品代码、零 IDL、零生成物、零测试文件改动**（Ruling 267）。基线 `5c08a80`；用户 2026-11-12「继续」逐任务授权（Ruling 266）。实现者交付单一聚焦提交 `docs: record catalog write compatibility and verification`（Ruling 274），控制器独立评审与终验后另做文档提交。

**B03.1 维护文档与部署兼容**：`AGENTS.md:91-138`、`README.md:606-653` 追加「B 批 · 后台资源写入边界、升级兼容与回滚（FP-11）」章节，**不重写** A10 的 FP-12 antd 逐字段（`AGENTS.md:57-71`、`README.md:469-481`）。`deploy/toolchain.lock.json:52` 仅把 `chromeEnvironmentNote` 本机 Chrome 实测 `157.0.8103.51 → 157.0.8103.78`，其余键逐字不动（Ruling 275）。章节逐项写入两条管理员路由、精确错误码映射（422 / 409 / 400 / 403）、版本前提格式、4 表单 vs 3 toggle、冲突恢复链、无 schema 迁移、适用批次、真实验证环境、同一代码版本同一兼容单元、写入冻结与「完成≠部署」。

**B03.2 回滚规则**：与 B03.1 同一章节（避免误读为可单独回退单一服务），逐字记录：先停止管理写入 → 整组回退 → 核对当前资源版本与资产引用 → 再恢复写入；回退旧服务失去本批并发保护并记录风险及是否继续冻结；回滚不修改已提交的资源版本、不删除数据；无 schema 迁移故无 down-migration，不得建议 `migrate -direction down`。

**历史表述声明（Ruling 268 / 273）**：A 批 front matter（`:1-36`）、A01–A10 章节、`## 遗留与裁定`（`:446-452`）、B01（`:481-508`）与 B02（`:510-536`）完成章节中的「B 批 `NOT_AUTHORIZED`」「B03 `NOT_AUTHORIZED`」「B02/B03 保持 `NOT_AUTHORIZED`」等均为各任务时点的历史表述，由本节 B 状态块（`b03: COMPLETE`、`task: B03`）声明**取代，不重写**。A 批 front matter、A01–A10 章节、`## 遗留与裁定`、既有 B01/B02 章节逐字保留。

**4 份权威文档只读核对（Ruling 272 / FP-12 `:143`）**：`docs/superpowers/specs/2026-11-06-antd-post-migration-remediation-design.md`、`docs/superpowers/plans/2026-11-06-antd-remediation-a-implementation.md`、`docs/superpowers/plans/2026-11-06-antd-remediation-b-implementation.md`、`docs/superpowers/specs/2026-11-05-antd-layout-design.md` 均存在于工作树且 `git ls-files --error-unmatch` 显示未跟踪；**未暂存、未提交、未重命名、未修改**。A10「逐字重述」交接路径保留，新检出不依赖忽略目录作为唯一来源。

#### B03.3 最终门槛（最终代码状态复跑）

口径：B03 零产品/IDL/生成/测试改动，下列命令在 `HEAD 5c08a80` 的最终代码状态（工作树仅含 3 份文档改动）上逐条实跑；`GOPROXY=off GOSUMDB=off`，真实 MySQL 断言只经 `python3 tools/test-integration.py` 与 `fastposter_test_*`，`pnpm test` 与 `pnpm verify` 串行执行避免 exit 137。日志集中 `/tmp/fp-b03-evidence/*.log`（不入库、不含 DSN 凭据）。§2 的 `set -euo pipefail` 前导以「逐条捕获退出码、不短路」兑现，以便每条都记录。

| #   | 命令                                                                                                    | exit          | 用例 / 产物数                                                                                                                                                                            | 分类与说明                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm verify`                                                                                           | 0             | `contracts:check` 一致（generated contracts match the Thrift IDL）、`typecheck` 通过、32 文件 / 218 用例、turbo 8/8                                                                      | PASS（当前复跑）                                                                                                                                                                                                            |
| 2   | `pnpm test`（与 verify 串行）                                                                           | 0             | 32 文件 / 218 用例                                                                                                                                                                       | PASS                                                                                                                                                                                                                        |
| 3   | `go test ./internal/...`                                                                                | 0             | `ok fastposter/internal/config`                                                                                                                                                          | PASS                                                                                                                                                                                                                        |
| 4   | `pnpm test:server`                                                                                      | 0             | 17 `ok` 包 / 21 `[no test files]`                                                                                                                                                        | PASS；`server/tests/integration` 显示 `ok (cached)`，直接 `go test` 不读 `.env.local`，真实 MySQL 断言由 #5/#6 覆盖，单列不算通过依据                                                                                       |
| 5   | `python3 tools/test-integration.py --all-server -count=1 -v`                                            | 0             | 142 PASS / 10 环境 SKIP                                                                                                                                                                  | PASS + 环境 SKIP（`FASTPOSTER_RENDER_TEST` / `FASTPOSTER_CAPACITY_TEST` / browser-stack harness 开关）                                                                                                                      |
| 6   | `python3 tools/test-integration.py -count=1 -v`                                                         | 0             | 62 PASS / 8 环境 SKIP                                                                                                                                                                    | PASS + 环境 SKIP（同上）                                                                                                                                                                                                    |
| 7   | `pnpm --filter @fastposter/renderer build`                                                              | 0             | 119 modules，`dist/index.html` + `dist/assets/*.js`                                                                                                                                      | PASS                                                                                                                                                                                                                        |
| 8   | `git diff --check`                                                                                      | 0             | 无空白错误                                                                                                                                                                               | PASS                                                                                                                                                                                                                        |
| 9   | A10 `:214-216`：`vite build --manifest --sourcemap --outDir <证据目录>/<app>`（web / admin / renderer） | 0             | 3 个构建成功（786ms / 458ms / 97ms），三个 `.vite/manifest.json` 齐备                                                                                                                    | PASS                                                                                                                                                                                                                        |
| 10  | A10 `:217`：`node tools/check-entry-boundary.mjs <web> <admin> <renderer>`                              | 0             | web PASS 2 entry / 764 sources；admin PASS 6 entry / 749 sources；renderer PASS 1 entry / 35 sources                                                                                     | PASS                                                                                                                                                                                                                        |
| 11  | §2 字面整 spec：`pnpm test:e2e tests/e2e/admin-catalog.spec.ts`                                         | 1             | 3 passed / 2 failed                                                                                                                                                                      | **环境 SKIP，非产品 RED**：`:11`、`:111` 为 2 个既有 PNG 导出用例（Chrome `157.0.8103.78` ≠ 锁定 `156.0.8078.48`）                                                                                                          |
| 12  | §2 字面整 spec：`pnpm test:e2e tests/e2e/templates.spec.ts`                                             | 1             | 0 用例                                                                                                                                                                                   | **环境阻塞**：WorkBuddy `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` shim 拒绝清空共享 `test-results/`（1528 文件），非产品 RED                                                                                       |
| 13  | §2 字面整 spec：`pnpm test:e2e tests/e2e/copy.spec.ts`                                                  | 1             | 0 用例                                                                                                                                                                                   | 同上 shim，非产品 RED                                                                                                                                                                                                       |
| 14  | 隔离栈整 spec 复跑（3 条，`--output /tmp/fp-b03-evidence/results/whole-<suite>`）                       | 1 / 1 / 0     | admin-catalog 3 passed / 2 PNG 环境 SKIP；templates 6 passed / 1 PNG 环境 SKIP；copy 7 passed / 0 FAIL                                                                                   | 环境 SKIP 单列，非产品 RED；补齐 #12/#13 的 0 用例证据                                                                                                                                                                      |
| 15  | B 批相关用例互斥 `-g` 分组隔离栈补跑（4 条）                                                            | 0 / 0 / 0 / 0 | 各 1 passed（共 4）：`quick publish conflict…`、`category rename plus move sends exactly one atomic save`、`quick copy publish conflict…`、`stale publication preserves newer resource…` | PASS（当前复跑，Ruling 194/231 惯例）                                                                                                                                                                                       |
| 16  | A10.4 固定导出样本像素对比                                                                              | —（未运行）   | 0                                                                                                                                                                                        | **BLOCKED**：需 Chrome `156.0.8078.48` / Node `24.21.0`、基线 `124b4ea` 临时工作区、同合成文档/字体/环境、`magick compare -metric AE` 预期 0；本机 `157.0.8103.78` / `v22.22.2` 不匹配。记录所需环境，不伪造通过、不写 PASS |
| 17  | 3 个既有 PNG 导出用例（`admin-catalog.spec.ts:11`、`:111`、`templates.spec.ts:274`）                    | —             | 3                                                                                                                                                                                        | **环境 SKIP**：Chrome-157 vs 锁定 156，单列不算通过、不算 B 批回归                                                                                                                                                          |

**renderer 与三入口边界审计**：#7 renderer 预构建与 #9 三入口 `vite build --manifest --sourcemap` 均 exit 0；#10 `check-entry-boundary.mjs` 三入口全 PASS（web/admin 不含 `@tiptap/` / `prosemirror-`，renderer 不含 `node_modules/antd/` / `packages/ui/src/` / `@fastposter+ui@`）。证据目录 `/tmp/fp-b03-evidence/entry-audit/{web,admin,renderer}/.vite/manifest.json`。

#### FP-11/12/13/14 核查矩阵

| 契约                             | 代码路径                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | IDL / 生成 / 审计 / API                                                                                                                                                                                                                                                                                                                  | 后台实际调用                                                                                                                                                                                          | 测试证据                                                                                                                                                                                                                                                               | 结论                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FP-11 创建（无版本前提）         | `server/internal/catalog/service.go` `Save`：`input.ID` 为空时不进 `parseExpectedVersion`，无并发前提                                                                                                                                                                                                                                                                                                                                                                              | `idl/common/requests.thrift:17` `ResourceInput` 字段 15 `optional string expectedVersion`；`idl/http/admin.thrift` `AdminSaveResource POST /api/v1/admin/resources`；`server/gen/kitex/common/requests.go`、`server/gen/hertz/admin/admin.go`、`packages/api-client/src/generated.ts:429-446`                                            | 4 个编辑表单的创建分支（`Resources.tsx:361`、`:455`、`TemplateEditor.tsx:205`、`CopyForm.tsx:77`、`:268`）不传 `expectedVersion`                                                                      | `server/tests/integration/catalog_test.go`、`catalog_http_test.go`；B03.3 `05/06-integration` PASS                                                                                                                                                                     | PASS（当前复跑），与 §3.4「创建无版本前提」一致                    |
| FP-11 保存已有资源               | `service.go:70` `parseExpectedVersion`（正整数规范十进制字符串）、`:218`、`:250-253` `REVISION_CONFLICT`、`:343` `LockAssetVersions`；锁/校验/行更新/新版本行/引用/审计同一事务                                                                                                                                                                                                                                                                                                    | `ResourceInput` 字段 15；`generated.ts:429-446` bodyFields 含 `expectedVersion`；`server/internal/transport/catalog_adapter.go:100`；`hertz.go:107-108` `INVALID_INPUT → 422`                                                                                                                                                            | 4 个编辑表单继续走 `AdminSaveResource` + 发布复选框，携带 `expectedVersion: version`（`Resources.tsx:455`、`TemplateEditor.tsx:205`、`TemplateList.tsx:472`、`CopyForm.tsx:268`）                     | `catalog_test.go`、`catalog_http_test.go`；`publication_http_test.go`（Save 快照回显回归守卫）；B03.3 集成 142 / 62 PASS                                                                                                                                               | PASS                                                               |
| FP-11 发布或下架（独立发布意图） | `server/internal/catalog/publication.go:17` `SetPublished`：`RequireAdmin` → `parseExpectedVersion` → `BeginTx` → `SELECT … FOR UPDATE` → 版本比较先于状态比较（stale 即 409）→ `LockAssetVersions` → `INSERT … SELECT` 复制 title/元数据/资产版本/document/body 与两类 `asset_refs` → 更新 `published`/`current_version` → 写 `resource.publish` 审计，全部同一事务；状态已相同则成功零写入；`catalog_adapter.go:126-141` `IsSetPublished` 区分缺失/`null` → `BAD_REQUEST` 零写入 | `requests.thrift:19` `PublishResourceInput`（1 `id` path、2 `published`、3 `expectedVersion`）；`admin.thrift` `AdminPublishResource POST /api/v1/admin/resources/:id/publication` 返回 `ResourceReply`；`generated.ts:455-462` `bodyFields: ["published","expectedVersion"]`；`hertz.go:95-108` 错误码映射：400 / 403 / 404 / 409 / 422 | 3 处列表/卡片快捷 toggle：`Resources.tsx:126`、`TemplateList.tsx:179`、`CopyPage.tsx:149`，body 仅 `{id, published, expectedVersion}`                                                                 | `catalog_publication_test.go`、`publication_http_test.go`（真实 HTTP 层 400/null 与 422）；E2E `admin-catalog.spec.ts:431`、`copy.spec.ts:540`、`:680`                                                                                                                 | PASS                                                               |
| FP-11 编辑或移动分类             | `service.go:425` `MoveCategory(ctx, p, id, parentID, expectedVersion)`；`copy/service.go:85` 委托；`CopyForm.tsx:75-84` 把旧「先 move 再 save」两请求链收敛为一次原子 `AdminSaveResource`                                                                                                                                                                                                                                                                                          | `requests.thrift:18` `MoveResourceInput` 字段 3；`generated.ts:477` bodyFields `["parentId","expectedVersion"]`；`catalog_adapter.go:111-115`                                                                                                                                                                                            | 分类表单一次原子保存，非法标题/移动失败无部分写入                                                                                                                                                     | `copy/service_test.go`、`catalog_test.go`；E2E `copy.spec.ts:494` `category rename plus move sends exactly one atomic save`                                                                                                                                            | PASS                                                               |
| FP-11 冲突恢复                   | `apps/admin/src/api.ts:33-34` `reloadResource(id)` → `routes.AdminGetResource`；`Resources.tsx:135`/`:471`、`TemplateEditor.tsx:219`、`TemplateList.tsx:188`、`CopyPage.tsx:158`、`CopyForm.tsx:90`/`:282` 按 ID 重载最新资源                                                                                                                                                                                                                                                      | `admin.thrift` `AdminGetResource GET /api/v1/admin/resources/:id/detail`（`IDRequest → ResourceReply`，仅管理员，缺失/已删除 → `NOT_FOUND`）；`catalog_adapter.go:116-125` `service.Get(..., true)`；`generated.ts:447-453`                                                                                                              | `data-testid="version-conflict"` 展示最新版本号/发布状态/标题，明确「确认重新提交」+「取消」后以 `latest.version` 重提（`Resources.tsx:607-618` 等）；`isGone`/失权终止重试；保留草稿与已上传素材引用 | E2E `admin-catalog.spec.ts:431`、`copy.spec.ts:540`、`:680`；B01/B02 修复轮 RED→GREEN 为历史证据                                                                                                                                                                       | PASS（当前 `-g` 隔离栈复跑）；禁止自动重发/静默合并/覆盖由静态核查 |
| FP-12 同批维护文档与验收入口     | spec `:141` 要求同批更新三份维护文档 + 验收入口，说明 antd 版本、共享控件、renderer 边界、**后台 B 批契约与兼容范围**、创作路径、手机操作、真实测试命令；`:143` 不把忽略目录设为唯一交接来源                                                                                                                                                                                                                                                                                       | A10 既有 FP-12 段（`AGENTS.md:57-71`、`README.md:469-481`）逐字保留；B03 追加 B 批段；`deploy/toolchain.lock.json` `selected.antd=6.7.0` 与 `chromeEnvironmentNote`；`tools/check-entry-boundary.mjs`                                                                                                                                    | 不适用（文档契约）                                                                                                                                                                                    | B03.3 `pnpm contracts:check`（generated contracts match）、`typecheck`、三入口审计 exit 0；4 份权威文档只读存在核对                                                                                                                                                    | PASS（文档事实一致性）                                             |
| FP-13 验证集                     | spec `:159` FP-11 行（过期发布/保存/移动不覆盖新版本、表单原子保存、无部分写入、权限/引用/兼容/IDL 生成）；`:162` B 批另跑 Go + MySQL 集成，缺设备或环境标 `SKIP`/`BLOCKED` 并说明影响                                                                                                                                                                                                                                                                                             | 全仓                                                                                                                                                                                                                                                                                                                                     | 不适用                                                                                                                                                                                                | B03.3：`pnpm verify`（turbo 8/8、218/218）、`go test ./internal/...`、`pnpm test:server`（17 ok）、`--all-server`（142 PASS / 10 环境 SKIP）、`-count=1 -v`（62 PASS / 8 环境 SKIP）、逐 spec E2E、A10 三入口审计；A10.4 与 3 个 PNG 导出用例 BLOCKED / 环境 SKIP 单列 | PASS（已执行项）；BLOCKED / SKIP 不写成通过                        |
| FP-14 单一执行记录               | spec `:166` 范围获准后用单一执行记录，依次记录用户指示、基线、最后验收提交、当前编号、下一步、实际 diff、验证结果与阻塞；矩阵缺项/旧测试误命中/仅截图记待处理                                                                                                                                                                                                                                                                                                                      | `docs/verification/2026-11-06-antd-remediation.md` `## B 批 · 任务分区` B 状态 YAML + 新增 `### B03 … — COMPLETE` 章节                                                                                                                                                                                                                   | 不适用                                                                                                                                                                                                | B03 报告 §1-§12、B 状态 YAML 可解析、`git diff --check` / JSON / prettier 自检                                                                                                                                                                                         | PASS（B03 COMPLETE / B 批 IN_PROGRESS；旧证据标历史，未作新结果）  |

#### 部署 / 回滚内容审计

- **B03.1 契约事实**（`AGENTS.md:99-108` / `README.md:614-623`）：两条管理员路由（`GET /api/v1/admin/resources/:id/detail` `AdminGetResource` `IDRequest → ResourceReply` 仅管理员 `NOT_FOUND`；`POST /api/v1/admin/resources/:id/publication` `AdminPublishResource` body 只有 `published` + `expectedVersion`、`id` 来自 path、返回 `ResourceReply`）；`expectedVersion` 正整数规范十进制字符串；缺/空/非法 → `INVALID_INPUT`/422 +「刷新旧页面」；合法但过期 → `REVISION_CONFLICT`/409；缺或 JSON `null` 的 `published` → `BAD_REQUEST`/400 零写入；普通用户 → `FORBIDDEN`/403 不回显版本；创建无版本前提；4 编辑表单 `AdminSaveResource` + 发布复选框 vs 3 快捷 toggle 新发布路由。
- **冲突恢复链**（`AGENTS.md:112-114` / `README.md:627-629`）：保留草稿与已上传素材引用、按 ID 重载、展示最新版本号/发布状态/标题、明确「确认重新提交」后以 `latest.version` 再提交、提供「取消」；禁止自动重发 / 静默合并 / 自动覆盖 / 吞掉冲突；删除或失权终止重试。
- **无 schema 迁移 + 兼容单元**（`AGENTS.md:118-121` / `README.md:633-636`）：未改 `server/migrations`、现有数据与版本行向前兼容；核心服务 + 网关 + 管理站 + 生成 API 客户端同代码版本同一兼容单元整组切换；启动前确认旧实例无法继续写入；重开管理员工作台取新前端；不能同步切换则冻结管理写入直到整组就绪；B 批执行完成不代表自动部署。
- **适用批次与真实验证环境**（`AGENTS.md:95`、`:125-127` / `README.md:610`、`:640-642`）：A = FP-12/13/14、B = FP-11、无 B04；Chrome `157.0.8103.78` / Node `v22.22.2` / Go `go1.27.2 darwin/arm64` / pnpm `11.25.0` / Python `3.13.12` vs 锁定 Chrome `156.0.8078.48` / Node `24.21.0`；真实 MySQL 断言只走 `python3 tools/test-integration.py` 与 `fastposter_test_*`。
- **B03.2 回滚逐字规则**（`AGENTS.md:131-138` / `README.md:646-653`）：(1) 先停止管理写入 → (2) 整组回退 → (3) 核对当前资源版本与资产引用 → (4) 再恢复写入；回退旧服务失去本批并发保护并须记录风险及是否继续冻结；回滚不修改已提交的资源版本、不删除数据；无 down-migration、不得建议 `migrate -direction down`。
- **结论**：§3.4 / §3.5 全部逐字事实在 `AGENTS.md` 与 `README.md` 的同一 B 批章节中成对出现，A10 FP-12 逐字段未被重写；`deploy/toolchain.lock.json` 除 `chromeEnvironmentNote` 外逐字不变。

#### 批次状态裁定（Ruling 273）

A10.4 固定导出样本像素对比与 3 个既有 PNG 导出用例仍需匹配 Chrome `156.0.8078.48` / Node `24.21.0` 环境，B03.3 无法完整闭合；#11–#14 的失败均为环境 SKIP / 运行时 shim / Chrome 版本不匹配，**无产品 RED**，但也不足以构成批次级充分证据。按 Ruling 273：**B 批保持 `status: IN_PROGRESS`，不把批次标为已验证**；B03 任务标 `COMPLETE`。A 批 front matter 不动，`last_verified_commit: "4d4f8e7"` 保持不变（B03 无产品代码，A05–A10 惯例），`deferred_minors: 8` 不变；`next_step` 写明匹配环境补跑后才能复议该结论。旧证据一律标为历史、未作为新结果（FP-14 `:166`）。控制器独立评审与终验后另做文档提交。

#### B03 控制器独立终验与终裁（2026-11-12，Rulings 279-290）

**恢复与交付**：用户 2026-11-12「请接着之前中断的任务继续执行」→ 从 B03 实现者 `DONE_WITH_CONCERNS` 的中断点恢复，只做独立评审、控制器终验与文档收官，未重做任何已完成任务。实现者单一聚焦提交 `958126f docs: record catalog write compatibility and verification`（4 文件 / +168/-6），`git diff-tree --name-status` = 4 `M`，恰为 Ruling 268 白名单；零产品 / IDL / 生成物 / 测试文件改动；提交后工作区仍只有 10 个顶层 `??` 用户资产，索引干净。

**独立任务评审**：首个评审 worker 在推理模型上运行 24 分 11 秒未产出评审文件，控制器按 A10 Ruling 171 的先例停止该 worker、以默认模型重派同一三份输入与检查清单，评审独立性未受损（Ruling 279）。重派评审完整读取 brief、`task-B03-report.md` §1–§12 与 53,836 字节评审包 `review-5c08a80..958126f.diff`，未跑测试、未改文件、未做 git 写操作。结论 **Spec ✅ / Task quality Approved**，**0 Critical / 0 Important / 4 Minor / 2 ⚠️ / 2 non-issue**；17 组 B03.1 逐字事实与四步 B03.2 回滚在 `AGENTS.md` 与 `README.md` 成对全覆盖，422/409/400/403 从未混写，`migrate -direction down` 仅以禁止式出现，报告数字与证据日志逐数吻合、提交后日志为真实重跑，文档事实与 `admin.thrift:17-18` / `hertz.go:93-115` / `generated.ts:455-462` 一致（Ruling 280）。**无需修复轮**（SDD：Minor 不进入循环）。

**逐项裁定**：F1（B 状态块 `authorization` 仍只记 B02 授权）与 F2（`blockers` 首项仍写「not retried in B01 or B02」）由本次控制器文档提交补记 B03 授权与「B01, B02 or B03」措辞闭合，保留历史 Chrome `.51` 值不动（Ruling 281/282）。F3（PNG 用例在 Playwright 字面日志为 `failed`、汇总表记为「环境 SKIP」）裁定为**已披露的强制重分类**：字面计数 `3 passed / 2 failed` 保留在原表，分类按 Ruling 271/273 为环境 SKIP，非产品 RED、不写 PASS、不重跑、不改产品（Ruling 283）。F4（E2E 证据在提交前取得）由控制器在最终 HEAD 独立复跑 10 组全绿 + 提交后 12 条确定性命令全 0 闭合；B03 零产品改动使两次产品状态逐字相同（Ruling 284）。⚠️ F5 由控制器实测闭合：DSN / 凭据日志扫描 **0 命中**（唯一宽松正则命中是 Hertz 路由日志里的 `:id`），4 份权威文档大小 `36016 / 31748 / 14324 / 28568` 与报告一致、mtime 为 11-05/11-06、全部 UNTRACKED 且从未修改（Ruling 285）。⚠️ F6 由控制器逐日志核对闭合：10 个控制器 E2E 日志各含 `1 passed` 与 `EXIT_CODE: 0`（Ruling 286）。F7（`set -euo pipefail` 改为逐条捕获退出码）与 F8（Chrome `.51` 与 `.78` 并存）均为 non-issue：前者是 Ruling 271「每条记录 exit」的必要兑现，后者是不同测量时点且新章节已显式区分（Ruling 287/288）。**B 批延迟 Minor 仍为 8 项**，A 批 67 项未触碰（Ruling 289）。

**控制器独立终验（最终 HEAD，24/24 命令 exit 0，2m42s，`/tmp/fp-b03-ctrl/`）**：`pnpm contracts:check`（generated contracts match the Thrift IDL）、`pnpm typecheck`、`pnpm test` **32 文件 / 218 用例**、`pnpm verify` **turbo 8/8**、`go test ./internal/...`、`pnpm test:server`、Go 定向 `--all-server` **5 PASS / 0 FAIL**、全量集成 **62 PASS / 8 环境 SKIP / 0 FAIL**、`pnpm --filter @fastposter/renderer build`（119 modules）、独立三入口 `vite build --manifest --sourcemap`（web 3798 / admin 3792 / renderer 119 modules）、`node tools/check-entry-boundary.mjs` **web PASS 2/764、admin PASS 6/749、renderer PASS 1/35**、`git diff --check`。控制器最终 E2E **10 个互斥 `-g` 组、10 例全绿、0 FAIL、无 0 用例组**：B 批 4（快捷发布冲突恢复、分类原子保存、copy 发布冲突、copy 过期发布）+ A01/A05/A07/A08/A09 跨任务回归 6。

**环境与诚实口径**：本机 Chrome `157.0.8103.78` / Node `v22.22.2` 与锁定 `156.0.8078.48` / `24.21.0` 不符；A10.4 固定导出样本像素对比与 3 个既有 PNG 导出用例（`admin-catalog.spec.ts:11` / `:111`、`templates.spec.ts:274`）继续 `BLOCKED` / 环境 SKIP，控制器未重试、未写成 PASS、未计产品 RED。`pnpm test:server` 的集成包 `ok (cached)` 不作 MySQL 通过依据，真实断言只由两次 `python3 tools/test-integration.py` 覆盖。

**B03 完成（Ruling 290）**：B03 **COMPLETE**；B 批保持 `IN_PROGRESS`、**不标 `VERIFIED`**，唯一剩余门槛是在匹配 Chrome 156 / Node 24 环境补跑 A10.4 与 3 个 PNG 用例后复议。`last_verified_commit` 沿用 `4d4f8e7`，A 批 `IN_PROGRESS` 与 `last_verified_commit: 4610e25` 不动。B 计划 `:39-43` 仅 B01/B02/B03，**无 B04**；两批均 `IN_PROGRESS` 时不派 whole-branch final review、不删除 `.superpowers/sdd/...` 工作区、不触发 finishing-a-development-branch（Ruling 276）。

## EXPORT-DIAG · 导出链路诊断、修复与归因订正（2026-11-13）

本章节由用户 2026-11-13「继续执行 未执行清单 内容」授权补记（Ruling 312）。此前 Rulings 295/306 把本验收入口、`AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 与两个账本列为 EXPORT-DIAG 任务的禁改文件，并留下「需用户显式决定」的治理项；Ruling 312 解除该限制，仅限口径同步、归因订正与结果落盘，其余禁令（IDL、生成物、migrations、`.workbuddy/**`、10 个顶层 `??` 资产、不建 linked worktree、不自动写 `VERIFIED`）继续有效。Ruling 276 仍适用：不触发全分支评审与 finishing，不部署。

### 根因与证据链（Ruling 313）

`server/internal/exports` 的 STEP0 探测在本机系统 Chrome `157.0.8103.78` 上直接观察到：

```text
sandbox initialization failed: Operation not permitted
aperitif: Failed to initialize sandbox
GPU process exited unexpectedly: exit_code=6
FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc:389] GPU process isn't usable. Goodbye.
STEP0 browser start: FAIL: browser process exited: signal: trace/BPT trap
```

随后 `RenderText` 失败，worker 把导出 job 映射为 `RENDER_FAILED`，`ExportDialog.tsx` 只在 `status === "succeeded"` 时渲染「下载原尺寸 PNG」链接，于是 A10.3 记录的 11 个用例在 `toBeVisible` 处超时。**关键控制实验**：把 Chrome 换成官方 Chrome-for-Testing `156.0.8078.47`（`/tmp/fp-exportdiag-20261113/cft156/`，仅解压、仅经 `CHROME_PATH` 指向，未安装未提交），在**不带** `--no-sandbox` 时逐字复现同一沙箱初始化失败、GPU FATAL 与 SIGTRAP。故根因是**宿主不允许 Chrome 子进程初始化沙箱**，与 Chrome 版本无关；既有 blocker「Chrome 157 vs 锁定 156」以及「匹配 Chrome 156 即解除阻塞」**事实错误**。日志：`/tmp/fp-exportdiag-20261113/diag-step0.log`、`cft156-noflag-full.log`。

### 修复与运维契约

| 提交      | 内容                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ef29768` | 在 `server/internal/exports/renderer.go` 的 allocator options 追加 `chromedp.NoSandbox`，使受限宿主上 Chrome 可启动；`server/internal/exports/worker.go:143-147` 把渲染错误如实映射为 `RENDER_FAILED`，失败态显示文案而非伪造成功链接。                                                                                                                                                |
| `55ccf59` | 抽出纯函数 `rendererChromeOptions(chromePath, getenv)`；**`FASTPOSTER_CHROME_SANDBOX=1` 时省略 `chromedp.NoSandbox`**（恢复沙箱），未设置或任何其它值保持默认追加；新增 `renderer_sandbox_test.go` 的 `TestChromeSandboxGate`（7 子用例，reflect 检查 `initFlags` + 反射无关的选项数断言）。同时把 4 个集成 fixture 的硬编码 Chrome 路径改为 `chromePath()`，遵循 `CHROME_PATH` 约定。 |

> `ef29768` 的历史 subject 写作 `repair Chrome 157 export rendering`，措辞误归因；按 Ruling 304 **不 amend**，更正只记于账本、EXPORT-DIAG 报告与本文档。

**安全取舍（Ruling 303 / 必须随交付传递）**：默认关闭 Chrome 进程沙箱是**有意的安全取舍**，不是「无需沙箱」。FastPoster 是本机单用户原生应用，CSP、`127.0.0.1` 回环与随机令牌只能收窄远程内容暴露，**不能替代 OS 进程隔离**。生产 `server/cmd/export-worker/main.go` 构造同一 `Renderer`，因此**默认仍无 Chrome 进程沙箱**；加固宿主须显式设 `FASTPOSTER_CHROME_SANDBOX=1`。但本受限宿主设该值会立即 SIGTRAP、导出不可用（`/tmp/fp-exportdiag-ctrl2/15-sandbox-on-expected.log`，exit 1，属预期环境结果而非产品 RED，同时反证门控分支被真实走到）。未来多租户或非本机部署必须重新评估默认值。

**版本可得性**：`deploy/toolchain.lock.json` 锁定 `156.0.8078.48`，官方 Chrome-for-Testing feed **0 条**该精确版本；同通道最近可得为 `156.0.8078.47`。该缺口如实记录，但因为根因与版本无关，且 A10.4-R 已在 `.47` 与系统 `157.0.8103.78` 上产出**字节相同**的固定样本，不再构成验收阻塞。

### 修复后的真实验证

- **RED → GREEN**：既有 `FASTPOSTER_RENDER_TEST=1` 门控用例（`TestRenderMixedChineseFonts`、`TestExportWorkerRendersRealPNG`）在修复前真实 2 FAIL，修复后 2 PASS；门控单测经 A/B 双向变异验证，移除任一方向的门控都会真实 FAIL。
- **独立评审**：首轮 Spec ✅ / Changes requested（2 Important：无条件关闭生产沙箱、根因误称 Chrome 157 回归）→ 控制器裁定 Rulings 303–307 → 修复轮 `55ccf59` → 定向复评审 clean。
- **控制器终验**（`/tmp/fp-exportdiag-ctrl2/`）：14/15 命令 exit 0；`pnpm test` 218/218、`pnpm verify` turbo 8/8、全量 `--all-server -v` **149 PASS / 4 SKIP / 0 FAIL**；第 15 项 `FASTPOSTER_CHROME_SANDBOX=1` 预期 exit 1；3 个既有 PNG 用例（`admin-catalog.spec.ts:11`/`:111`、`templates.spec.ts:274`）各 `1 passed / exit 0`。
- **A10.4-R 固定样本像素对比**：见上文 A10.4-R，`magick compare -metric AE = 0 (0)`、两侧 SHA-256 均 `f36c78f9…`、1200×1600 8-bit sRGB；基线 `124b4ea` 已在独立临时目录单独采样，历史 `0 (0)` 未被当作本轮证据。
- **本轮新增**：`renderer_sandbox_test.go` 的选项数断言由硬编码 `+3` 改为以 unset 分支为基准的相对断言（消除与 chromedp 默认选项数量的耦合），7/7 子用例 PASS、`gofmt` 与 `git diff --check` clean。

### 修复后全量 E2E 矩阵（2026-11-13，CfT 156.0.8078.47 / Node 22.22.2）

按 `AGENTS.md` 逐 spec 独立临时栈（`reuseExistingServer: false`）跑完 20 个 spec，每次起全新服务栈，`GOPROXY=off GOSUMDB=off`，`CHROME_PATH` 指向 CfT `156.0.8078.47`，开工前预构建 renderer。日志 `/tmp/fp-a104-20261113/logs/full-e2e-*.log`，逐组 exit 与用例数 `/tmp/fp-a104-20261113/logs/full-e2e-exits.tsv`。

| 结果        | 数量 | 说明                                                                                                                                                                                                                                           |
| ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 用例总数    | 153  | 20 个 spec（A 批新增用例后多于历史 139）                                                                                                                                                                                                       |
| 首轮 passed | 144  | 覆盖 A10.3 记录的 11 个「下载原尺寸 PNG」失败用例所在全部 spec：`export` 3/3、`full-flow` 3/3、`image-upload` 2/2、`project-permanent-deletion` 13/13、`editor-fonts` 12/12、`templates` 7/7、`admin-catalog` 5/5 —— 修复后**零 PNG 导出失败** |
| 首轮 failed | 4    | `admin-layout` 2（登录态 URL）、`copy` 1（单栈 180s 超时）、`ui-controls` 1（URL 状态），均非 PNG 导出                                                                                                                                         |
| skipped     | 5    | `ui-baseline.spec.ts` 截图用例需 `FP_UI_BASELINE=1`，默认跳过；五档布局守卫 5 例真实 PASS                                                                                                                                                      |

**4 个失败的独立栈对照**：按 A09/A10 既定做法，用互斥 `-g` 每组起全新栈，并分别在 CfT `156.0.8078.47` 与本机系统 Chrome `157.0.8103.78` 各跑一遍（`/tmp/fp-a104-20261113/rerun-failures.sh`）：

| 用例                                                        | CfT 156           | Chrome 157        |
| ----------------------------------------------------------- | ----------------- | ----------------- |
| `admin-layout` brand link keeps the one-time token          | 1 passed / exit 0 | 1 passed / exit 0 |
| `admin-layout` browser history keeps the one-time token     | 1 passed / exit 0 | 1 passed / exit 0 |
| `copy` administrator maintains a five-level copy tree       | 1 passed / exit 0 | 1 passed / exit 0 |
| `ui-controls` closed select values share the trigger center | 1 passed / exit 0 | 1 passed / exit 0 |

8/8 全绿，证明首轮 4 例是**单 spec 内共享栈状态 / 调度竞争**（`copy` 五层树用例在单栈内等待「保存作品」按钮达 180s 超时），不是产品 RED，也不是 Chrome 版本差异。`ui-baseline` 的 5 个 SKIP 是有开关的截图用例，不计失败、不写成 PASS。

### 锁定工具链回归（Node 24.21.0 + CfT 156.0.8078.47）

`/tmp/fp-a104-20261113/run-node24-full.sh`：`PATH` 前置 `~/.nvm/versions/node/v24.21.0/bin`（实测 `node v24.21.0` / `pnpm 11.25.0`），`CHROME_PATH` 指向 CfT `156.0.8078.47`，先在 Node 24 下重建 renderer，再逐 spec 起独立临时栈。

| 项           | 结果                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 固定导出样本 | `FP_EXPORT_BASELINE_PATH=…/current-node24.png` → `1 passed` / exit 0；SHA-256 仍为 `f36c78f9…`，`magick compare -metric AE` 对 `baseline.png` = `0 (0)`，1200×1600 8-bit sRGB 56419 B                    |
| 全量矩阵     | 20 spec / 153 用例：**145 passed / 3 failed / 5 skipped**（`ui-baseline` 截图开关用例）                                                                                                                  |
| PNG 导出     | 所有相关 spec 零失败（`export` 3/3、`full-flow` 3/3、`image-upload` 2/2、`project-permanent-deletion` 13/13、`editor-fonts` 12/12、`templates` 7/7、`admin-catalog` 5/5、`copy` 7/7）                    |
| 3 个失败     | `admin-layout` 2（登录态 URL）+ `ui-controls` 1（`/register` vs `/login`），与 Node 22 首轮同类；互斥 `-g` 独立栈补跑 **3/3 `1 passed` / exit 0**（`/tmp/fp-a104-20261113/logs/node24-rerun-exits.tsv`） |

这直接补上历史 blocker 要求的「匹配 Chrome 156 / Node 24 环境」（精确 `.48` 官方不可得，用同通道 `.47`；已由对照实验证明该补丁号与像素、导出结果无关）。

### 最终门槛（2026-11-13，14/14 exit 0）

`/tmp/fp-a104-20261113/final-gate/exits.tsv`，全程 `GOPROXY=off GOSUMDB=off`：

| 命令                                                                                                               | 结果                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pnpm contracts:check`                                                                                             | `generated contracts match the Thrift IDL` / exit 0                                                          |
| `pnpm typecheck` / `pnpm test`                                                                                     | exit 0 / **32 文件 · 218 用例**                                                                              |
| `pnpm verify`                                                                                                      | turbo **8/8**                                                                                                |
| `go test ./internal/... -count=1` / `pnpm test:server`                                                             | exit 0 / exit 0                                                                                              |
| `python3 tools/test-integration.py --all-server -count=1 -v` ×2                                                    | 各 **167 PASS / 10 SKIP / 0 FAIL**（`--- PASS` 含子测试行，与 EXPORT-DIAG 的 149 为不同计数口径，均 0 FAIL） |
| `pnpm --filter @fastposter/renderer build`                                                                         | exit 0（119 modules）                                                                                        |
| `go test ./server/internal/exports -run TestChromeSandboxGate -v`                                                  | **7/7 子用例 PASS**                                                                                          |
| `gofmt -l` / `git diff --check` / `prettier --check README.md` / `python3 -m json.tool deploy/toolchain.lock.json` | 0 文件 / exit 0 / 合规 / JSON 有效                                                                           |

新增章节按 `AGENTS.md` 定向格式化并单独通过 Prettier 校验；`AGENTS.md` 与本验收入口的全文件 Prettier 在 HEAD 版本即因 A 批历史表格而 exit 1，属既有偏差，未做全仓格式化。最终门槛日志 DSN / 凭据扫描 **0 命中**。

### 批次级复议裁定（Ruling 320）

**A、B 两批状态由 `IN_PROGRESS` 改为 `VERIFIED`。** 依据：① A10.4-R 固定样本像素对比在基线 `124b4ea` 与 HEAD 两侧真实执行，`AE = 0 (0)`、字节相同，并在 CfT 156 / 系统 Chrome 157 / Node 22 / Node 24 四种组合下复现；② 修复后全量 20-spec / 153 用例矩阵在 Node 22 与锁定 Node 24 各跑一遍，全部 PNG 导出用例零失败，首轮少量单栈失败经互斥 `-g` 独立栈 8/8 与 3/3 全绿，无产品 RED；③ 最终门槛 14/14 exit 0；④ 归因订正与运维开关已落入验收入口、`AGENTS.md`、`README.md`、`deploy/toolchain.lock.json` 与两个账本。Rulings 160/273 设定的「复议前置条件」已全部满足，故按用户 2026-11-13 的显式授权做出本裁定。

**明确保留、不因 `VERIFIED` 而消失**：

- A 批 **67** 项、B 批 **8** 项 deferred Minor 仍按历史裁定推迟到全分支评审；EXPORT-DIAG 遗留的 1 项 ⚠️（测试断言硬编码 `+3`）已在本批次闭合。
- `open_verification_items` 中的 FP-14「替换背景」文案写回、Ruling 121 `ProjectDeletionQueue` 成功门禁 + 失败注入 E2E、FP-09「版本变化经 409 检测」矩阵说明、A04–A07 证据落盘汇总等仍是未完成项，均非本轮产品回归，归属未来全分支评审。
- 环境与运维限制：精确 Chrome `156.0.8078.48` 官方 feed **0 条**不可得；生产默认仍无 Chrome 进程沙箱，加固需 `FASTPOSTER_CHROME_SANDBOX=1`，该值在本受限宿主会 SIGTRAP、导出不可用。
- **`completion != deployment`**：**未部署**。按 Ruling 276 不触发全分支最终评审、不删除 `.superpowers/sdd/...` 工作区、不触发 finishing-a-development-branch。10 个顶层 `??` 用户资产全程未动。

**历史与当前区分**：A10 / B01 / B02 / B03 各章节内的「`IN_PROGRESS`」「`NOT_AUTHORIZED`」「A10.4 `BLOCKED`」均为各任务完成时点的原始结论，按 FP-14 单一执行记录原则保留、不改写；**当前结论以 A 批 front matter、B 状态 YAML 与本章节为准**。
