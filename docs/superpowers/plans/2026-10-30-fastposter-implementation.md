# FastPoster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有本机 MySQL、可选 Redis 和本地文件目录上，交付移动端适配的富文本海报编辑器、原尺寸 PNG 导出和管理后台。

**Architecture:** React monorepo 包含 web、admin 和内部 renderer，分享文档、排版及编辑组件。Go Hertz 提供 HTTP，经 Kitex 调用业务 core；Go worker 从 MySQL 领取导出任务，驱动 Chrome 生成透明文字层并合成本地文件中的完整尺寸背景。所有进程原生运行在同一台机器并共享绝对 APP_DATA_DIR，不依赖外部对象存储或容器。

**Tech Stack:** React、TypeScript、Vite、pnpm workspace、Turborepo、Tiptap、Radix、Tailwind、TanStack Query、Zustand、Vitest、Playwright；Go、Hertz、Kitex、Thrift/thriftgo、database/sql + go-sql-driver/mysql、go-redis、chromedp、ImageMagick。

**Spec:** [2026-10-30-fastposter-design.md](../specs/2026-10-30-fastposter-design.md)，包括用户批准后的本机存储修订。执行者必须先读设计全文。

## Global Constraints

- 前端使用 React monorepo；服务端使用 Go、Hertz、Kitex；接口通过 Thrift IDL 定义。
- 不依赖 PostgreSQL、S3、MinIO、云厂商账号或 Docker；首版只实现本地 FileStore，MySQL 为持久化事实来源。
- APP_DATA_DIR 本地默认 `./var/data`，gateway/core/worker 必须解析为同一个绝对路径；原生开发同机运行。
- 背景导入静态 JPEG/JPG、PNG、WebP；单文件 40 MiB；总像素不超过 40,000,000，任一边不超过 8192 像素。
- 标准化至 sRGB RGBA8，保留 alpha，应用 EXIF 方向；拒绝动图、SVG、HEIC、AVIF、TIFF、PSD、16 位/HDR/CMYK。
- 输出为原画布 W×H 的 RGBA PNG；不得用缩略图、屏幕预览或 JPEG 重压缩替代；DPR 固定 1。
- 拖拽只改变文本框宽度、自动换行，字号不变；高度自动增长；局部字体、字号和颜色可独立设置。
- 最多 100 个文字块、单块 10,000 字符、文档 2 MiB；模板 ZIP 80 MiB 压缩体、120 MiB 解压体、最多 20 个文件。
- 手机采用已选 A：可收起的底部面板；最低布局宽度 360 CSS px；交互触摸热区至少 44 CSS px。
- 自动保存等待约 1 秒；expectedRevision 防冲突；冲突不静默覆盖；退出清理本账号本地草稿。
- 角色只有 user/admin；用户名密码登录、可撤销 HttpOnly 会话；私有文件不得通过静态目录映射公开。
- 导出默认每用户 1 运行中、2 排队；worker 并发 1、超时 120 秒、租约 30 秒并续期、最多 2 次自动尝试；结果保留 7 天，删除作品恢复窗口 30 天。
- Redis 只可选用于限流，不作为作品、文件、会话或任务的唯一存储；缺少或故障时使用有界单机内存限流。
- 40MP/8192 是需实测验证的容量目标；真实 iOS/Android 交互与抗锯齿差异不能由桌面模拟代替证明。
- 每个任务先建立有意义的失败测试，确认失败后实施，再运行相应检查并提交；无产品代码已在规划阶段实施。

## Review Focus

1. MySQL 客户端存在但服务端不兼容、连接不可用或 schema 不独立：预检必须指出原因，不碰现有业务表（Task 1/6）。
2. 本地文件写成功但数据库登记失败、磁盘满或符号链接逃逸：不虚报成功，不能越过根目录，孤立文件可回收（Task 3/8/18）。
3. 同一导出任务租约过期后被再次领取：旧 worker 不能覆盖新 worker 的结果或删除其文件（Task 14）。
4. 中文 IME 组合输入、选择局部文字后操作底部面板：不丢字、不丢选区、不误拖文字块（Task 12/13）。
5. 管理员下架字体/背景，用户在其他设备恢复旧作品：仍使用不可变版本；资源确实缺失则失败而非静默替换（Task 4/15/16）。

---

## 文件与责任划分

全仓库单 Go module，module 暂定 `fastposter`，根 `go.mod`；Go 代码位于 `server/`。前端 workspace 的包名固定为 `@fastposter/web`、`@fastposter/admin`、`@fastposter/renderer`、`@fastposter/poster-schema`、`@fastposter/poster-renderer`、`@fastposter/poster-editor`、`@fastposter/ui`、`@fastposter/api-client`。

| 路径 | 责任 |
| --- | --- |
| `apps/{web,admin,renderer}/` | 三个应用，各自路由、入口与构建 |
| `packages/poster-schema/src/` | 有版本的文档 schema、迁移、共享 JSON fixtures |
| `packages/poster-renderer/src/` | 富文本静态 DOM、字体注册、布局测量、就绪信号 |
| `packages/poster-editor/src/` | 几何操作、Tiptap 输入、选区、统一历史、面板 |
| `packages/{ui,api-client}/src/` | UI 基础组件、从 Thrift 派生的 HTTP 契约和调用 |
| `idl/{common,http,rpc}/` | Thrift 契约，不维护独立手写前端 DTO |
| `server/internal/{config,storage,document}/` | 环境配置、本地文件存储、Go 文档校验 |
| `server/internal/{auth,assets,projects,catalog,templates,copy,exports}/` | 领域逻辑与各自 SQL repository/HTTP-RPC adapter |
| `server/internal/{app,transport,testutil}/` | 进程装配、Hertz/Kitex 接入、独立测试数据库工具 |
| `server/gen/{hertz,kitex}/` | 代码生成产物，禁止手改 |
| `server/cmd/{gateway,core,export-worker,admin-cli,migrate}/` | 启动、管理员初始化与迁移命令 |
| `server/migrations/` | MySQL up/down SQL，版本跟踪 |
| `tools/{contractgen,doctor,dev}/` | 契约派生、本机环境检查、原生进程管理 |
| `tests/{fixtures,e2e}/` 与 `server/tests/integration/` | 共享样例、真实 MySQL/RPC/文件集成、用户流程 |
| `deploy/{local.env.example,local.md,backup.md}` | 不含凭据的配置、本机运行、备份恢复 |
| `docs/verification/` | 实测环境、容量结果和人工移动设备验收记录 |

