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
last_verified_commit: "d6c3d45"
current_task: T01
next_step: T01.5
requirements: [UI-13, UI-14]
changed_paths:
  - tests/e2e/ui-baseline.spec.ts
  - tests/e2e/export.spec.ts
  - docs/verification/2026-11-05-antd-migration.md
decisions:
  - "T01 过时 Inter 点击属于截图脚本与当前禁用策略不一致；改为 toBeDisabled 并保留菜单状态截图。"
red_check: ""
checks: []
artifacts: []
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
