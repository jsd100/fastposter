# 回收站作品彻底删除：独立审查记录

日期：2026-11-05。审查 HEAD：`7f09ca6`，功能实现范围：`2feaf0c..d4e8344`，并检查当前工作树。依据：2026-11-04 的永久删除设计和实施计划。

本轮只做审查和验证，不修复业务代码。为确认连接池问题临时添加过一个回归测试，验证后已移除；本记录为本轮新增交付文件。

结论：发现 6 项 P2，涉及连接池可用性、错误任务展示、后台分页、完成反馈和故障日志。现有测试全部通过不等于这些边界已被覆盖。未确认新增的越权删除、共享素材误删或持久任务无法恢复问题；这不是对不存在其他缺陷的保证。

## 1. [P2] 不存在作品的删除分支在事务未释放时再次借连接

位置：`server/internal/projectdeletions/service.go:173-174`，相同模式也在 `187-188`；`taskOrMissing` 经 `findTaskByProject` 使用 `s.DB.QueryRowContext`。

`acceptOnce` 已通过 BeginTx 持有一条池连接。当作品不存在，或者竞争删除者等待锁后发现作品已被删除时，它在 defer Rollback 执行前调用 taskOrMissing，再向同一个 DB 池申请另一条连接。若连接均被这些外层事务或等待其锁的事务占用，请求会等待连接而无法执行最终 Rollback，形成池级阻塞。

生产池上限为 12（`server/internal/app/mysql.go`），问题会在池饱和的并发条件下出现，不能将缺失 ID 的 NOT_FOUND 查询设计为必须再有一条空闲连接。

已用真实 MySQL 最小复现：沿用 `newDeletionFixture`，设置 `SetMaxOpenConns(1)`，给请求 800ms context，调用公开 Accept 删除 `review-missing-project`。预期 NOT_FOUND，实际 `context deadline exceeded`，池 `WaitCount=1`。限制到一条连接用于确定性复现资源依赖，不代表生产默认只有一条连接。

临时测试命令：`GOCACHE=/tmp/fastposter-review-gocache python3 tools/test-integration.py --all-server -run '^TestReviewUnknownProjectWithSingleConnection$' -count=1 -v`，按预期暴露缺陷而失败。临时文件已移除。

建议：用当前事务读取已有任务，或显式释放事务后再访问 DB 池；两个 sql.ErrNoRows 分支都处理。补连接池受限和并发重复删除测试。

## 2. [P2] 重试一个任务会覆盖本页的其他任务

位置：`apps/web/src/features/projects/useProjectDeletion.ts:146-152`；关联 `packages/api-client/src/project-deletion.ts:11`。

retry 的 setQueryData 对当前页每个任务调用 mergeDeletionStatus(task, deletion)，但 helper 在两个任务 ID 不同时直接返回 next。于是页面有 A、B 两个任务，重试 A 后缓存变成 A、A；B 的作品名称、状态和重试入口消失，还产生重复 React key。

列表重新请求成功后可以恢复，但网络慢或请求失败时错误状态持续，不能依赖刷新修正错误缓存。

已直接执行仓库真实 helper 复现：输入任务 ID `[a,b]`，按调用端相同 map 逻辑合并 A 的响应，输出 `[a,a]`。

建议：调用端只在 task.id === deletion.id 时合并，其余保持原值。补至少两个不同任务、单任务重试且后续列表失败的测试。

## 3. [P2] 管理员待清理队列可能隐藏仍未完成的任务

位置：`apps/admin/src/features/projects/ProjectDeletionQueue.tsx:63-65`。

队列有 25 个未完成任务，管理员停留第 2 页。当该页最后一个任务完成时，接口变成 total=24、deletions=[]。组件直接 return null，同时隐藏分页，没有自动回到第 1 页；其余 24 个未完成任务及失败重试入口都不可见，持续轮询也不会修正页码。

建议：收到有效空页且 page>1 时回退页码；不能把当前页为空当作全队列为空。补后台队列 25→24 的测试，而不是仅测试用户作品分页。

## 4. [P2] 管理员删除作品后可能停在无法翻回的空页

位置：`apps/admin/src/features/Metadata.tsx:256-264`；Pager 在同文件 `484` 行根据 total>24 决定是否显示。

筛选结果有 25 件作品，在第 2 页彻底删除唯一一件后，confirmDelete 只 invalidate 查询，没有回退 page。查询变成第 2 页为空、总数24；Pager 被隐藏，界面显示空状态且无法点击上一页，尽管第 1 页仍有24件作品。

这与第3项分别属于作品列表和独立的清理队列，修其中一处不会自动修另一处。

建议：后台作品列表补与用户端一致的有效页回退，覆盖删除、筛选后的数量收缩，并在请求完成后判断，避免读取加载中的空数据。

## 5. [P2] 快速完成或一次详情请求失败会丢失最终完成反馈

位置：`apps/web/src/features/projects/useProjectDeletion.ts:51-52,87-88,116-137`。

完成提示依赖任务先出现在未完成列表，再从列表消失：