小文件按责任拆分；同一领域的 service/repository/handler 放一起，不建立集中万能 service。task 的文件列表是新增/修改目标，执行前重新读取上下文。

## 环境核查记录与执行边界

2026-10-30 只读检测到：Go 1.27.2 darwin/arm64、Node 24.21.0、pnpm 11.25.0、mysql 客户端 26.7.0、redis-cli 8.10.2；`/Applications/Google Chrome.app` 存在，未检测到 `magick` 和 Docker。**这些不是 MySQL/Redis 服务端版本、可连接性或 Go/CloudWeGo 兼容性证明。** 不读取数据库密码，不假设 root 无密码登录，不安装或改动用户现有数据库服务。

Task 1 在安装任何依赖前先记录实际可用稳定版本，并完成最小 CloudWeGo 编译与 codegen smoke；将精确版本写入 `deploy/toolchain.lock.json`、packageManager/lockfile、go.mod/go.sum 与工具版本文件。版本元数据和 smoke 结果都保留。若本机 Go 与选定 CloudWeGo/Sonic 不兼容，可在项目范围固定兼容工具链，不改全局 Go；实际需要下载安装时遵循宿主权限。ImageMagick 是计划中的额外程序依赖，doctor 给出缺失提示和安装命令，不自动安装系统服务。

## 阶段一：先证明关键技术路线

### Task 1: 本机启动骨架与工具链兼容性

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `go.mod`, `tools/doctor/main.go`, `tools/doctor/main_test.go`, `tools/dev/main.go`, `deploy/local.env.example`, `deploy/local.md`, `deploy/toolchain.lock.json`, `server/internal/config/config.go`, `server/internal/config/config_test.go`, `server/cmd/gateway/main.go`, `server/cmd/core/main.go`, `server/cmd/export-worker/main.go`, `apps/{web,admin,renderer}/package.json`, `packages/{poster-schema,poster-renderer,poster-editor,ui,api-client}/package.json`; Modify `.gitignore`.

**Interfaces:** Produces `config.Load(env map[string]string, baseDir string) (Config,error)` with MySQLDSN, RedisAddr, AbsoluteDataDir, GatewayAddr, CoreAddr, ChromePath, MagickPath；doctor 支持 `go run ./tools/doctor -check config|services|render|all`；`pnpm dev` 管理自己的子进程并在退出时只停止这些进程。

- [ ] **Step 1:** 写 `TestLoadResolvesSameDataRoot`（相对目录只相对仓库根解析）、`TestMissingDSNExplainsConfig`（无 DSN 返回具体配置项），doctor 测试断言“未安装 magick”不同于“数据库连接失败”，不得打印 DSN 密码。
- [ ] **Step 2:** 运行 `go test ./server/internal/config ./tools/doctor -v`，确认缺少实现导致失败。
- [ ] **Step 3:** 实现配置、doctor 和原生启动；启动前对实际 MySQL 做只读 `SELECT VERSION()`/能力检查、Redis 可选 PING、Chrome/图片转换工具版本检查。补齐三个最小 Vite 入口及 Go 进程入口，选择并固定通过编译/codegen smoke 的工具链，忽略 `.env.local`、`var/`、构建产物和工具缓存，不创建业务数据库。
- [ ] **Step 4:** 运行 Step 2 测试、`pnpm install --frozen-lockfile`、`pnpm build`、`go build ./server/cmd/...`。`go run ./tools/doctor -check config` 在示例配置下通过；服务检查的真实缺项按实际记录，不伪报全绿。
- [ ] **Step 5:** `git add` 本任务文件并提交 `chore: establish native development toolchain`。

### Task 2: 统一文档模型和 Go/TS 校验

**Files:** Create `packages/poster-schema/src/{types,schema,migrate}.ts`, `packages/poster-schema/src/schema.test.ts`, `server/internal/document/{document,validate}.go`, `server/internal/document/validate_test.go`, `tests/fixtures/documents/{valid-mixed,overflow-width,unknown-mark}.json`。

**Interfaces:** Produces `PosterDocument{schemaVersion:1,canvas:{width,height},background:{assetId,version},textBlocks:TextBlock[],fonts:FontRef[]}`；TextBlock 使用 `id,x,y,width,zIndex,defaultStyle,paragraphStyle,effects,content`；content 为受限 Tiptap JSON；`parseDocument(input:unknown):PosterDocument`、`migrateDocument(input:unknown):PosterDocument`；Go `document.Parse(raw []byte) (Document,error)` 和 `Validate(Document) error`。

- [ ] **Step 1:** 写共享 fixture 用例：混合字体/字号/颜色 round-trip 不丢 marks；101 块、10001 字符、超过 2 MiB、非法 font/asset 引用结构、未知节点/marks 被拒；尺寸边界分别验证 8192 和 40,000,000，不能只验证一项；schemaVersion 未知不可猜测升级。
- [ ] **Step 2:** 运行 `pnpm --filter @fastposter/poster-schema test` 和 `go test ./server/internal/document -v`，确认失败。
- [ ] **Step 3:** 实现受限 schema，坐标为原图像素，ID/revision 为字符串；字号正数且有上界，颜色与枚举受限；客户端/Go 用同一组 fixture 验证，不接受裸 HTML/CSS。
- [ ] **Step 4:** 重跑 Step 2，所有 fixture 在两端判定一致；`pnpm --filter @fastposter/poster-schema build` 通过。
- [ ] **Step 5:** 提交 `feat: define versioned poster document contract`。

