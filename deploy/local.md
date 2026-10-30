# 本机运行

本项目原生运行于同一台 Mac/Linux 主机，无需 Docker 或对象存储。

1. 准备 MySQL 8.0+ 兼容服务、Node 24、pnpm 11、Go 1.27、Chrome/Chromium 和 ImageMagick 7。Redis 可选。
2. 将 `deploy/local.env.example` 复制为仓库根 `.env.local` 并填写本机凭据；该文件禁止提交。创建独立 `fastposter` 数据库和 `fastposter_test_*` 测试库，字符集 utf8mb4。
3. `pnpm install --frozen-lockfile`；`go mod download`。如 Go 代理直连不可用，请在命令环境设置本机已有 HTTPS_PROXY，不修改全局网络配置。
4. `go run ./tools/doctor -check all` 检查配置、实际数据库/Redis连接、Chrome 和 ImageMagick。
5. `pnpm dev` 启动服务；Ctrl-C 只停止此启动器创建的进程组。用户站 5173，管理站 5174，网关 8080，Kitex 8888。

表结构通过 `go run ./server/cmd/migrate -direction up` 显式应用，不在应用启动时自动改表。回滚需要 `-direction down -allow-destructive-down`，会删除本应用的表。

真实 MySQL 测试：`python3 tools/test-integration.py`。可设置 `FASTPOSTER_TEST_MYSQL_DSN`；默认只从名为 fastposter 的业务 DSN 派生 fastposter_test_integration，Go 测试再次强制检查前缀。测试用户需能在 fastposter_test_* 范围创建/删除测试自身生成的独立数据库，不能使用已有业务 schema 做清理。

接口生成：先将 `deploy/toolchain.lock.json` 指定版本的 hz、kitex、thriftgo 安装到 `.tools/bin`，然后 `pnpm contracts:generate`。此命令从 Thrift 同时更新 Hertz 模型、Kitex 客户端/服务端、TypeScript DTO 和路由元数据；生成文件不手改。

APP_DATA_DIR 相对仓库根解析，默认 `var/data`，所有进程共享这一目录。私有文件只能经授权 HTTP 接口读取。

当前仍在实施阶段：数据库迁移、管理员初始化与完整编辑流程会在相应任务完成后补全；health 路由验证 Hertz→Kitex 实际调用。