- Accept 返回的任务没有直接加入 watched。若清理快于 IndexedDB 清理和首次列表刷新，列表一直为空，这次删除不会经过 confirmCompleted，即使返回的任务已完成也不会处理完成提示。
- 若已观察到的最后一个任务消失，列表 total=0 会立即关闭轮询；随后 GetProjectDeletion 只要遇到一次临时网络失败，catch 所说的“下次轮询重试”就不会发生。页面失去持续重查完成状态的机制。

文件清理本身仍继续，不应将这项描述为服务端删除失败；问题是用户无法得到设计要求的明确完成结果，相关完成缓存刷新也可能缺失。

建议：从 Accept 响应开始追踪任务；对待确认完成的 ID 独立轮询／有界退避重试，不能只由未完成列表 total 决定是否继续。补极速清理、空队列详情失败一次后恢复的测试。

## 6. [P2] 常见文件清理错误被持久化后完全静默

位置：`server/internal/projectdeletions/worker.go:78-86`；Run 在 `40-44` 行只记录非 nil error。

文件权限、磁盘等错误导致 execute 失败后，w.fail 成功持久化 retry_wait 会把 e 覆盖为 nil，RunOnce 随即返回 true,nil。因此正常的自动失败重试没有任何故障日志，也不记录 task ID。

任务和内部错误仍存于数据库，可靠重试没有因此消失；但 deploy/local.md 告诉运维通过重复日志排查，实际只看 worker 日志无法定位哪个任务持续失败及底层原因，用户接口也只提供 CLEANUP_FAILED。

建议：持久化失败状态后记录 task ID、尝试次数及内部 cause，注意不泄漏凭据；日志与对外安全错误摘要分开。补捕获 logger 的失败重试测试。

## 已有缺口与低优先级说明

- GC 的 `pruneAssets` 在 `server/internal/storage/gc.go:418` 直接 removeFiles(result.Keys)，没有用 StorageKeyReferenced 判断同 key 是否仍被其他版本占用。若数据库存在跨版本共享实际 key，可能误删存活版本文件。此模式在基线已存在，生产常规上传使用 NewKey，作品复制共享的是同一素材版本，因此不作为本次新引入的6项问题之一。设计明确支持共享 key，建议另补 GC 级别测试与保护，不能只测退休 helper。
- 2026-11-04 验收记录对 v1 备份升级的描述容易被理解为启动自动迁移；实际仍需按 deploy/backup.md 使用匹配版本恢复，再显式 migrate。运行时不会自动迁移，应统一说明。

## 本轮验证

| 检查 | 本轮结果 |
| --- | --- |
| `pnpm verify` | 通过：生成契约一致、类型检查通过、24个测试文件／135条前端单测通过、8个 workspace 构建任务成功（Turbo缓存） |
| `go test ./internal/... ./tools/...` | 通过，部分结果命中 Go 缓存 |
| `GOCACHE=/tmp/fastposter-review-gocache go vet ./server/... ./tools/... ./internal/...` | 通过 |
| `GOCACHE=/tmp/fastposter-review-gocache python3 tools/test-integration.py --all-server -count=1 -v` | 通过，130项顶层测试 PASS，10项条件 SKIP，使用真实受保护 MySQL |
| `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts` | 9/9通过，48.1秒 |
| `pnpm exec playwright test tests/e2e/autosave.spec.ts tests/e2e/export.spec.ts tests/e2e/projects.spec.ts tests/e2e/session-sync.spec.ts` | 10/10通过，52.9秒 |
| 迁移、GC兼容、维护暂停、备份恢复7项定向复核 | 7/7通过，无跳过；与全量 MySQL 有重叠，不重复累计 |
| 列表重试的真实 helper 复现 | 证实 `[a,b]` 被改成 `[a,a]` |
| 不存在作品／单连接池定向复现 | 按预期暴露缺陷：超时替代 NOT_FOUND；临时测试已移除 |

首轮 Go 使用系统缓存时出现部分缓存文件访问拒绝，虽然具体测试已跑完，整条命令退出1；更换隔离 GOCACHE 后完整命令退出0。首轮沙箱内 Chrome 启动即 SIGABRT、9项均未进入业务断言；经自动授权在沙箱外重跑后9项通过。两类环境失败均不作为功能缺陷。

10项 Go 跳过包含两项 opt-in 图片容量、七项 opt-in Chrome渲染／容量，以及只由 Playwright 启动的 TestBrowserStack。本轮专项及回归共19项浏览器测试通过，没有宣称整个 Playwright 套件已全量通过；其他模板、字体和容量路径未全部重新执行。

## 设计覆盖核对