### Task 3: 本机文件存储与失败原子性

**Files:** Create `server/internal/storage/{store,local,keys}.go`, `server/internal/storage/local_test.go`, `server/internal/testutil/failwriter.go`。

**Interfaces:** Produces `type Key string`、`FileInfo{Key Key,Size int64,SHA256 string}`、`FileStore` with `Put(ctx context.Context,key Key,src io.Reader)(FileInfo,error)`, `Open(ctx,key)(io.ReadCloser,error)`, `Stat(ctx,key)(FileInfo,error)`, `Delete(ctx,key) error`；`NewLocal(root string)(FileStore,error)`；key 由服务端生成，不能从 HTTP 路径直接强转后读取。

- [ ] **Step 1:** 写 `TestPutOpenRoundTrip`、`TestInterruptedPutPublishesNothing`、`TestRejectTraversalAndSymlinkEscape`、`TestNoOverwriteImmutableKey`；包括 `../`、绝对路径、目录符号链接、读写权限和注入 ENOSPC，失败后无可见半文件。
- [ ] **Step 2:** 运行 `go test ./server/internal/storage -v`，确认失败。
- [ ] **Step 3:** 实现受控目录/键、根内临时文件、hash/大小计算、fsync 与同文件系统发布，不覆盖不可变文件；权限错误可追踪。初始部署只允许受信进程修改根目录，路径校验不能依赖不安全字符串前缀。
- [ ] **Step 4:** 重跑 Step 2，补充并发同 key 争用用例，确认恰有一个完整文件发布。
- [ ] **Step 5:** 提交 `feat: add atomic local file storage`。

### Task 4: 富文本渲染与原尺寸导出验证

**Files:** Create `packages/poster-renderer/src/{PosterFrame,RichText,FontRegistry,layout}.tsx`, `packages/poster-renderer/src/layout.test.ts`, `apps/renderer/src/main.tsx`, `server/internal/exports/{renderer,compose}.go`, `server/internal/exports/compose_test.go`, `server/tests/integration/render_test.go`, `tests/fixtures/render/`, `docs/verification/render-capacity.md`。

**Interfaces:** Consumes Task 2 文档和 Task 3 文件接口；Produces `PosterFrame({document,backgroundUrl,transparentTextOnly})`、`measureLayout(root:HTMLElement):LayoutReport`、字体/图片加载完成且连续两帧布局稳定的 readiness；Go `Renderer.RenderText(ctx context.Context,snapshot RenderSnapshot)(image.Image,LayoutReport,error)`、`Compose(background image.Image,text image.Image)(image.Image,error)`；RenderSnapshot 含 Document、精确字体依赖和 rendererVersion。

- [ ] **Step 1:** 写 `TestComposePreservesUncoveredPixelsAndAlpha`，断言未覆盖像素与背景 RGBA 一致、输出 W/H 一致；`TestRenderMixedChineseFonts` 验证混合字号换行与高度、字体缺失返回错误；`TestRender4000x6000` 验证文件解码尺寸为 4000×6000，DPR/视口变化不改变输出。
- [ ] **Step 2:** 运行 `go test ./server/internal/exports -run TestCompose -v`、`FASTPOSTER_RENDER_TEST=1 go test ./server/tests/integration -run TestRender -v`，先确认失败；缺 Chrome/字体必须显式跳过并记录，不能当通过。
- [ ] **Step 3:** 内置并记录一套可再分发中文字体的正常/粗体文件与授权；实现共享 DOM 和透明页面、字体就绪、chromedp 驱动、Go alpha 合成。内部 renderer 只读本次任务授权的受控资源，禁用任意网络请求；禁止 OS 字体静默 fallback。不实现完整编辑器或业务后台。
- [ ] **Step 4:** 重跑 Step 2；补测 8192×4800 与 4800×8192 的允许边界、超界拒绝、透明背景、无文字、阴影边缘与固定版本重复像素 hash；记录 Chrome/Go/字体版本、机器配置、峰值 RSS/耗时。达标后才进入完整业务；不达标不得降采样掩盖。
- [ ] **Step 5:** 提交 `feat: verify shared rich text rendering and native size export`。

## 阶段二：完成用户可用的海报编辑闭环

### Task 5: Thrift HTTP/RPC 与前端契约生成

**Files:** Create `idl/common/{base,document}.thrift`, `idl/http/{auth,projects,assets,catalog,templates,exports,admin}.thrift`, `idl/rpc/core.thrift`, `tools/contractgen/{main,types,routes}.go`, `tools/contractgen/main_test.go`, `packages/api-client/src/{generated,client}.ts`, `packages/api-client/src/client.test.ts`, `server/internal/transport/{hertz,kitex}.go`；generated outputs `server/gen/{hertz,kitex}/`。Task 4 如需字体 fixture，可先用固定受控本地依赖；本任务将其接入正式字体契约。

**Interfaces:** Produces envelope `ApiError{code,message,requestId,fieldErrors?}`；HTTP JSON /api/v1；auth/register/login/logout/me、projects CRUD/clone/restore、assets upload/read/meta、catalog backgrounds/fonts/templates/copy、templates import/export、exports create/status/download、admin 各域；RPC `CoreService` 同域方法。`apiClient.request<T>(route:GeneratedRoute,input:unknown):Promise<T>`；i64 JSON 的 ID/revision 明确为十进制字符串。

