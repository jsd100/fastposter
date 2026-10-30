# 维护、备份与恢复

本项目原生运行在单台主机上，数据库在 MySQL，私有文件在 `APP_DATA_DIR`。备份必须同时覆盖两者，单独备份其中一项无法恢复完整作品。

维护命令都从仓库根执行，并读取 `.env.local` 或环境变量中的 `MYSQL_DSN`、`APP_DATA_DIR`；凭据只通过 `MYSQL_PWD` 传给 `mysqldump`/`mysql` 子进程，不写入命令行或备份目录。需要 `mysqldump` 和 `mysql` 在 `PATH` 中。

## 检查

```sh
go run ./server/cmd/maintenance check
```

默认命令，只读，不删除任何内容。它回报数据库 schema 版本、数据目录可写性与剩余空间、存储用量、被引用文件的数量/缺失/哈希不符、GC 试运行结果、在途导出和上传，以及各表行数。以下情况退出码非零：schema 不是 1、数据目录不可写、剩余空间低于 512 MiB（可用 `-min-free-mib` 调整）、任一被引用文件缺失或哈希不符。`-verify-files=false` 可跳过逐文件哈希。

网关、核心服务和导出 worker 在启动时也会检查数据目录：不可写直接退出，剩余空间低于 512 MiB 只记录警告，不阻止启动。上线前应先运行 `check`。

## 清理

```sh
go run ./server/cmd/maintenance gc              # 试运行
go run ./server/cmd/maintenance gc -apply      # 真正删除
```

`gc` 只删除同时满足“已到期”和“无引用”的文件：

- `staged_uploads` 中 `staged`/`claimed` 状态且过期超过 24 小时（`-grace` 可调整）的上传，先删文件再删行。
- `export_jobs.expires_at` 已到的导出结果和预览（完成后 7 天），删除文件并清空 `result_key`、`preview_key`、`result_size` 与对应的导出引用。
- 数据目录中未被 `asset_versions`、有效上传、未过期导出引用的文件，且修改时间早于 24 小时才删除；`tmp`、`.work` 和维护锁文件不动。

软删除作品保留 30 天，期间其资源文件始终被视为被引用，不会被清理；作品恢复接口在 30 天内可用，超过后返回 `NOT_FOUND`。GC 与在途上传、导出和仍可恢复的作品兼容，不要用 `find`/`rm` 直接清理数据目录。

## 备份

```sh
go run ./server/cmd/maintenance backup
go run ./server/cmd/maintenance backup -dest /Volumes/backup/fastposter-20261030
```

默认写入 `var/backups/fastposter-<UTC 时间戳>`，目标目录必须不存在且不能位于 `APP_DATA_DIR` 内。流程：

1. 在数据目录获取排他锁并写入 `.fastposter-maintenance` 门禁文件；网关对非 GET 请求返回 503 `MAINTENANCE`，导出 worker 停止领取新任务，已在执行的任务继续完成。
2. 等待在途导出租约和 `staged`/`claimed` 上传结束（默认最多 3 分钟，`-wait` 调整；暂停后默认再等 5 秒让请求落地）。
3. 用 `mysqldump --single-transaction` 导出业务库，只导出该库。
4. 复制 `APP_DATA_DIR` 中除 `tmp`、`.work`、门禁文件外的常规文件；遇到符号链接直接拒绝。
5. 写入 `manifest.json`（格式版本、schema 版本、dump 大小与 SHA-256、文件数量/字节数、各表行数），同步落盘后原子重命名为最终目录。失败会清理 `.partial`，不会留下看似完整的备份。

门禁文件记录 PID 和开始时间：进程崩溃后其他进程可通过 PID 是否存活判断并解除暂停；锁由操作系统在进程退出时释放。备份结束（成功或失败）都会移除门禁文件。

备份不是时间点快照：暂停写入门禁只覆盖本机共享同一 `APP_DATA_DIR` 的进程，备份期间仍应避免绕过应用直接改数据库或文件。导出结果只需 7 天，历史导出文件会随时间减少；需要长期留存的成品请在客户端下载保存。

## 恢复到独立实例

恢复必须写入一个独立的数据库和数据目录，用于演练、迁移或替换损坏实例：

```sh
go run ./server/cmd/maintenance restore \
  -source var/backups/fastposter-20261030 \
  -dsn 'user:pass@tcp(127.0.0.1:3306)/fastposter_restore?parseTime=true&loc=UTC' \
  -data-dir /path/to/restored-data
```

行为与保护：

- 校验 `manifest.json` 的格式、版本、schema，以及 `mysql.sql` 的大小和 SHA-256。
- 目标库名只允许字母、数字和下划线，拒绝 `mysql`、`information_schema`、`performance_schema`、`sys`；只向目标库导入，绝不执行 `DROP DATABASE`，其他数据库不受影响。
- 目标库不存在时自动创建；已存在且非空时要求 `-force`；目标数据目录非空时同样要求 `-force`。`-force` 前应先保留安全副本。
- 目标与当前配置的正式数据库或 `APP_DATA_DIR` 相同时拒绝执行，除非显式传入 `-allow-live`；正式实例恢复前应停止网关、核心服务和 worker。
- 导入后核对 schema 版本、每张表的行数、数据文件数量和总字节数，并用 `-verify-files`（默认开启）重新哈希所有被引用的资源文件。任何一项不符都会报错。

恢复完成不会自动切换线上配置。确认独立实例可用后，再停止旧实例、将 `MYSQL_DSN` 与 `APP_DATA_DIR` 指向恢复实例并重启。

## 恢复演练

仓库的集成测试覆盖完整流程：创建作品、上传背景、完成导出，执行 `backup`，恢复到独立数据库和数据目录，验证作品 JSON 一致、文件哈希一致、其他用户无法读取私有资源、导出结果仍可读取并可重新发起导出，最后对恢复实例运行 `check`。运行：

```sh
python3 tools/test-integration.py --all-server -run TestRecovery -v
```

`TestRestartUsesSameAbsoluteDataDir` 验证相对 `APP_DATA_DIR` 在重启后解析到同一绝对目录，避免误读空数据目录。

限制：这是逻辑备份而非 MySQL 二进制日志的时间点恢复；备份目录本身需要另行复制到异机并限制权限；备份包含用户密码散列和私有作品文件，应按敏感数据处理，不得提交到仓库或公开网络。