| 方面 | 核查结果 |
| --- | --- |
| 本人/admin/普通用户/需改密/禁用会话 | 服务层和适配器均有校验；已有任务查询继续鉴权，未发现已证实越权 |
| 主记录、历史、导出快照及引用删除 | 接受事务原子处理，损坏文档不要求解析；相关测试通过 |
| 独占实际文件、共享版本与资源保护 | 新 worker 和共享版本检查路径存在；真实文件和引用测试通过；旧 GC 的跨版本同 key 缺口另列 |
| 删除与恢复、导出创建/领取竞争 | 锁顺序及状态复查已接入，定向并发测试通过；连接池再借用问题另列 |
| 持久化清理、租约、故障重试、进程重启 | 有工作表、token CAS、退避与恢复测试；失败日志遗漏另列 |
| 维护独占锁及备份恢复 | writer lease、schema2和三表备份清单接入；恢复测试通过 |
| 两个入口、确认、不可恢复、失败重试 | 主流程E2E通过；多任务缓存、后台分页、完成反馈仍有问题 |
| IndexedDB与多标签、原作品NOT_FOUND | 停止保存和草稿阻止路径已接入，专项及autosave/session回归通过 |
| 管理员审计与数据最小化 | 接受事务与审计一起提交，接口不返回正文、文件key或内部错误 |

建议先修复上述6项并补对应回归，再重新执行定向验收。修复前不把现有验收记录解读为所有设计边界已经满足。

## 修复结果（2026-11-05 后续修复轮）

原审查结论保留；本节记录对应修复和修复后的验证。每项修复都先写回归测试并确认在旧代码上失败，再改实现。

| 编号 | 修复 | 回归测试 | 修复前失败证据 |
| --- | --- | --- | --- |
| 1 | `service.go` 新增 `rowQuerier`，`findTaskByProject`/`taskOrMissing` 接受查询器；两个 `sql.ErrNoRows` 分支改为在现有事务 `tx` 内查询，不再向池借第二条连接 | `TestAcceptUnknownProjectWithSingleConnection`（`SetMaxOpenConns(1)`，800ms 超时，期望 `NOT_FOUND`） | `context deadline exceeded`，期望 `NOT_FOUND` |
| 2 | 新 `replaceDeletionTask` 只在 `task.id === next.id` 时合并，其余行原样返回；`retry` 改用该函数 | api-client 单测“replaces only the matching task when one item is retried”，断言 ID 仍为 `[task-1, task-2]` 且未修改行保持同一对象 | helper 不存在，重试 A 后缓存变为 `[A, A]` |
| 3 | 新增共享纯函数 `pageAfterShrink`；清理队列在收到有效数据后回退到总数对应的最后一页 | `pagination.test.ts`（25→24、跨多页收缩、total=0、仍有数据不跳页）及 E2E“admin cleanup queue returns to the previous page when its last row finishes” | 第 2 页为空时队列与分页整体消失，E2E 在旧前端上失败 |
| 4 | `Metadata.tsx` 的作品列表接入同一 `pageAfterShrink`，在查询返回后根据 `projects.length` 回退 | 同上单测及 E2E“admin project list returns to the previous page after deleting its last row” | 删除第 2 页唯一作品后停在空页且无法翻回，E2E 在旧前端上失败 |
| 5 | `watched` 从 Accept 响应开始记录；`listed` 单独记录当前列表；新增独立轮询，只要任务仍在 `watched` 且不在当前列表就调用 `confirmCompleted`，不再依赖未完成列表的 total 开启轮询 | E2E“completion feedback survives a queue that never lists the accepted task”（列表始终为空，仍须出现成功提示） | 旧 hook 下成功提示不出现，E2E 失败 |
| 6 | `worker.fail` 持久化并提交 `retry_wait` 后记录 task ID、attempts 和内部 cause；对外安全错误码不变 | `TestCleanupFailureLogsTaskAndCause` 捕获标准库日志，断言任务落库为 `retry_wait`/`CLEANUP_FAILED`/attempts=1 且日志含任务 ID、`attempt 1` 与 cause | 修复前日志为空，测试失败 |
| GC | `pruneAssets` 改用 `removeRetiredFiles`：退休元数据后逐 key 在事务内复查 `StorageKeyReferenced`，仍被存活版本、导出结果或暂存上传引用时不删文件 | `TestGCPreservesFileSharedByAnotherVersion`（孤儿版本与存活版本共享 `normalized_key`） | 修复前共享文件被删，测试失败 |

仍存限制：GC 的 dry-run 分支只按批次候选 key 估算待删数量，未逐 key 复查引用，因此 dry-run 可能把共享 key 误报为可删除；真实删除路径已受保护。

修复后重新执行：

| 检查 | 结果 |
| --- | --- |
| `pnpm verify` | 通过：契约一致、类型检查通过、25 个测试文件／139 条前端单测通过、8 个构建任务成功 |
| `pnpm test:server` | 通过 |
| `python3 tools/test-integration.py --all-server -count=1 -v` | 通过，133 项顶层测试 PASS，10 项条件 SKIP，0 FAIL，使用真实受保护 MySQL |
| `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts` | 13/13 通过，51.0 秒 |

新增的 4 条 E2E 曾在前端修复代码临时 stash 后全部失败，恢复代码后全部通过。未重新执行整个 Playwright 套件；本轮只重跑永久删除专项。10 项 Go SKIP 仍为 opt-in 的 Chrome 渲染／容量测试。
