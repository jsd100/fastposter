# Repository Guidelines

## 项目结构与职责划分

FastPoster 是本机原生运行的海报编辑器，使用 React/TypeScript 前端、Go 服务、MySQL 和本地文件存储。

- `apps/web`、`apps/admin`：用户站与管理站；`apps/renderer`：Chrome 导出渲染入口。
- `packages/poster-schema`、`packages/poster-renderer`、`packages/poster-editor`：文档校验、排版渲染和编辑交互；共享控件放在 `packages/ui`，API 调用放在 `packages/api-client`。
- `server/cmd`：网关、核心服务、worker 及运维命令；`server/internal`：领域逻辑、存储和传输适配；`internal/config`：共享配置；`server/migrations`：数据库迁移。
- `idl`、`server/gen`：Thrift 契约与生成代码；`assets`：字体、色彩配置等静态资源。
- `tests/e2e`、`tests/fixtures`：浏览器测试与固定样例；`deploy`：部署说明；`docs/verification`：验收记录。

跨站功能优先复用共享包，避免在用户站、管理站和导出入口重复实现排版或编辑逻辑。

## 环境准备与本地开发

依赖 Node 24、pnpm 11、Go 1.27、MySQL 8+、Chrome/Chromium、ImageMagick 7 和 Python 3；Redis 可选。具体工具版本参见 `package.json`、`go.mod` 和 `deploy/toolchain.lock.json`。

首次启动按以下顺序执行：

```sh
corepack pnpm install --frozen-lockfile
go mod download
cp deploy/local.env.example .env.local
# 编辑本机凭据，并按 README.md 创建业务数据库后执行：
go run ./server/cmd/migrate -direction up
go run ./server/cmd/admin-cli -username admin
go run ./tools/doctor -check all
pnpm dev
```

迁移不会随应用启动自动执行。开发默认地址：用户站 `http://127.0.0.1:5173`，管理站 `http://127.0.0.1:5174/admin/login`，网关 `http://127.0.0.1:8080`。

## 构建与验证命令

在仓库根目录运行：

| 命令 | 用途 |
| --- | --- |
| `pnpm build` | 通过 Turbo 构建工作区包和应用 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm test:server` | 测试 `server/...` 和 `tools/...` |
| `go test ./internal/...` | 验证根目录共享配置包 |
| `python3 tools/test-integration.py --all-server` | 使用受保护的测试 DSN 运行服务端测试 |
| `pnpm test:e2e` | Playwright 启动临时完整服务栈并执行验收 |
| `pnpm verify` | 契约漂移检查、类型检查、单元测试及构建 |

`pnpm verify` 不包含 Go 和端到端测试，须按改动范围补跑。契约检查依赖 `.tools/bin` 中的固定版本生成器，安装步骤见 `README.md`。

## 代码风格与契约维护

- TypeScript 使用严格类型、两空格缩进、双引号和分号；组件文件使用 PascalCase，函数及 Hook 使用 camelCase，工具文件沿用相邻代码的命名方式。
- 使用 `pnpm exec prettier --write <文件路径>` 格式化修改过的前端文件，Go 使用 `gofmt -w <文件路径>`；避免无关的全仓格式化。当前未配置独立 lint 脚本。
- 契约修改从 `idl` 开始，运行 `pnpm contracts:generate`，同时提交生成结果；禁止手改 `server/gen`、`packages/api-client/src/generated.ts` 及生成路由。

## 测试要求

Vitest 测试与源码相邻，命名为 `*.test.ts`；应用内也支持 `*.test.tsx`。Go 测试使用 `*_test.go`；Playwright 使用 `tests/e2e/*.spec.ts`，复用 `tests/fixtures` 中的样例。

为行为变更和缺陷修复补充对应测试；当前未设置数值覆盖率门槛。可用 `pnpm exec vitest run <测试文件>` 或 `go test <包路径> -run <测试名>` 定向验证。

数据库测试仅使用 `fastposter_test_*`，测试账号需有创建和删除临时测试库的权限。自定义业务库名时显式设置 `FASTPOSTER_TEST_MYSQL_DSN`。未配置测试 DSN 时，部分 Go 集成测试会跳过，提交说明中应区分通过与跳过。浏览器测试还需 MySQL、Chrome 和 ImageMagick；非默认 Chrome 路径通过 `CHROME_PATH` 指定。

## 提交与合并请求

沿用历史中的 Conventional Commits，例如 `feat(editor): ...`、`fix(ui): ...`、`docs: ...`。每次提交聚焦一个目的，不覆盖或混入工作区已有的无关修改。

PR 应说明问题、变更后的行为、关联 issue，以及实际执行的验证命令和结果；未执行或跳过的检查说明原因。界面变更附截图或录屏，涉及验收结论时同步更新 `docs/verification`。配置、契约和迁移变更应说明兼容性及必要的操作步骤。

## 配置与数据安全

`.env.local` 仅用于本机，禁止提交凭据、私有作品和数据库备份。`APP_DATA_DIR` 相对仓库根解析，所有服务必须共享同一绝对数据目录。管理员密码使用交互输入或 `-password-stdin`，不要写入命令行参数。生产 HTTPS 配置需设置 `COOKIE_SECURE=true` 和实际的 `APP_ORIGINS`；备份恢复按 `deploy/backup.md` 操作。
