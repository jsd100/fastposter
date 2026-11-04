# FastPoster 永久删除与异步文件清理验证

日期：2026-11-04。分支：`feat/fastposter`。实施提交：`2feaf0c..edde2bf`（Task 1–7）；Task 8 的验收用例、验证记录与截图单独提交。

环境：本机 macOS（arm64）、Go 1.27、MySQL 8、Chrome；Playwright `workers:1`，隔离测试栈每次新建一次性 MySQL schema，并启动 core、gateway、用户站（15173）、管理站（15174）、导出 worker 与清理 worker。触屏与窄屏为视口/触摸模拟，不是真机。

## 验收范围

- 只有回收站中的作品可以永久删除；普通作品返回 409，普通用户调用管理端删除接口返回 403。
- 删除后共享素材（被其他作品、历史版本、导出任务、资源或资源版本引用）保留；独占图片与导出文件由持久化清理任务移除。
- 有 queued/running 导出任务时拒绝删除，等待结束后可删除。
- 用户回收站、管理端两个入口使用服务端决定的作用域；管理端必须勾选归属确认后才能删除。
- 清理任务状态 `pending/running/retry_wait/completed` 持久化，刷新、重启和失败重试后继续；超过 30 天的未完成任务仍显示。
- 编辑页在作品被删除后停止自动保存，已打开的第二个标签页晚到的 PUT 不复活草稿。

## 实际命令与结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm verify` | 0 | 契约漂移检查通过；类型检查通过；Vitest 24 个文件 / 135 个用例通过；Turbo 构建 8/8 成功（仅既有 >500 kB chunk 警告） |
| `pnpm test:server` | 0 | `go test ./server/... ./tools/...` 全部 `ok`；未配置真实 DSN 时 integration 包为 `[no tests to run]`，真实 MySQL 结果见下一行 |
| `go test ./internal/...` | 0 | 根目录共享配置包 `ok` |
| `python3 tools/test-integration.py --all-server -count=1 -v` | 0 | 147 PASS / 0 FAIL / 10 SKIP，24.978s；跳过项见“跳过说明” |
| `pnpm test:e2e` | 1 | 21 passed / 52 failed / 2 skipped，8.4m；失败从第 21 个用例起全部是注册 429，属已知测试栈限流，见“全量 E2E 与注册限流” |
| E2E 分组 A | 0 | 14 passed（editor-mobile、editor-richtext、editor-settings、export、image-upload） |
| E2E 分组 B | 0 | 10 passed（full-flow、notifications、session-sync） |
| E2E 分组 C | 0 | 13 passed（project-permanent-deletion 9、projects 2、templates 2） |
| E2E 分组 D | 0 | 17 passed（ui-controls） |
| `FASTPOSTER_CAPTURE_EVIDENCE=1` 定向运行 | 0 | project-permanent-deletion 9/9 passed，38.7s，采集 4 张截图 |

分组运行均使用独立的 `pnpm exec playwright test <files>`，每次重新创建一次性数据库与测试栈。首轮全量运行中先通过的前 20 个用例与 `templates` 空白模板用例已计为通过；分组运行与其重叠的用例在去重后，本套件 73 个可执行用例全部通过，另有 2 个 opt-in 采集用例跳过。

## 全量 E2E 与注册限流

直接运行完整 Playwright 套件时，第 21 个用例起注册全部失败，页面停留在 `/register`，API 返回非 2xx。根因是浏览器测试栈使用 `auth.NewService(db, nil)`（无 Redis），注册限流为每 IP 每 10 分钟 20 次（`server/internal/auth/service.go:61`）；全套件从 `127.0.0.1` 注册超过 20 个账号。该限制与永久删除实现无关，`docs/verification/editor-experience.md` 已记录相同现象。

因此以分组运行作为功能覆盖证据。分组按注册次数划分，每组低于 20 次，且每组使用全新测试栈（进程内限流器随之重置）。9 个永久删除用例在分组 C 与证据运行中均通过。

## 永久删除 E2E 用例

`tests/e2e/project-permanent-deletion.spec.ts` 共 9 个用例：

1. 删除对话框默认聚焦“取消”，取消后作品保留，刷新后仍保留。
2. 确认删除后展示持久化清理进度与“正在清理相关文件…”，清理完成后任务消失；刷新后回收站为空且无残留任务。
3. 复制作品共享背景图；永久删除原作品后，副本仍可打开、编辑并导出。
4. 管理员可搜索正常作品但无删除入口；作品的用户端删除接口对普通用户返回 403；回收站作品需勾选归属确认后才能删除，删除后用户回收站同步为空。
5. 导出 queued/running 时永久删除返回 409 `CONFLICT`（提示导出任务尚未结束）；导出结束后删除成功。
6. 回收站 25 件作品分页：删除第 2 页唯一一件后回到第 1 页，显示 24 件，不再出现“下一页”。
7. 清理任务按账号隔离：用户 A 删除后退出，用户 B 的回收站与任务列表均看不到旧任务，列表 total 为 0。
8. `retry_wait` 状态刷新后保留，点击“重试清理”后恢复清理中；该用例用 `page.route` 模拟列表与重试响应。
9. 两个编辑标签页：作品在另一页彻底删除后，两页均出现删除提示并停止保存；被挂起的晚到 PUT 返回 404，草稿被清除，之后继续输入不会复活草稿。PUT 使用 route barrier 控制到达时机，不用固定 sleep。

