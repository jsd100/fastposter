# FastPoster

FastPoster 是一个在本机原生运行的海报编辑器：导入自己的图片，排版富文本，自动保存，按原图像素尺寸导出 PNG。前端为 React 用户站和管理站，后端为 Go（Hertz 网关 + Kitex 核心服务 + 独立导出 worker），MySQL 保存账号、作品和导出任务，私有文件直接保存在本机文件系统。不需要 Docker、PostgreSQL、S3/MinIO 或云对象存储。

## 功能

- 导入 JPG/PNG/WebP 背景，保留原像素尺寸，拒绝动画、CMYK、16 位和损坏图片。
- 混合字体富文本、字号/颜色/字重/强调、选区样式、拖动移动、两侧把手调宽、撤销重做。
- 自动保存、离线草稿恢复、版本冲突另存；桌面和手机底部面板共用同一编辑器。
- MySQL 持久导出队列，30 秒租约、崩溃重试、幂等请求；Chrome 渲染原尺寸 PNG，结果保留 7 天。
- 模板包导入导出、级联文案、公共背景/字体后台管理，下架不影响已有作品。
- 回收站 30 天恢复、磁盘健康检查、存储 GC、一致性备份和独立实例恢复。

## 环境

- macOS 或 Linux 单机。
- Node 24，pnpm 11（通过 corepack）。
- Go 1.27。
- MySQL 8.0+（本机实测 MySQL 26.7.0 兼容版本）。
- Chrome/Chromium 和 ImageMagick 7。
- Redis 可选，仅用于登录限流；未配置或故障时降级到有界内存实现。

## 配置

```sh
cp deploy/local.env.example .env.local
```

编辑 `.env.local` 填入本机 MySQL 凭据，并先创建业务库：

```sql
CREATE DATABASE fastposter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`.env.local` 已在 `.gitignore` 中，禁止提交。`APP_DATA_DIR` 相对仓库根解析（默认 `var/data`），所有进程必须共享同一绝对目录。生产 HTTPS 还要设置 `COOKIE_SECURE=true` 和实际的 `APP_ORIGINS`。

集成测试使用独立的 `fastposter_test_*` 数据库：`python3 tools/test-integration.py` 从业务 DSN 派生受保护的测试 DSN，Go 测试会再次强制检查数据库名前缀，不会清理业务库。

## 安装

```sh
corepack pnpm install --frozen-lockfile
go mod download
```

重新生成 Thrift 契约或运行 `pnpm verify` 的漂移检查时，需要把锁定版本的生成器装到 `.tools/bin`（该目录已被忽略）：

```sh
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/kitex/tool/cmd/kitex@v0.16.4
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/hertz/cmd/hz@v0.9.8
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/thriftgo@v0.4.5
```

## 初始化

```sh
go run ./server/cmd/migrate -direction up
go run ./server/cmd/admin-cli -username admin
go run ./tools/doctor -check all
```

迁移不会在应用启动时自动执行。管理员密码在交互提示中隐藏输入；自动化可加 `-password-stdin`，不要把密码放进命令行参数。`doctor` 检查配置、实际 MySQL/Redis 连接、Chrome 和 ImageMagick。

## 启动

```sh
pnpm dev
```

该命令构建共享 renderer，并启动核心服务、网关、导出 worker、用户站和管理站：

- 用户站：http://127.0.0.1:5173
- 管理站：http://127.0.0.1:5174/admin/login
- 网关：http://127.0.0.1:8080

端口和地址可用 `.env.local` 中的 `GATEWAY_ADDR`、`CORE_ADDR` 调整；前端开发代理监听 `API_PROXY`。Ctrl-C 只停止本次启动的进程组。

## 使用与下载

1. 打开用户站注册并登录。
2. 在作品列表点击“导入背景图”选择本机图片，进入编辑器。
3. 添加文字，选择文字或光标后调整字体、字号和颜色；拖动文字块移动，拖动两侧把手改变自动换行宽度。
4. 修改自动保存，显示“已保存”。换一个浏览器或窗口登录同一账号可继续编辑。
5. 点击“导出 PNG”。任务完成后对话框显示最终预览；“下载原尺寸 PNG”保存与预览 SHA-256 一致的原尺寸文件。
6. 导出结果保留 7 天；“模板包”可导出可移植的 ZIP，工作台也能导入模板创建独立私有作品。

管理员登录管理站可发布背景和字体、查看作品元数据、任务和审计日志。下架资源只影响新的浏览选择，已有作品仍可按明确版本读取和导出。

## 验证

```sh
pnpm verify                 # 契约无漂移、TypeScript typecheck、单元测试、全部构建
pnpm test:server            # go test ./server/... ./tools/...
python3 tools/test-integration.py --all-server
pnpm test:e2e               # 需要本机 MySQL/Chrome/ImageMagick
FASTPOSTER_RENDER_TEST=1 FASTPOSTER_CAPACITY_TEST=1 go test ./server/tests/integration -run TestRender -count=1 -v
```

`pnpm test:e2e` 通过 `TestBrowserStack` 启动临时 MySQL schema、真实领域服务、Hertz 网关、Chrome worker 和两个 Vite 前端，测试结束即清理。浏览器测试使用仓库内 fixture，不需要真实业务数据。完整验收记录、容量数据和人工验收缺口见 [docs/verification/acceptance.md](docs/verification/acceptance.md)。

## 运维

```sh
go run ./server/cmd/maintenance check      # 只读：磁盘、文件哈希、GC 试运行、行数
go run ./server/cmd/maintenance gc         # GC 试运行
go run ./server/cmd/maintenance gc -apply  # 删除到期且无引用文件
go run ./server/cmd/maintenance backup     # 暂停写入，备份 MySQL + APP_DATA_DIR
```

备份恢复到独立数据库和数据目录，绝不执行 `DROP DATABASE`，其他数据库不受影响。操作细节、保留期限、恢复到独立实例的步骤与恢复演练见 [deploy/backup.md](deploy/backup.md)；本机运行细节见 [deploy/local.md](deploy/local.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `apps/web`、`apps/admin` | 用户站、管理站 |
| `apps/renderer` | Chrome 渲染入口 |
| `packages/poster-*` | 文档 schema、DOM 排版、编辑器 |
| `server/cmd` | 网关、核心服务、worker、迁移、管理员、维护命令 |
| `server/internal` | 领域服务、存储、传输适配 |
| `server/gen`、`idl` | Thrift 契约及生成代码，生成文件禁止手改 |
| `tests/e2e` | Playwright 验收 |
| `deploy` | 本机环境、备份恢复、工具链锁定 |

## 限制

- 当前按单机原生部署设计，不提供多实例共享文件存储或公网部署脚本。
- 备份是 MySQL 逻辑导出 + 文件复制，不是二进制日志时间点恢复；备份包含密码散列和私有作品文件，应按敏感数据处理。
- 手机交互有 Chrome 360×800 触摸自动化覆盖，真实 iOS/Android 输入法和保存流程仍需人工验收，状态见 [docs/verification/mobile.md](docs/verification/mobile.md)。
- 导出结果 7 天、回收站 30 天；需要长期留存的成品请在浏览器下载保存。
