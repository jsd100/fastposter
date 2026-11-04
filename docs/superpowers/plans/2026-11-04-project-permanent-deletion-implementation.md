# Project Permanent Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户和管理员可彻底删除回收站作品，可靠清理独占托管文件，保护共享资源，并可查询、重试未完成清理。

**Architecture:** 新增 `projectdeletions` 领域包负责接受删除、任务查询、重试和持久化执行；`storage` 提供可复用的素材退休判定。新增独立 `cleanup-worker`，复用维护门禁与 WriterGate，随开发及完整测试栈启动。数据库先原子移除作品和引用，后台按持久化清单删除文件；两个站点共享 API 与确认／状态展示控件。

**Tech Stack:** 现有 React/TypeScript、TanStack Query、Base UI 共享控件、Go、MySQL 8+、FileStore；不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-11-04-project-permanent-deletion-design.md`（用户已确认）。实施者先读该文档，本文不替代其中的权限和一致性约束。

## Global Constraints

- “只删除已无其他引用的相关文件”；“共享资源会保留”。正常作品不能直接彻底删除。
- “任务状态为 `pending`、`running`、`retry_wait`、`completed`”；物理清理完成前不能返回全部成功。
- “存在 `queued` 或 `running` 导出任务时拒绝本次删除”；不增加强制取消。
- “最大不超过 5 分钟”；自动重试不设达到次数即放弃的终止状态。
- “不执行全盘扫描或顺带清理其他孤儿”；直接相关文件不等待现有 GC 的 24 小时宽限期。
- “不增加正文或私有图片访问权限”；仅后台最小元数据和安全错误摘要对外开放。
- “数据库测试仅使用 `fastposter_test_*`”；DSN 和密码不得出现在日志、命令参数或提交中。
- IDL 为契约源；只能生成 `server/gen`、API generated.ts 和生成路由，不手改。
- 保留现有依赖与格式规范；修改前记录工作区状态，只提交当前任务文件。执行时用 using-git-worktrees 确认隔离工作区，不能把设计阶段工作区状态当作当前事实。

## Review Focus

1. 作品 document 损坏：删除仍成功，所有历史素材可收集；Task 3。
2. 请求超时后跨用户重复删除同一 ID：不产生第二任务，不泄漏原任务；Task 3、5。
3. 文件已删但状态落库前崩溃／维护 GC 先移除素材行：重启依据持久化 key 收敛，不误报完成；Task 4。
4. 回收站最后一页最后一件／未完成清理超过 30 天：仍能看见任务，分页正确退回；Task 6、8。
5. 旧标签页已启动的 IndexedDB put 晚于删除事件完成：旧草稿不能复活，账号切换不能串状态；Task 7、8。

## 文件与接口地图

新增主要文件（测试与实现相邻；HTTP/E2E 沿用仓库目录）：

- `server/migrations/000002_project_deletions.{up,down}.sql`：任务、候选、逐文件工作表。
- `server/internal/storage/reclaim.go`、`reclaim_test.go`：当前引用检查、素材版本锁与退休、实际 key 的存活检查。
- `server/internal/projectdeletions/{service,queries,worker}.go` 与对应 `*_test.go`：接受事务、权限查询、租约执行，避免巨型服务文件。
- `server/cmd/cleanup-worker/main.go`：独立后台进程，配置沿用现有 config。
- `packages/ui/src/ProjectDeletion.tsx`、`ProjectDeletion.module.css`、`project-deletion.test.ts`：纯展示确认和状态，不绑定站点 request/session。
- `packages/api-client/src/project-deletion.ts`、`project-deletion.test.ts`：纯状态归并与请求结果判定，供两站复用。
- `apps/web/src/features/projects/{useProjectDeletion,ProjectDeletionQueue}.tsx`：用户权限范围的查询及动作、待清理分区；hook 文件可用 `.ts`。
- `apps/admin/src/features/projects/ProjectDeletionQueue.tsx`：管理员待清理列表与重试；现有 Metadata.tsx 保留作品页入口。
- `apps/web/src/features/editor/projectDeletionSync.ts`：同源跨标签页删除事件。
- `server/tests/integration/project_deletions_http_test.go`、`cleanup_restart_test.go`、`tests/e2e/project-permanent-deletion.spec.ts`。

核心 Go 接口固定如下；所有 `Task` 中展示字段可为空（completed 后清空），不能保存正文：

```go
// package storage
type AssetVersionRef struct { AssetID string; Version uint64 }
type ReclaimResult struct { Retired bool; Keys []Key }
func RetireUnreferencedVersion(ctx context.Context, tx *sql.Tx, ref AssetVersionRef) (ReclaimResult, error)
func StorageKeyReferenced(ctx context.Context, tx *sql.Tx, key Key) (bool, error)