故障注入只使用 `page.route` 模拟前端失败状态的展示与重试；真实文件删除失败、租约竞争、重启恢复由 Go 测试中的 FileStore/MySQL 场景证明，生产代码没有“模拟失败”接口。

## 截图证据

截图位于 `docs/verification/2026-11-04-project-permanent-deletion/`，均为测试账号与测试作品，不含密码或私有数据。

| 文件 | 内容 | 真实性 |
| --- | --- | --- |
| `user-confirm.png` | 360px 窄屏“彻底删除作品？”对话框，默认焦点在“取消” | 真实 UI 与真实服务 |
| `cleanup-pending.png` | 回收站待清理任务卡片，显示“正在清理相关文件…” | 删除请求、任务落库与 worker 均真实；仅列表首个响应由 route 屏障回放真实 DELETE 返回的任务，用于稳定观察 pending 窗口 |
| `cleanup-retry.png` | “模拟清理任务”显示部分文件未清理及“重试清理” | 前端状态模拟（`page.route`），任务标题明确标注“模拟清理任务” |
| `admin-confirm.png` | 管理端删除对话框，归属确认未勾选时“彻底删除”禁用 | 真实 UI 与真实服务 |

## Schema v2 升级与旧备份恢复

- `TestUpV1ToV2PreservesProjects`：从 v1 schema 升级后，既有用户、作品、历史版本与素材引用数量不变，并创建 `project_deletions`、`project_deletion_assets`、`project_deletion_files`。
- `TestUpV2Idempotent`：重复执行升级不改变 schema 版本、迁移记录或已有清理任务。
- `TestDownRemovesDeletionTablesBeforeAssets`：回滚先移除删除相关表，再移除素材表，无残留表。
- `TestMigrationRoundTripAndEmojiJSON`：升降级往返与含 emoji 的文档 JSON 保持可用。
- `TestRecoveryRestoresDatabaseFilesAndPrivateAccess`：备份后恢复数据库与数据目录，作品、导出结果、素材文件与私有访问权限一致；恢复包含 `retry_wait` 清理任务及待删除文件记录。
- `TestRestartUsesSameAbsoluteDataDir`：服务重启继续使用同一绝对数据目录。
- `TestCleanupRestartCompletesDurableTask`：把导出目录设为只读后启动清理 worker，任务进入 `retry_wait`、错误码 `CLEANUP_FAILED`、文件仍存在；恢复权限并重启 worker 后任务以第 2 次尝试完成，文件被删除、文件工作行清空、作品标题被清除。
- 旧备份恢复说明：先按 `deploy/backup.md` 恢复数据库与同一 `APP_DATA_DIR`，再启动服务；v1 备份在启动迁移时升级到 v2，未完成清理任务会继续执行。

## 物理文件与共享素材断言

- `TestCleanupDeletesOnlyUnreferencedFiles`、`TestCleanupAfterGCRetiredMetadata`：仅删除无引用的独占文件，已回收元数据不误删仍在使用的文件。
- `TestGCDoesNotDeleteActiveOrLeasedFiles`：活跃或租约中的文件不被回收。
- `TestRetirePreservesEveryReferenceKind`、`TestRetireOnlyOneVersion`、`TestRetireUsesCurrentReferences`：作品、历史版本、导出、资源、资源版本的引用都阻止素材版本退休。
- `TestPublishedResourceAndOtherTrashProtectAssetFromRetirement`：已发布资源与另一件回收站作品的引用继续保护素材。
- `TestCleanupExpiredLeaseAndTwoWorkers`、`TestCleanupMaintenancePause`：租约过期可被第二个 worker 接管，维护暂停时不执行清理。
- E2E 用例 2/3 从用户侧复验：清理完成后任务消失，而共享背景图在副本中仍可打开和导出。

## 跳过说明

`python3 tools/test-integration.py --all-server -count=1 -v` 跳过 10 项，均与本功能无关：

- `TestNormalizedLosslessOutputCanExceedUploadSize`、`TestNormalizeAtPixelAndSideLimits`：需 `FASTPOSTER_IMAGE_CAPACITY_TEST=1`。
- `TestExportWorkerRendersRealPNG`、`TestRenderMixedFontFamilies`、`TestRenderMixedChineseFonts`、`TestRenderCapacity`、`TestRenderEmptyAndRepeatable`、`TestRender4000x6000`、`TestRenderFractionalBlockAtRightEdge`：需 `FASTPOSTER_RENDER_TEST=1` / `FASTPOSTER_CAPACITY_TEST=1` 的真实 Chrome 渲染测试。
- `TestBrowserStack`：仅由 Playwright `webServer` 拉起。

Playwright 跳过的 2 项是 `ui-baseline` 的 opt-in 截图采集用例，不计入功能用例。

## 限制

- E2E 全量单次运行受注册 IP 限流影响无法完成，验收以分组运行覆盖；未修改生产限流配置来绕过该限制。
- 浏览器验证仅本机 Chrome；窄屏与触屏为模拟，未在真实移动设备或 Safari 上验证。
- `cleanup-retry.png` 为前端状态模拟；真实失败重试与重启恢复由 Go 测试证明，两者不互相替代。