- [ ] **Step 1:** `TestContractGenSharesDTOsAndHTTPRoutes` 断言路径/动词/optional/enum/list 和 i64 string；`TestUnsupportedThriftTypeFails` 禁止生成器默默省略类型；TS `clientCredentialsAndTypedError` 验证 Cookie 同源和错误码不靠文本判断。
- [ ] **Step 2:** 运行 `go test ./tools/contractgen -v`、`pnpm --filter @fastposter/api-client test`，确认失败。
- [ ] **Step 3:** 定义项目所需 IDL 子集（struct/enum/list/map<string,T>/optional/i32/i64/double/bool/string），从 thriftgo AST 生成 TS 与路由元信息；hz/kitex 输出隔离，生成代码只做适配，领域代码不混进生成文件；multipart 上传内容流由 Hertz 单独处理，IDL 定义其元信息与响应。图片上传 40 MiB 与模板包 80 MiB 使用不同路由的限额，不用统一 40 MiB 中间件误拒合法模板。
- [ ] **Step 4:** `pnpm contracts:generate`、Step 2 测试、`go build ./server/...`、`pnpm --filter @fastposter/api-client build` 通过；重复生成无差异；HTTP health 调用真实 Kitex ping 返回 requestId，不能绕过 RPC 假装接通。
- [ ] **Step 5:** 提交 `feat: generate HTTP RPC and TypeScript contracts from Thrift`。

### Task 6: MySQL schema、事务与隔离测试库

**Files:** Create `server/migrations/000001_initial.{up,down}.sql`, `server/internal/app/mysql.go`, `server/internal/testutil/mysql.go`, `server/cmd/migrate/main.go`, `server/tests/integration/mysql_test.go`。

**Interfaces:** Produces `OpenMySQL(ctx context.Context,dsn string)(*sql.DB,error)`；`testutil.MySQL(t *testing.T)(*sql.DB,func())` 仅允许显式 `FASTPOSTER_TEST_MYSQL_DSN` 指向以 `fastposter_test_` 开头的独立数据库；迁移 CLI `go run ./server/cmd/migrate -direction up|down`，生产 down 需显式参数，不在启动时自动执行破坏性迁移。

- [ ] **Step 1:** `TestMigrationRoundTripAndEmojiJSON` 断言 utf8mb4 文字/JSON 恢复；`TestRefuseNonTestSchema` 验证不能用 root 业务库清表；`TestConcurrentRevisionCAS` 两次相同 revision 仅一次成功；`TestQueueClaimSkipsLockedRows` 两事务不会领同一任务。
- [ ] **Step 2:** 在配置的独立测试库运行 `go test ./server/tests/integration -run 'TestMigration|TestRefuse|TestConcurrentRevision|TestQueueClaim' -v`，确认失败；没有配置时记录阻塞，不用 mock 冒充真实 SQL 验证。
- [ ] **Step 3:** 实现设计实体和索引，JSON 文档、不可变快照、会话、引用关系、任务 lease_token/lease_until/attempts、幂等唯一键、管理审计。用 database/sql 事务和 MySQL SQL，不用 JSONB/RETURNING；mysql driver `parseTime=true`、UTC、合理池大小。
- [ ] **Step 4:** 重跑 Step 2，验证迁移重复 up 幂等，MySQL 8.4 兼容 SQL；只检查用户数据库服务不创建/替换服务，不向其现有表写数据。
- [ ] **Step 5:** 提交 `feat: persist poster data and jobs with MySQL`。

### Task 7: 用户、会话、管理员初始化与限流

**Files:** Create `server/internal/auth/{service,repository,session,limiter}.go`, `server/internal/auth/service_test.go`, `server/internal/transport/{identity,csrf}.go`, `server/cmd/admin-cli/main.go`, `server/tests/integration/auth_test.go`。

**Interfaces:** `auth.Service.Register(ctx,username,password)(User,error)`、`Login(ctx,username,password)(SessionToken,error)`、`ResolveSession(ctx,token)(Principal,error)`、`Revoke(ctx,sessionID) error`；`Principal{UserID string,Role string}` 只从服务端会话产生；`Limiter.Allow(ctx,key string)(bool,error)` 有界本地或 Redis 实现。

- [ ] **Step 1:** `TestPasswordHashAndUniformLoginError` 不存明文、不泄露用户名存在性；`TestDisableRevokesAllSessions`；`TestRoleCannotBeChosenAtRegister`；`TestRedisOutageUsesBoundedLimiter`；HTTP 集成测试跨源写请求拒绝、cookie HttpOnly，生产 Secure、注销后访问 401。
- [ ] **Step 2:** 运行 `go test ./server/internal/auth ./server/internal/transport -v`、`go test ./server/tests/integration -run TestAuth -v`，确认失败。
- [ ] **Step 3:** 使用 Argon2id 的带参数/盐散列和随机会话，数据库只存会话 token hash；管理员 CLI 通过交互输入/安全 stdin 设置密码，不写命令行参数/日志。密码重置撤销会话，签发一次性改密流程，user/admin 检查放 core 内再验证。
- [ ] **Step 4:** 重跑 Step 2，验证 Redis 未配置/故障时已有会话、保存与导出不受阻；用户禁用后不能凭旧 cookie/RPC userId 继续访问。
- [ ] **Step 5:** 提交 `feat: add account sessions and server side authorization`。

### Task 8: 图片校验、标准化、上传和授权读取

**Files:** Create `server/internal/assets/{probe,normalize,service,repository,http}.go`, `server/internal/assets/normalize_test.go`, `server/tests/integration/assets_test.go`, `tests/fixtures/images/`, `deploy/imagemagick-policy.xml`。

**Interfaces:** Consumes FileStore、Principal；`assets.Service.Upload(ctx,p Principal,name string,src io.Reader)(AssetVersion,error)`、`AuthorizeRead(ctx,p Principal,assetID,version string)(storage.Key,error)`；`Probe(ctx,path string)(ImageMetadata,error)`；`Normalize(ctx,srcPath,dstPath string)(NormalizedImage,error)`。gateway 流式暂存共享目录，core 使用受控 staging key 校验登记，不接收前端绝对路径。

