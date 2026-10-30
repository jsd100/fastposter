# 本机原生环境验收

记录时间：2026-10-30。验证目标是：不依赖 Docker、PostgreSQL、S3/MinIO 或云对象存储，使用本机 MySQL、文件系统、Chrome 和 ImageMagick 完成全部功能。

## 实际版本

| 组件 | 版本 / 位置 |
| --- | --- |
| 操作系统 | macOS arm64（27.0.0） |
| Node.js | 24.21.0（`deploy/toolchain.lock.json` 观测值） |
| pnpm | 11.25.0，通过 corepack；仓库内 `.tools/bin/pnpm` shim 仅用于测试启动 |
| Go | 1.27.2 |
| MySQL | 26.7.0，`127.0.0.1:3306`，凭据只存在于未提交的 `.env.local` |
| Redis | 8.10.2（可选；本机运行，仅登录限流） |
| Chrome | 156.0.8078.48 |
| ImageMagick | 7.1.2-34（`magick`） |
| mysqldump/mysql | 26.7.0，`/opt/homebrew/bin` |

`go run ./tools/doctor -check all` 的实际输出（凭据已隐藏）：

```json
[{"component":"config","ok":true,"message":"configuration valid; data root resolved"},{"component":"mysql","ok":true,"message":"connected; version 26.7.0"},{"component":"redis","ok":true,"message":"optional rate limiter connectivity checked"},{"component":"chrome","ok":true,"message":"available"},{"component":"magick","ok":true,"message":"available"}]
```

## 数据库边界

- 业务库为独立 `fastposter` schema，字符集 utf8mb4。
- 集成测试只使用 `fastposter_test_*`。`tools/test-integration.py` 从业务 DSN 派生测试 DSN，不打印密码；测试进程再次检查数据库名前缀，并在结束时只删除自己创建的随机测试库。
- 恢复演练另建 `fastposter_test_restore_*` 与 `fastposter_test_sentinel_*`，验证恢复不会改动目标之外的数据库。
- `.env.local`、`var/`、`.tools/`、`node_modules/`、测试输出均在 `.gitignore` 中。

## 存储与进程

- 所有进程读取同一个 `APP_DATA_DIR`，默认 `var/data`，相对路径在启动时解析为稳定绝对路径（`TestRestartUsesSameAbsoluteDataDir` 覆盖重启一致性）。
- 网关、核心服务、导出 worker 启动时检查目录可写性和剩余空间；不可写退出，低于 512 MiB 警告。
- 导出 worker 并发 1，使用 `APP_DATA_DIR/.work` 作为临时目录；Chrome 路径来自 `CHROME_PATH`，renderer 构建产物在 `apps/renderer/dist`。
- `pnpm dev` 构建 renderer 并启动核心、网关、worker、用户站和管理站；没有容器编排或外部对象存储配置。

## 生成链

Thrift 是契约唯一来源，`tools/contractgen` 同时生成 Hertz/Kitex Go 代码、TypeScript DTO 和路由元数据。生成器版本记录在 `deploy/toolchain.lock.json`，安装到被忽略的 `.tools/bin`：

```sh
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/kitex/tool/cmd/kitex@v0.16.4
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/hertz/cmd/hz@v0.9.8
GOBIN="$PWD/.tools/bin" go install github.com/cloudwego/thriftgo@v0.4.5
```

`tools/check-generated.sh` 在临时快照上重新生成并比较文件集合与 SHA-256；`pnpm verify` 首先执行该检查。本次验收运行结果：`generated contracts match the Thrift IDL`。

## 未纳入的环境项

- 没有在第二台主机或独立操作系统用户下复跑完整流程。
- 没有测试公网反向代理、HTTPS 证书或生产防火墙配置；这些不属于本机原生验收范围，项目也未自动部署到公网。
- 真实 iOS Safari / Android Chrome 设备不可用，见 [mobile.md](mobile.md)。