// package projectdeletions
type Scope string // constants OwnerScope="owner", AdminScope="admin"
type Task struct {
    ID, ProjectID, OwnerID, ActorID, Title, State, ErrorCode string
    Width, Height int
    CreatedAt time.Time
    DeletedAt *time.Time
    CompletedAt *time.Time
}
type Query struct { Page, PageSize int; Keyword, OwnerID string }
type Service struct { /* DB, Store, clock; private fields */ }
func NewService(db *sql.DB, store storage.FileStore) *Service
func (s *Service) Accept(ctx context.Context, actor auth.Principal, scope Scope, projectID string) (Task, error)
func (s *Service) List(ctx context.Context, actor auth.Principal, scope Scope, q Query) ([]Task, int, error)
func (s *Service) Get(ctx context.Context, actor auth.Principal, scope Scope, taskID string) (Task, error)
func (s *Service) Retry(ctx context.Context, actor auth.Principal, scope Scope, taskID string) (Task, error)
type Worker struct { Service *Service; Writers *storage.WriterGate; Paused func() bool; ID string }
func (w *Worker) Run(ctx context.Context) error
func (w *Worker) RunOnce(ctx context.Context, now time.Time) (bool, error)
```

Task DTO 对外字段为 id/projectId/ownerId/state/createdAt 及可选 title/width/height/deletedAt/completedAt/errorCode；不返回 actorId、文件 key 或内部错误。Scope 由服务端 action 决定，绝不能信任客户端 role 或 scope。

---

### Task 1: 持久化模型、迁移及备份兼容

**Files:** Create: 两份 `000002_project_deletions` SQL、`server/migrations/migrations_test.go`；Modify: `server/migrations/migrations.go`、`server/cmd/core/main.go`、`server/cmd/maintenance/main.go`、`server/tests/integration/{mysql,recovery}_test.go`、`deploy/backup.md`。

**Interfaces:** Produces: `migrations.CurrentVersion = 2`；保留 `Up(ctx, db) error` 和 `Down(ctx, db) error`。新增三个表：`project_deletions`、`project_deletion_assets`、`project_deletion_files`。

- [ ] **Step 1: 写迁移及恢复失败用例。** `TestUpV1ToV2PreservesProjects` 检查已有作品和引用不变，版本为 2；`TestUpV2Idempotent` 重复执行无重复表／行；`TestDownRemovesDeletionTablesBeforeAssets` 保持现有 Down 清空全部 schema 的语义；恢复测试验证三表及未完成任务被计数、恢复后存在。

```go
if version != migrations.CurrentVersion || projectCount != 1 {
    t.Fatalf("migration lost existing project: version=%d count=%d", version, projectCount)
}
```

- [ ] **Step 2: 运行红测试。** `python3 tools/test-integration.py --all-server -run 'Test(UpV1ToV2|UpV2Idempotent|DownRemovesDeletion|.*Recovery)' -count=1 -v`；预期新增符号缺失／版本仍 1 或缺表。DSN 不可用时先记录阻塞，不能把 SKIP 视为红绿验证。
- [ ] **Step 3: 实现迁移与 schema 检查。** Up 按有序版本逐一判断并应用，不能在发现 v1 已存在时提前返回；只在对应版本 DDL 完成后登记。v2 DDL 可重入。Down 先移除 v2 工作表，再沿用 v1 Down；不修改 v1 SQL。
- [ ] **Step 4: 定义表约束。** `project_deletions` 唯一 project_id；保留 owner/actor、nullable 展示快照、state、safe_error_code/internal_error、attempts/next_attempt_at/lease_token/lease_until/completed_at；索引 (state,next_attempt_at)、(owner_id,state,created_at,id)。assets 表主键 (task_id,asset_id,asset_version)，保存捕获的三个 key 和 pending/preserved/retired 状态；files 表主键 (task_id,file_key)，保存 pending/completed、来源及逐文件结果。两个子表可引用任务，不得对待删作品／素材设置外键。初始任务表不保存 document/snapshot。
- [ ] **Step 5: 接入维护。** core/maintenance 共用 CurrentVersion，维护 appTables 增加三表；旧版本备份拒绝在新 schema 上运行。新版恢复明确支持 schema 2；旧 schema 1 备份使用匹配旧版本恢复后迁移，不默默导入并丢任务。更新兼容说明。
- [ ] **Step 6: 绿测试后提交。** 重跑 Step 2；`gofmt -w` 修改的 Go 文件、`git diff --check`，仅暂存本任务文件，提交 `feat(storage): persist project deletion jobs and migrate schema`。

### Task 2: 素材引用与退休的并发协议

**Files:** Create: `server/internal/storage/{reclaim.go,reclaim_test.go}`；Modify: `server/internal/storage/{gc.go,gc_test.go}`、`server/internal/projects/refs.go`、`server/internal/catalog/service.go`、`server/internal/templates/service.go`（仅实际写引用的路径）、`server/internal/assets/{service,builtin_fonts}.go`、`server/tests/integration/catalog_test.go`、`server/internal/assets/builtin_fonts_test.go`（新增，专测文件修复与退休协调）。

**Interfaces:** Produces: 地图中的 `AssetVersionRef`、`ReclaimResult`、`RetireUnreferencedVersion`、`StorageKeyReferenced`；引用写入在相同事务内持素材版本共享锁，退休持排他锁。

- [ ] **Step 1: 写失败测试。** `TestRetirePreservesEveryReferenceKind` 用表驱动分别插入 project/project-history/export/resource/resource-version 及仅 resource_versions 引用，均断言 `Retired=false`、文件存在；`TestRetireOnlyOneVersion` 只移除无引用版本，父素材最后才删；`TestRetireUsesCurrentReferences` 用 channel 屏障让新引用先提交，退休不得读旧快照；`TestSharedStorageKeyStaysLive` 保留另一版本使用的同 key，空 key/重复 key 正确处理。

```go
if result.Retired { t.Fatal("referenced asset version was retired") }
if _, err := store.Open(ctx, sharedKey); err != nil { t.Fatal(err) }
```

- [ ] **Step 2: 红测试。** `python3 tools/test-integration.py --all-server -run 'Test(Retire|SharedStorageKey)' -count=1 -v`；预期 helper 缺失或引用竞态断言失败。
- [ ] **Step 3: 实现版本与 key 保护。** Retire helper 仅执行数据库逻辑和返回 key，不直接删文件；退休事务采用 READ COMMITTED，以排他锁锁定目标素材／版本，用最新已提交数据核对全部 asset_refs/resource_versions。所有版本获取／引用发布按去重后的 (assetID,version) 排序；参考现有 resolveRefs 的 FOR SHARE，补齐资源版本发布等漏项且持锁至引用提交。多版本父资产删除遵守统一 parent→version 顺序，避免升级锁死锁。
- [ ] **Step 4: 固定 key 不重用规则并整合 GC。** 生产发布只能使用 NewKey／既有同版本文件修复，不得把已退休 key 注册到新版本；同版本恢复需持版本锁。StorageKeyReferenced 扫描仍保留的素材版本各 key 与导出结果 key，不以 key 的创建时间判断。GC 的 orphan pruning 复用退休判定；维护 GC 保留 24 小时宽限和全盘职责，在线清理只用候选。补测试区分公开资源与其他回收站作品保护。
- [ ] **Step 5: 绿测试后提交。** Step 2 加现有 GC/catalog 测试通过；提交 `fix(storage): coordinate asset retirement with reference writes`。

### Task 3: 接受永久删除与导出生命周期互斥

**Files:** Create: `server/internal/projectdeletions/{service,queries,service_test}.go`；Modify: `server/internal/projects/refs.go`、`server/internal/exports/service.go`、`server/tests/integration/export_jobs_test.go`。

**Interfaces:** Consumes: Task 1 表、Task 2 素材协议；Produces: `NewService`、`Accept`、`List`、`Get`、`Retry` 与 Task/Scope/Query；新增 `projects.Service.ResolveSnapshotTx(ctx context.Context, tx *sql.Tx, p auth.Principal, id, revision string) (RenderSnapshot,error)`，原 ResolveSnapshot 调用它并保持原签名。

- [ ] **Step 1: 写接受事务测试。** `TestAcceptDeletesHistoryExportsAndCapturesKeys` 检查主记录／历史／导出／引用全部移除、候选含历史独占版本和导出 key、文件尚存在；`TestAcceptMalformedDocument` 把 document 改成不可解析 JSON 结构仍可删；`TestAcceptPermissionsAndIdempotency` 覆盖本人/他人/admin/需改密、正常作品、未知 ID、跨用户重放，不重复任务／审计；`TestAcceptRejectsActiveExport` 对 queued/running/租约过期仍 running 均 CONFLICT 且无副作用。

```go
if first.ID != second.ID { t.Fatal("replayed accept created another task") }
if nProjects != 0 || nHistory != 0 || nExportJobs != 0 { t.Fatal("project data remained") }
if nAudits != 1 { t.Fatal("accept audit was not exactly once") }
```

- [ ] **Step 2: 红测试。** `python3 tools/test-integration.py --all-server -run 'TestAccept' -count=1 -v`；预期包接口缺失／不满足原子性断言。
- [ ] **Step 3: 实现接受及查询。** Accept 从最小 SQL 元数据读取，不调用 scanProject/document.Parse。先鉴权既有任务再返回；新任务在一事务锁作品、检查状态、锁及复查导出、捕获候选所有 key、删除依赖、插审计和任务后提交。两个竞争 Accept 的唯一键冲突／死锁作有界事务重试，再鉴权读取唯一结果。List 仅未完成任务，owner scope 强制当前用户，admin 可 ownerId/keyword，分页默认24／上限100；Get 可查 completed；Retry 原子提前 next_attempt_at，不能抢未过期租约，completed 原样返回，管理员实际触发重试才写审计。
- [ ] **Step 4: 固定导出锁顺序。** 导出创建、Claim、删除统一 user→project→job→排序素材的顺序；管理员删除锁目标 owner 用户行，不锁 actor 代替它。Claim 先无锁选候选，再在事务按顺序锁并当前读复核候选／租约／每用户活动限制，候选已改变则跳过重选。Create 在持 user/project 锁的同一事务调用 ResolveSnapshotTx、插 job 和 refs；不复用事务外解析快照直接入库。Renew/Complete/Fail 保持 token CAS，不能为已删除任务重新写文件元数据。
- [ ] **Step 5: 加并发失败测试并修复。** `TestAcceptVersusRestore`、`TestAcceptVersusExportCreate`、`TestAcceptVersusClaim` 使用 channel／数据库锁屏障控制两个先后顺序，断言无恢复残缺作品、无悬空 job/refs、活动导出被拒绝，死锁只允许被内部重试而非丢数据。Run `python3 tools/test-integration.py --all-server -run 'Test(Accept|.*Export.*|.*Claim.*)' -count=1 -v` 通过。
- [ ] **Step 6: 提交。** 定向通过后提交 `feat(projects): accept permanent deletion with export coordination`。

### Task 4: 持久化文件执行器与原生启动

**Files:** Create: `server/internal/projectdeletions/{worker.go,worker_test.go}`、`server/cmd/cleanup-worker/main.go`、`server/tests/integration/cleanup_restart_test.go`；Modify: `tools/dev/main.go`、`server/tests/integration/{browser_stack,recovery}_test.go`、`README.md`、`deploy/local.md`、`deploy/backup.md`。

**Interfaces:** Consumes: Task 2 storage helpers、Task 3 Service；Produces: `Worker.Run(ctx) error`、`RunOnce(ctx,now)(bool,error)`。RunOnce 的 bool 表示有任务被执行；单任务失败已持久化 retry_wait 后返回 true,nil，基础 DB／gate 错误返回 error，由 Run 日志并继续调度。

- [ ] **Step 1: 写真实 FileStore 失败／恢复测试。** `TestCleanupDeletesOnlyUnreferencedFiles` 断言所有独占实际文件及素材版本消失、共享仍可读；`TestCleanupRetryAfterDeleteBeforeAck` 用可注入 FileStore 在 Delete 成功后制造状态确认失败，再 RunOnce 不报缺失文件；`TestCleanupAfterGCRetiredMetadata` 先移除候选素材行但留下文件，仍从持久 key 清掉；`TestCleanupExpiredLeaseAndTwoWorkers` 确认租约回收和 token 防旧执行者确认；`TestCleanupMaintenancePause` 独占维护锁期间 DB／文件不变。

```go
if !errors.Is(openErr, fs.ErrNotExist) { t.Fatalf("private file remains: %v", openErr) }
if task.State != "completed" { t.Fatalf("task state=%s", task.State) }
if sharedOpenErr != nil { t.Fatal("shared file was removed") }
```

- [ ] **Step 2: 红测试。** `python3 tools/test-integration.py --all-server -run 'TestCleanup' -count=1 -v`；预期执行器缺失／文件仍存在。
- [ ] **Step 3: 实现有界工作循环。** 每次取得 writer lease 后领取一任务，租约30秒，长工作每10秒续约，所有状态变更以 token CAS；处理候选时事务退休素材并写 files 后提交，随后 FileStore.Delete。候选素材已不在也检查捕获 key，保留其他存活 key，逐项去重。完成后清空展示快照及工作子行，只留 spec 最小完成记录。失败记录安全 code、内部错误、attempts；退避5秒起翻倍至300秒上限，不终止；每次 RunOnce 释放 writer lease，不在退避期间持锁。手动 retry 不受剩余退避限制但遵守活动租约。
- [ ] **Step 4: 接入进程与唤醒。** cleanup-worker 初始化 config/DB/schema2/Store/WriterGate、signal context，独立每秒扫描 due 工作；Accept 后返回即开始后台执行，跨进程最迟一次扫描发现任务，不依赖内存通知保证。dev 增加构建／启动／退出清理该进程；浏览器测试栈启动同一 Worker.Run、退出时 cancel+等待，不依赖 export-worker 空闲。文档给出原生启动和停机迁移顺序。
- [ ] **Step 5: 重启／恢复验收。** 新测试构建真实 cleanup-worker 二进制，使用受保护临时 DB/目录，提交未完成任务，终止并重启，断言最终文件清除。recovery 测试把待清理任务随备份恢复，并在恢复目录完成；拒绝错误 schema。Run Step 2 和 `python3 tools/test-integration.py -run 'Test(CleanupRestart|.*Recovery)' -count=1 -v`。
- [ ] **Step 6: 提交。** 通过后提交 `feat(storage): run durable project file cleanup worker`。

### Task 5: IDL 与两个权限入口

**Files:** Modify: `idl/http/{projects,admin}.thrift`、`idl/common/{base,requests,calls}.thrift`、`server/internal/transport/{dispatch,projects_adapter,admin_adapter}.go`、`server/internal/catalog/{admin,service}.go`、`server/cmd/core/main.go`、调用 adapter 的现有集成测试；Create: `server/tests/integration/project_deletions_http_test.go`。生成结果由命令产生。

**Interfaces:** Produces: `routes.PermanentlyDeleteProject`、`AdminPermanentlyDeleteProject`、`ListProjectDeletions`、`GetProjectDeletion`、`RetryProjectDeletion` 及 Admin 前缀对应三项；路由使用 spec 的 8 个路径。`ProjectDeletionDTO` 使用地图中确定的公共字段；`ProjectDeletionReply {requestId,deletion}`、`ProjectDeletionListReply {requestId,deletions,total}`；RPC payload 加 deletion/deletions，AdminCall 加 id。`AdminProjectListQuery` 独立结构包含 page/pageSize/keyword/userId/status（all/normal/trash），不污染其他 ListQuery。Adapters 显式第三参数 `deletions *projectdeletions.Service`，所有调用点一起更新。

- [ ] **Step 1: 写 HTTP 失败测试。** `TestPermanentDeletionHTTPPermissionsAndReplay` 经真实 gateway+RPC，检查 user/admin 正确作用域、未登录/需改密/越权、安全返回与重复任务；`TestDeletionHTTPStatusAndRetry` 检查 pending→retry_wait→completed、列表不含正文/key、completed 明细仍可查、CONFLICT 映射409；`TestAdminProjectsStatusFilter` 检查三种状态、未知 status 为 INVALID_INPUT，其他列表不改变默认行为。

```go
if status != http.StatusConflict { t.Fatalf("status=%d, want 409", status) }
if strings.Contains(body, "original_key") || strings.Contains(body, "document") { t.Fatal("private payload leaked") }
```

- [ ] **Step 2: 红测试。** `python3 tools/test-integration.py -run 'Test(PermanentDeletionHTTP|DeletionHTTP|AdminProjectsStatus)' -count=1 -v`；预期新路由不存在。
- [ ] **Step 3: 编辑 IDL、生成并接入。** 在 IDL 固定上述命名，`pnpm contracts:generate`；dispatch 分类绑定请求，adapter 从 session 取得 actor 并固定 Scope，调用领域接口；查询名称／属性匹配生成 camelCase。永久删除按现有 reply 结构返回受理状态，不能返回 EmptyReply 冒充完成。core 注入同一 deletion service。更新所有 adapter 测试构造，不用可选 nil 参数隐藏漏接。
- [ ] **Step 4: 绿测试与契约检查。** Step 2 通过，`pnpm contracts:check` 输出 generated contracts match；`go test ./tools/contractgen ./server/internal/transport` 通过，无生成器缺失则不能声称已验证。
- [ ] **Step 5: 提交。** 显式加入 IDL、生成目录及适配器／测试文件，提交 `feat(api): expose permanent project deletion and cleanup status`。

### Task 6: 共享交互与用户回收站

**Files:** Create: 地图中的 API 状态 helper、共享 UI、用户 hook/Queue 及其 `.test.ts[x]`；Modify: `packages/{api-client,ui}/src/index.ts`、`apps/web/src/features/projects/{ProjectList,ProjectsPage}.tsx`、相邻测试、`apps/web/src/styles.css`（仅布局必要处）。

**Interfaces:** `ProjectDeletionConfirm({project:{id,title,ownerId?},admin,busy,onConfirm,onClose})`；`ProjectDeletionStatus({deletion,onRetry,busy})`；前者 admin 勾选前不得确认，后者只展示安全状态。API helper 导出 `isDeletionComplete(task:ProjectDeletionDTO):boolean`、`mergeDeletionStatus(previous:ProjectDeletionDTO,next:ProjectDeletionDTO):ProjectDeletionDTO`，completed 不被迟到 running 覆盖。用户 hook 返回 `{accept,retry,pending,isBusy}`，request 仍用站点已有实例，不在共享 UI 注入认证。

- [ ] **Step 1: 写失败测试。** 使用仓库已有 Vitest node 环境／SSR 检查正常列表不出现彻底删除、回收站存在恢复和删除、pending/retry_wait 没有恢复动作、文案及无 document 任务可渲染；纯 helper 测试 completed 不回退、任务 ID 不同不合并。真实焦点和点击交给 Task 8 E2E，不为此引入 DOM 测试依赖。

```ts
expect(html).toContain("彻底删除");
expect(pendingHtml).not.toContain("恢复作品");
expect(mergeDeletionStatus(completed, running).state).toBe("completed");
```

- [ ] **Step 2: 红测试。** `pnpm exec vitest run apps/web/src/features/projects/ProjectList.test.tsx packages/ui/src/project-deletion.test.ts packages/api-client/src/project-deletion.test.ts`；预期新导出缺失／新动作不存在。
- [ ] **Step 3: 实现确认、状态及查询。** 复用当前 UI 主题与组件；ProjectAction 增加 permanent-delete，不影响软删除；确认默认取消焦点，busy 防重入，成功受理关闭对应对话框而非任何新弹窗。pending 独立分页分区，每页24，不受30天过滤；名称搜索同时作用于未完成队列。保留正在清理／清理待重试及手动重试，只有 completed 提示“作品及独占资源已彻底删除，共享资源已保留。”；失败文案沿用草图。
- [ ] **Step 4: 固定请求生命周期。** query key 含 userId，活动任务2秒轮询；页面卸载停止轮询，重新进入可恢复；列表项消失时对跟踪过的 task ID 查详情确认 completed，不能凭空列表推断成功。重复刷新不重复 Toast，迟到响应不污染其他账号；相关作品查询失效，当前页无数据且 page>1 时退一页重查，不能因任务列表为空隐藏仍在其他页的作品。
- [ ] **Step 5: 绿测试及格式。** Step 2 通过；对修改前端文件逐一 `pnpm exec prettier --write <paths>`，`pnpm typecheck`。提交 `feat(web): add permanent deletion flow to recycle bin`。

### Task 7: 管理端、草稿与跨标签页终止保存

**Files:** Create: `apps/admin/src/features/projects/ProjectDeletionQueue.tsx`、`apps/web/src/features/editor/{projectDeletionSync.ts,projectDeletionSync.test.ts}`、`apps/web/src/features/editor/drafts.test.ts`；Modify: `apps/admin/src/features/Metadata.tsx`、`apps/admin/src/styles.css`、`apps/web/src/features/editor/{drafts.ts,autosave.ts,autosave.test.ts,useProjectAutosave.ts}`、`apps/web/src/features/projects/useProjectDeletion.ts[x]`、`ProjectWorkspace.tsx`。

**Interfaces:** `publishProjectDeletion({userId,projectId}):void`、`subscribeProjectDeletions(handler):()=>void` 使用本地 storage 事件及同标签 CustomEvent，不复用登录事件 key；`DraftStore.blockProject(userId,projectId):Promise<void>` 阻止写并删除现有记录；`Autosave.stopDeleted():void` 永久阻止本控制器保存／persist、取消计时，不能被 setBlocked(false) 重新启用。epoch 按 userId/projectId 单独维护，不封禁同用户其他作品。

- [ ] **Step 1: 写失败测试。** `Test` 名用 Vitest it 描述：管理员确认缺勾选禁用、正常作品无按钮；draft 的异步 open/put 在删除发生后完成也不写入（用可控适配／最小 IDB mock，不引入依赖）；autosave 删除后更新/解除临时阻塞/销毁均不保存；无效跨标签事件忽略，其他用户事件不作用本账号。

```ts
controller.stopDeleted(); controller.setBlocked(false); controller.update(changed);
await clock.advance();
expect(savedDocuments).toHaveLength(0);
expect(persistedAfterDeletion).toHaveLength(0);
```

- [ ] **Step 2: 红测试。** `pnpm exec vitest run apps/web/src/features/editor/autosave.test.ts apps/web/src/features/editor/drafts.test.ts apps/web/src/features/editor/projectDeletionSync.test.ts`；预期新接口缺失／晚到 put 成功。
- [ ] **Step 3: 实现管理端。** 接入独立 admin status 查询、共享确认框，显示归属且强制勾选；仅回收站提供删除。未完成队列使用 admin endpoints、共享状态组件和2秒轮询，重试权限不能假用 user endpoint。成功刷新 admin/projects/jobs/overview 及审计；两端行为和安全摘要一致，不取正文／私有图片。
- [ ] **Step 4: 实现草稿与旧编辑器收敛。** 收到 Accept 受理响应即发布删除事件并 blockProject；block 标志在 await IDB 之前设定，put 在真正提交前复核 epoch，已排入的事务按序等待后执行删除。管理端其他用户删除不尝试抹除远端草稿。编辑器收到匹配事件时 stopDeleted+清草稿；原作品保存返回 NOT_FOUND 时同样停止并显示无法继续保存到原作品。草稿清理单独失败仅通知，不重放服务器删除；其他临时请求错误不被当作作品永久删除。
- [ ] **Step 5: 绿测试、格式并提交。** Step 2 和相关项目／共享 UI 测试通过，格式化修改前端文件；提交 `feat(admin): add deletion controls and prevent stale draft revival`。

### Task 8: 完整验收、故障注入及交付证据

**Files:** Create: `tests/e2e/project-permanent-deletion.spec.ts`、`docs/verification/2026-11-04-project-permanent-deletion.md`；Modify: `tests/e2e/projects.spec.ts`、必要的 `tests/e2e/helpers.ts` 及前述任务的测试；故障注入封装在 Go 测试 FileStore/受控测试栈，不新增生产端“模拟失败”接口。

**Interfaces:** Consumes: 上述所有公开接口及完整测试栈；Produces: 可复现的验收记录、界面截图和已区分 pass/skip/block 的验证结果。

- [ ] **Step 1: 写 E2E 失败用例。** 用户取消不删、确认可观察 pending/完成、刷新后状态保留；复制作品共享图，删除原作品后副本仍打开和导出；管理员正常无入口、trash 需勾选、拒绝普通用户 admin 请求；导出 queued/running 冲突；首个用户待清理／切换账号看不到旧任务；窄屏和键盘默认取消焦点。核心断言如下，数据通过现有注册上传流程建立：

```ts
await expect(dialog.getByRole("button", {name:"取消", exact:true})).toBeFocused();
await expect(adminConfirm).toBeDisabled();
await expect(page.getByText("作品已删除，部分文件尚未清理", {exact:false})).toBeVisible();
await expect(copyEditor.getByRole("button", {name:"导出", exact:true})).toBeEnabled();
```

- [ ] **Step 2: 补边界测试并跑红。** 使用 page.route 只模拟前端失败状态序列验证展示／刷新／重试，真实失败和文件不存在由 Task 4 测试证明。用 route barrier 而非 sleep 固定 pending 观察窗口。增加第25件删除后分页回退、超过30天未完成任务仍可见、两个编辑标签页晚到 put 不复活。运行 `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts`，记录任何真实失败再修复所属实现，不能通过削弱断言过关。
- [ ] **Step 3: 全范围验证。** 执行 `pnpm verify`、`pnpm test:server`、`go test ./internal/...`、`python3 tools/test-integration.py --all-server -count=1 -v`、`pnpm test:e2e`。前一条 server 测试没有 DSN 的 SKIP 不代表后一条真实集成通过。没有新改动或未解问题时不重复全套。
- [ ] **Step 4: 整理证据。** 截图用户确认／清理待重试／管理员确认（使用测试样例，不含凭据），保存至 `docs/verification` 的相邻素材目录并在记录引用。记录实际命令、退出码、通过与跳过、schema2升级及旧备份恢复说明、物理文件断言和重启恢复结果；不把模拟草图当成真实验收截图。
- [ ] **Step 5: 请求最终代码审查并解决发现。** 使用 requesting-code-review；native 执行时全分支独立审阅，子代理执行时按所选执行技能逐任务门禁并最终全分支审阅。不把“审阅无问题”替代测试证据。
- [ ] **Step 6: 最终核对并提交。** `git diff --check`；核对工作区和 staged 文件范围、生成契约、迁移和文档同步。提交 `test(projects): verify durable permanent deletion flows`；若环境检查跳过，交付说明明确实际剩余项，不声称完整验收通过。不自动合并或部署。

## 自审记录与执行顺序

- 已将 spec 的产品入口、删除范围、持久化、并发、接口、草稿、部署与验收分别映射至 Task 1–8，无独立未覆盖子项目。
- 接口命名统一：领域 Task，公共 ProjectDeletionDTO；任务 id 与 projectId 不混用；Scope 仅服务端决定；worker 不 import transport 或前端类型。
- Review Focus 五项分别有明确测试。关键真文件、租约、事务、并发均由 MySQL+FileStore 验证，SSR 不代替真实交互。
- Task 1→2→3→4→5→6→7→8 顺序执行；每个任务完成自身红绿与提交后再进入下一任务。中间提交可以尚无 UI，但已有接口的现存行为必须保持测试通过。
- 推荐 native（当前会话顺序实施）并在完成后独立审查：八个任务高度依赖同一套任务类型、引用锁和 schema，顺序执行可减少跨任务接口漂移。最终执行方式等待用户选择，本文件不授权开始功能实现。