- [ ] **Step 1:** `TestStaticFormatsAndEXIF`、`TestRejectAnimatedAndHighBitDepth`、`TestLimitsBeforeDecode` 覆盖 40 MiB/40MP/8192 双边界、伪扩展名、损坏和 ICC；`TestDBFailureLeavesNoAvailableAsset`、`TestAssetReadChecksOwnership`、`TestDiskFullReturnsUploadFailure`。
- [ ] **Step 2:** `go test ./server/internal/assets -v` 和 `go test ./server/tests/integration -run TestAsset -v`，确认失败。
- [ ] **Step 3:** 独立进程调用受限 ImageMagick，参数不经 shell，应用方向/ICC 后输出原尺寸 sRGB RGBA8 PNG，生成最长边 2048 预览；原字节保留 hash。先文件完整发布再事务登记 available/version/ref，失败标记孤立待回收；文件读取只能通过已授权版本，拒绝 Range/参数造成的越权。
- [ ] **Step 4:** 重跑 Step 2，验证 private 文件浏览器响应不泄漏绝对路径，正确 Content-Type/下载名、超限 413/422、不存在和无权限行为一致。
- [ ] **Step 5:** 提交 `feat: import and serve validated local background assets`。

### Task 9: 作品服务与版本冲突

**Files:** Create `server/internal/projects/{service,repository,refs}.go`, `server/internal/projects/service_test.go`, `server/tests/integration/projects_test.go`。

**Interfaces:** `projects.Service.Create(ctx,p,doc)(Project,error)`、`Save(ctx,p,id string,expectedRevision string,doc Document)(Project,error)`、`Get/List/Clone/SoftDelete/Restore`；Project `{id,ownerId,title,document,revision,updatedAt}`；`ResolveSnapshot(ctx,p,id,revision)(RenderSnapshot,error)` 输出锁定版本。

- [ ] **Step 1:** `TestSaveRejectsStaleRevisionWithoutMutation`、`TestCannotReferenceOtherUsersAssets`、`TestCloneGetsIndependentID`、`TestDeleteRestoreWithin30Days`、`TestSnapshotImmutableAfterLaterSave`；引用增减与文档保存同一 DB 事务。
- [ ] **Step 2:** `go test ./server/internal/projects -v` 和 `go test ./server/tests/integration -run TestProject -v`，确认失败。
- [ ] **Step 3:** 实现 MySQL CAS/冲突码、分页、软删除恢复、资源版本引用；几何/富文本使用 Go schema 校验；所有 public 版本与私有归属在 core 验证，客户端 ownerId 不可信。
- [ ] **Step 4:** 重跑 Step 2，并发保存冲突返回 409、保留原文档；版本读回包含完整局部样式和背景原始尺寸。
- [ ] **Step 5:** 提交 `feat: add versioned private poster projects`。

### Task 10: 用户站、共享 UI 与作品入口

**Files:** Create `packages/ui/src/{Button,Dialog,Form,BottomSheet,Status}.tsx`, `apps/web/src/{main,router}.tsx`, `apps/web/src/features/{auth,projects}/`, `apps/web/src/features/projects/ProjectList.test.tsx`, `tests/e2e/projects.spec.ts`。

**Interfaces:** Consumes generated apiClient；Produces authenticated routes `/login`、`/register`、`/projects`、`/projects/:id/edit`；Query keys 按 session userId 隔离；`ProjectWorkspace({projectId})` 承载后续编辑器。

- [ ] **Step 1:** e2e 断言注册→登录→上传图建作品→重命名/复制/删除/恢复可达；移动 360px 无关键按钮溢出；切账号后不显示旧账号缓存/缩略图。
- [ ] **Step 2:** `pnpm --filter @fastposter/web test`、`pnpm exec playwright test tests/e2e/projects.spec.ts`，确认目标流程失败。
- [ ] **Step 3:** 实现同源 Cookie 登录、错误反馈、登录失效跳转、作品列表/空状态/分页/上传进度与重试；组件命名按责任拆文件，关键控件键盘可操作。
- [ ] **Step 4:** 重跑 Step 2，使用真实 gateway/core/MySQL/FileStore 验证关键流程，不能仅用模拟接口替代闭环。
- [ ] **Step 5:** 提交 `feat: add authenticated poster workspace`。

### Task 11: 画布几何、文字块与统一历史

**Files:** Create `packages/poster-editor/src/{Editor,Stage,TextBlock,SelectionHandles}.tsx`, `packages/poster-editor/src/{store,geometry,history}.ts`, `packages/poster-editor/src/geometry.test.ts`, `tests/e2e/editor-geometry.spec.ts`。

**Interfaces:** Consumes PosterDocument/PosterFrame；Produces `Editor({document,onChange,onAssetRequest})`；`screenToDocument(point:Point,view:ViewTransform):Point`；`resizeTextWidth(block:TextBlock,edge:'left'|'right',deltaPx:number,canvas:Size):TextBlock`；`replaceBackground(doc,asset:AssetVersion):PosterDocument`；`history.begin/commit/undo/redo` 合并一段连续编辑/拖动。

- [ ] **Step 1:** `resizeWidthKeepsFontAndOppositeAnchor` 在 25%/100%/200% 视图缩放和 DPR1/2 下输出相同原图坐标；`replaceBackgroundScalesXYWidthOnly` 字号不变；e2e 断言拖块、调宽自动换行、自然高度、复制/排序/删除和撤销重做。
- [ ] **Step 2:** `pnpm --filter @fastposter/poster-editor test`、`pnpm exec playwright test tests/e2e/editor-geometry.spec.ts`，确认失败。
- [ ] **Step 3:** 实现两侧调宽把手、选中/编辑互斥、视图 transform、图层面板和几何约束；超出文字高度提示并禁止导出，不截正文。换背景尺寸提示并作为单个撤销事务。
- [ ] **Step 4:** 重跑 Step 2，确认无角点等比缩字手势；触摸热区 44px、键盘删除/撤销不影响输入态文字。
- [ ] **Step 5:** 提交 `feat: add poster geometry and width based text layout`。

