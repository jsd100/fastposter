# 本机运行

本项目原生运行于同一台 Mac/Linux 主机，无需 Docker 或对象存储。

1. 准备 MySQL 8.0+ 兼容服务、Node 24、pnpm 11、Go 1.27、Chrome/Chromium 和 ImageMagick 7。Redis 可选。
2. 将 `deploy/local.env.example` 复制为仓库根 `.env.local` 并填写本机凭据；该文件禁止提交。创建独立 `fastposter` 数据库和 `fastposter_test_*` 测试库，字符集 utf8mb4。
3. `pnpm install --frozen-lockfile`；`go mod download`。如 Go 代理直连不可用，请在命令环境设置本机已有 HTTPS_PROXY，不修改全局网络配置。
4. `go run ./tools/doctor -check all` 检查配置、实际数据库/Redis连接、Chrome 和 ImageMagick。
5. `pnpm dev` 启动服务；Ctrl-C 只停止此启动器创建的进程组。用户站 5173，管理站 5174，网关 8080，Kitex 8888。

表结构通过 `go run ./server/cmd/migrate -direction up` 显式应用，不在应用启动时自动改表。回滚需要 `-direction down -allow-destructive-down`，会删除本应用的表。

真实 MySQL 测试：`python3 tools/test-integration.py`。可设置 `FASTPOSTER_TEST_MYSQL_DSN`；默认只从名为 fastposter 的业务 DSN 派生 fastposter_test_integration，Go 测试再次强制检查前缀。测试用户需能在 fastposter_test_* 范围创建/删除测试自身生成的独立数据库，不能使用已有业务 schema 做清理。

接口生成：先将 `deploy/toolchain.lock.json` 指定版本的 hz、kitex、thriftgo 安装到 `.tools/bin`，然后 `pnpm contracts:generate`。此命令从 Thrift 同时更新 Hertz 模型、Kitex 客户端/服务端、TypeScript DTO 和路由元数据；生成文件不手改。`pnpm contracts:check` 会重新生成并比较文件集合和 SHA-256，`pnpm verify` 已包含该检查。

交付前检查：`pnpm verify`（契约、typecheck、单元、构建）、`pnpm test:server`、`python3 tools/test-integration.py --all-server`、`pnpm test:e2e`。实际通过记录和未完成的人工验收见 [../docs/verification/acceptance.md](../docs/verification/acceptance.md)。

初始化管理员：`go run ./server/cmd/admin-cli -username admin`，在交互提示中隐藏输入密码。自动化可使用 `-password-stdin`，不要将密码放到命令行参数中。不会生成公开默认密码；普通网页注册始终只能创建 user。

账号密码至少 8 个字符。登录会话保存 30 天，退出、禁用和密码重置可撤销；数据库只保存会话散列。Redis 只提供可选限流，故障时降级到有界内存实现，不影响数据库中的会话读取。

生产 HTTPS 配置必须设置 `COOKIE_SECURE=true`，并将 `APP_ORIGINS` 改为实际前端 HTTPS origin；本机默认允许 5173/5174/8080 的 localhost 和 127.0.0.1。修改配置后重启服务。

APP_DATA_DIR 相对仓库根解析，默认 `var/data`，所有进程共享这一目录。私有文件只能经授权 HTTP 接口读取。网关、核心服务和导出 worker 启动时会检查该目录：不可写直接退出，剩余空间低于 512 MiB 记录警告。

日常健康检查、存储清理和备份恢复见 [backup.md](backup.md)。最常用的命令：

```sh
go run ./server/cmd/maintenance check             # 只读检查
go run ./server/cmd/maintenance gc                # GC 试运行
go run ./server/cmd/maintenance gc -apply         # 执行清理
go run ./server/cmd/maintenance backup            # 暂停写入并备份 MySQL 和 APP_DATA_DIR
```

软删除作品 30 天内可恢复，导出结果保留 7 天，不要手工删除 APP_DATA_DIR 中的文件。备份目录必须位于 APP_DATA_DIR 之外；恢复只写入独立的数据库和数据目录，不影响其他库。