### Task 12: 局部富文本、样式面板和手机手势

**Files:** Create `packages/poster-editor/src/text/{RichTextEditor,extensions,selection}.tsx`, `packages/poster-editor/src/panels/{Text,Font,Style,Paragraph}Panel.tsx`, `packages/poster-editor/src/mobile/{Toolbar,SettingsSheet}.tsx`, `packages/poster-editor/src/text/selection.test.ts`, `tests/e2e/editor-richtext.spec.ts`, `tests/e2e/editor-mobile.spec.ts`。

**Interfaces:** Consumes Task 11 的统一历史，禁用独立冲突的 Tiptap history；`applyTextStyle(target:TextTarget,patch:InlineStylePatch):void`，target 区分选区/光标/整块；`captureSelection/restoreSelection` 保存 selection bookmark；仅允许设计中的 marks/paragraph attributes，不使用完整无限制 StarterKit。

- [ ] **Step 1:** 测试选择“风景”仅变颜色/字号、其余文字不变；光标样式只影响后续输入；混合选区显示“混合”；调面板不丢选区；中文字形 IME compositionstart/update/end 不丢字/重排光标；统一撤销按用户事务逆转。
- [ ] **Step 2:** `pnpm --filter @fastposter/poster-editor test`、`pnpm exec playwright test tests/e2e/editor-richtext.spec.ts tests/e2e/editor-mobile.spec.ts`，确认失败。
- [ ] **Step 3:** 实现局部/块样式、面板 A、keyboard viewport 适配、双指视图缩放和空白区单指平移；输入区保留原生选词手势。字体注册使用服务器资源版本，不依赖字体名猜测；描边/阴影/背景/透明度共用 renderer 模型。
- [ ] **Step 4:** 重跑 Step 2，并在真实 iOS Safari/Android Chrome 记录中文输入、选区修改、软键盘遮挡和下载前操作；无法获得真实设备时明确标记人工验收未完成，桌面移动模拟只作为补充。
- [ ] **Step 5:** 提交 `feat: support rich text styling and mobile editing`。

### Task 13: 自动保存、本地恢复与冲突处理

**Files:** Create `apps/web/src/features/editor/{ProjectWorkspace,ConflictDialog,SaveStatus}.tsx`, `apps/web/src/features/editor/{autosave,drafts}.ts`, `apps/web/src/features/editor/autosave.test.ts`, `tests/e2e/autosave.spec.ts`。

**Interfaces:** `useProjectAutosave(projectId,document):{status,flush():Promise<Project>,conflict?}`；`DraftStore.put/get/clearUser` 以 userId/projectId 隔离 IndexedDB，draft 含 baseRevision、doc、待上传文件和时间；flush 是导出的前置依赖。

- [ ] **Step 1:** fake timer 断言最后编辑 1000ms 后一次保存、拖拽期间不发连续请求、上传未结束不能标已保存；`conflictPreservesLocalDraft`；`logoutClearsOnlyOwnDraft`；e2e 两会话冲突和断网刷新恢复不静默覆盖。
- [ ] **Step 2:** `pnpm --filter @fastposter/web test`、`pnpm exec playwright test tests/e2e/autosave.spec.ts`，确认失败。
- [ ] **Step 3:** 实现序列化保存、revision 更新和本地 durable draft；处理迟到响应、401、离线和重试；409 提供加载云端/本地另存，保留本地直到用户明确处理；IME 组合输入中不提交半成品事务。
- [ ] **Step 4:** 重跑 Step 2，另存后文件引用归属正确；跨设备读回与最新已保存快照一致。
- [ ] **Step 5:** 提交 `feat: autosave projects and preserve conflicting drafts`。

### Task 14: 持久化导出任务、最终预览与下载

**Files:** Create `server/internal/exports/{service,repository,worker,resources,http}.go`, `server/internal/exports/worker_test.go`, `server/cmd/export-worker/main.go`, `apps/web/src/features/export/{ExportDialog,useExport}.tsx`, `server/tests/integration/export_jobs_test.go`, `tests/e2e/export.spec.ts`。

**Interfaces:** Consumes ResolveSnapshot/Renderer/FileStore；`Create(ctx,p,projectID,revision,idempotencyKey)(Job,error)`；`Claim(ctx,workerID string,now time.Time)(Lease,error)`；`Renew/Complete/Fail(ctx,leaseToken string,...)` 通过 token+租期+状态条件更新；`Worker.Run(ctx) error`；最终 result 使用每次尝试唯一 key，不复用同一可写文件路径。

- [ ] **Step 1:** `TestOneRunningTwoQueuedPerUser`；`TestStaleLeaseCannotPublishOrDeleteNewResult`；`TestCrashRecoveryAndMaxAttempts`；`TestExportSnapshotUnaffectedByLaterEdit`；`TestPrivateDownloadAndSevenDayExpiry`；e2e 导出前 flush、最终预览与下载同一结果散列。
- [ ] **Step 2:** `go test ./server/internal/exports -v`、`go test ./server/tests/integration -run TestExport -v`、`pnpm exec playwright test tests/e2e/export.spec.ts`，确认失败。
- [ ] **Step 3:** MySQL 领取短事务+lease fencing，任务执行不持数据库长锁；worker 按 30 秒租约周期内续期、120 秒超时、最多 2 次尝试；文件成功后只允许有效 token 发布 DB result，无效尝试文件延后 GC。轮询 queued/running/succeeded/failed，下载走所有者鉴权流，不公开目录。
- [ ] **Step 4:** 重跑 Step 2 和 Task 4 渲染检查；kill/restart worker 后任务可恢复；缺字体/丢文件/磁盘满返回具体失败，不创建成功任务；运行中修改作品不改变本次输出。
- [ ] **Step 5:** 提交 `feat: deliver durable native size PNG exports`。

## 阶段三：公共资源、后台和本机运维

### Task 15: 公共背景、字体和后台基础

**Files:** Create `server/internal/catalog/{backgrounds,fonts,versions,admin}.go`, `server/internal/catalog/service_test.go`, `apps/admin/src/{main,router,AdminLayout}.tsx`, `apps/admin/src/features/{overview,users,projects,backgrounds,fonts,jobs,audit}/`, `apps/web/src/features/catalog/{BackgroundPicker,FontPicker}.tsx`, `server/tests/integration/catalog_test.go`, `tests/e2e/admin-catalog.spec.ts`。

**Interfaces:** `catalog.Service.ListPublished(ctx,kind,filter)`、`Publish/Unpublish(ctx,p,resourceID,version)`、`UploadFontFace(ctx,p,fontID,weight,style,src)(FontFace,error)`；admin routes `/admin/{overview,users,projects,backgrounds,fonts,jobs,audit}`，全部 core 检查 admin。公共资源既有 current published 指针，也有不可变版本访问授权，旧作品只读其已有依赖。

- [ ] **Step 1:** `TestUnpublishKeepsReferencedVersionReadable`、`TestRejectDeletingReferencedFile`、`TestFontMissingWeightNotSynthesized`、`TestAdminProjectListContainsMetadataOnly`；e2e 管理员发布背景/字体→用户选用→下架→旧作品仍导出成功；普通用户伪造管理请求返回 403。
- [ ] **Step 2:** `go test ./server/internal/catalog -v`、`go test ./server/tests/integration -run TestCatalog -v`、`pnpm exec playwright test tests/e2e/admin-catalog.spec.ts`，确认失败。
- [ ] **Step 3:** 实现资源分类/排序/草稿/发布，字体格式解析与缺字提示、家族/字重/版本关联；后台基础导航、用户禁用/恢复/一次性改密、作品元数据、存储和任务统计、审计页。复用用户编辑核心，不允许后台代改私有作品正文。
- [ ] **Step 4:** 重跑 Step 2，确认管理日志不包含密码/会话/私有文案；概览存储包含原图+标准化+预览+导出实际字节；管理员禁用的用户会话即时失效。
- [ ] **Step 5:** 提交 `feat: manage shared backgrounds fonts and accounts`。

### Task 16: 模板快照、包导入导出与模板管理

**Files:** Create `server/internal/templates/{manifest,archive,service,repository}.go`, `server/internal/templates/archive_test.go`, `apps/web/src/features/templates/{TemplatePicker,ImportTemplate}.tsx`, `apps/admin/src/features/templates/{TemplateList,TemplateEditor}.tsx`, `tests/e2e/templates.spec.ts`。

**Interfaces:** `TemplateManifest{format:'fastposter',version:1,documentPath,assets:[],fonts:[]}`；`Import(ctx,p,zip io.Reader)(TemplateImport,error)`、`Export(ctx,p,sourceID)(storage.Key,error)`、`Apply(ctx,p,templateID,version)(Project,error)`；包内 document 使用 Task 2 schema，不含账号信息/绝对路径/外链/字体二进制。

- [ ] **Step 1:** `TestArchiveLimitsAndPathTraversal` 断言 80 MiB/120 MiB/20 文件边界、`../`、符号链接 ZIP 项、嵌套压缩/多余文件拒绝；`TestMissingFontListsDependencies`；`TestApplyCreatesIndependentPrivateProject`；包往返保留局部 marks、画布和背景。
- [ ] **Step 2:** `go test ./server/internal/templates -v`、`pnpm exec playwright test tests/e2e/templates.spec.ts`，确认失败。
- [ ] **Step 3:** 流式限制解压与依赖校验，缺字体阻止应用且列出缺项；管理员共享编辑器创建/修改/预览/发布模板，普通用户导入为私有作品、导出自己的模板包；字体只按系统版本引用，背景写 FileStore 后建立引用。
- [ ] **Step 4:** 重跑 Step 2，验证下架模板不影响已创建作品；上传异常和数据库回滚不会留下可见半模板；禁止导入脚本/HTML/URL。
- [ ] **Step 5:** 提交 `feat: add portable poster templates and administration`。

### Task 17: 级联文案和用户插入

**Files:** Create `server/internal/copy/{service,repository}.go`, `server/internal/copy/service_test.go`, `apps/admin/src/features/copy/{CategoryTree,CopyList,CopyForm}.tsx`, `apps/web/src/features/copy/CopyPicker.tsx`, `tests/e2e/copy.spec.ts`。

**Interfaces:** `copy.Service.MoveCategory(ctx,p,id,parentID string) error`；`ListChildren/ListEntries/Publish/Unpublish`；`insertCopy(editor,text:string):void` 有选区替换并继承当前样式，无选区创建新块；文案纯文本，不引入预算计算或模板变量。

- [ ] **Step 1:** `TestRejectCyclesAndDepthSix`；`TestUnpublishedCopyHidden`；e2e 五层内级联筛选、搜索、插入新块、替换混合样式选区后按当前样式插入且可一次撤销。
- [ ] **Step 2:** `go test ./server/internal/copy -v`、`pnpm exec playwright test tests/e2e/copy.spec.ts`，确认失败。
- [ ] **Step 3:** 实现后台分类树/排序/文案上下架和用户级联面板，空分类与下架项给出正常空状态；移动分类事务内防循环，服务端限制 5 层。
- [ ] **Step 4:** 重跑 Step 2，验证普通用户不可编辑公共文案、文案内容按纯文本插入而非执行 HTML。
- [ ] **Step 5:** 提交 `feat: add cascading copy catalog and insertion`。

### Task 18: 清理、磁盘状态和一致备份恢复

**Files:** Create `server/internal/storage/{gc,health}.go`, `server/internal/storage/gc_test.go`, `server/cmd/maintenance/main.go`, `deploy/backup.md`, `deploy/local.md`, `server/tests/integration/recovery_test.go`。

**Interfaces:** `GC.Run(ctx,now time.Time)(GCReport,error)` 只删已到期且无引用文件；`maintenance backup/restore/check` 默认只做检查，备份流程先暂停本应用写入/worker、等待在途任务退出，再备份 MySQL 和 APP_DATA_DIR，恢复到独立实例验证。数据库已有其他库不受影响。

- [ ] **Step 1:** `TestGCDoesNotDeleteActiveOrLeasedFiles`、`TestCollectsOrphanAfterGracePeriod`、`TestExpiresOnlyExportResultAfterSevenDays`、`TestSoftDeletedProjectRestoresWithin30Days`、`TestRestartUsesSameAbsoluteDataDir`；恢复测试验证原图 hash、作品 JSON、私有鉴权和可重新导出。
- [ ] **Step 2:** `go test ./server/internal/storage -v`、`go test ./server/tests/integration -run 'TestRecovery|TestGC|TestRestart' -v`，确认失败。
- [ ] **Step 3:** 实现可观测清理与 dry-run、磁盘可写/剩余空间检查、过期结果和暂存孤儿回收；活动引用/租约文件排除，避免与上传/导出竞争。说明同机单根部署边界、迁移目录操作与备份恢复；不实现外部对象存储。
- [ ] **Step 4:** 重跑 Step 2，用独立测试库和临时数据根进行备份恢复演练；数据库事务失败/磁盘不足/文件丢失都能定位，不能显示已保存或成功导出。
- [ ] **Step 5:** 提交 `feat: add local storage maintenance and recovery`。

### Task 19: 全流程验收与可复现交付

**Files:** Create `tests/e2e/full-flow.spec.ts`, `tools/check-generated.sh`, `docs/verification/{acceptance,mobile,local-environment}.md`, `README.md`；Modify 根 scripts、`deploy/local.md`、`docs/verification/render-capacity.md`。

**Interfaces:** Produces `pnpm verify`（契约无漂移、TS typecheck、单元、构建）、`pnpm test:e2e`、`go test ./server/... ./tools/...`；集成测试通过显式测试 DSN 和根目录运行；README 给出原生配置、迁移、管理员创建、启动与下载步骤。

- [ ] **Step 1:** 写完整 e2e：注册→本机图片导入→混合字体文字→拖动调宽→自动保存→另一会话恢复→最终预览和 PNG 下载；后台发布资源→用户使用→下架后仍导出；用断网和过期租约注入验证无静默丢数据。
- [ ] **Step 2:** 运行 `pnpm exec playwright test tests/e2e/full-flow.spec.ts`，确认尚未满足的全流程断言失败；失败若暴露设计问题，记录并修复所属任务，不能降低断言。
- [ ] **Step 3:** 补齐装配、文档与生成漂移检查，移除已不用的演示路由和模拟返回；保留渲染 fixture 与容量测试入口。确认无 Postgres/S3/MinIO/Docker 运行要求和凭据占位误导。
- [ ] **Step 4:** 依次运行 `pnpm verify`、`go test ./server/... ./tools/...`、配置真实独立 MySQL 的 `go test ./server/tests/integration -v`、`pnpm test:e2e`、容量测试；核对真实手机人工记录。未运行的项逐条标明原因，不声称全部通过。
- [ ] **Step 5:** 提交 `docs: document and verify native FastPoster delivery`；交付启动说明、实际通过的检查、容量数据、人工验收缺口和剩余限制，不自动部署到公网。

## 自审映射

| 设计要求 | 计划任务 |
| --- | --- |
| 原图尺寸、透明度、富文本一致排版和 PNG | 2、4、8、11、12、14、19 |
| 本机 MySQL/Redis、无对象存储/容器依赖 | 1、3、6、8、14、18 |
| 登录、会话、作品隔离与后台权限 | 5、7、9、10、15 |
| 云端保存、跨设备恢复、断网和冲突 | 9、10、13 |
| 手机底部面板、选区、输入和手势 | 11、12、13、19 |
| 背景/字体版本和管理员维护 | 8、15、18 |
| 模板包、共享编辑器、私有导入作品 | 16 |
| 级联文案和选区替换 | 17 |
| 持久任务、重试、超时、下载保留期限 | 6、14、18 |
| 运维、存储用量、审计和备份 | 15、18、19 |
| Thrift 契约、代码生成与版本锁定 | 1、5、19 |

自审结论：所有首版模块有实现任务；高风险跨任务接口（Document、FileStore、Principal、Project revision、RenderSnapshot、Lease token）已在首次生产它们的任务中命名。不同任务可按领域进一步拆小文件，不改变接口与验收语义。这里列出的检查均为待执行计划，不是已有通过记录。

## 参考与执行交接

- MySQL 队列领取依据：[InnoDB locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)；仅用于短领取事务，完成时必须再次校验租约 token。
- 完整范围与外部核查来源以关联设计文档为准；数据库连接配置与凭据在本机配置阶段提供，不在计划中写死。
- 当前仅完成规划，产品代码/依赖安装尚未开始。请用户审阅计划并选择：主代理在本聊天顺序实施（Native），或按任务分派实施/审阅代理（Subagent-driven）。本计划推荐 Native：核心文档、渲染、存储和版本接口相互依赖，顺序推进便于及时验证真实本机环境；关键边界仍按任务检查与最终独立代码审阅。
