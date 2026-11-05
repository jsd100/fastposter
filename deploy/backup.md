# 维护、备份与恢复

本项目原生运行在单台主机上，数据库在 MySQL，私有文件在 `APP_DATA_DIR`。备份必须同时覆盖两者，单独备份其中一项无法恢复完整作品。

维护命令都从仓库根执行，并读取 `.env.local` 或环境变量中的 `MYSQL_DSN`、`APP_DATA_DIR`；凭据只通过 `MYSQL_PWD` 传给 `mysqldump`/`mysql` 子进程，不写入命令行或备份目录。需要 `mysqldump` 和 `mysql` 在 `PATH` 中。

## 检查

```sh
go run ./server/cmd/maintenance check
```

默认命令，只读，不删除任何内容。它回报数据库 schema 版本、数据目录可写性与剩余空间、存储用量、被引用文件的数量/缺失/哈希不符、GC 试运行结果、在途导出和上传，以及各表行数。以下情况退出码非零：schema 不是 2、数据目录不可写、剩余空间低于 512 MiB（可用 `-min-free-mib` 调整）、任一被引用文件缺失或哈希不符。`-verify-files=false` 可跳过逐文件哈希。

网关、核心服务、导出 worker 和清理 worker 在启动时也会检查数据目录：不可写直接退出，剩余空间低于 512 MiB 只记录警告，不阻止启动。上线前应先运行 `check`。

## 清理

```sh
go run ./server/cmd/maintenance gc              # 试运行
go run ./server/cmd/maintenance gc -apply      # 真正删除
```

`gc -apply` 先进入维护模式并取得独占写锁，等待在途请求和导出结束（`-wait`，默认 3 分钟），然后依次：

- 清理 `staged_uploads` 中 `staged`/`claimed` 状态且过期超过 24 小时（`-grace` 可调整）的上传，先删文件再删行。
- 清理 `export_jobs.expires_at` 已到的导出结果和预览（完成后 7 天），删除文件并清空 `result_key`、`preview_key`、`result_size` 与对应的导出引用。
- 永久删除软删除超过 30 天的作品：先删其导出任务与 `project`/`project-history`/`export` 引用，再删作品行（历史版本级联删除）。
- 永久删除软删除超过 30 天的文案/分类资源及其版本，并删除对应的 `resource`/`resource-version` 引用。
- 回收超过 `-grace`（默认 24 小时）且不再被任何 `asset_refs` 或 `resource_versions` 引用的素材版本，同时删除素材行和原图、标准化图、预览图。
- 最后扫描数据目录，删除未被有效上传、未过期导出或仍被引用的素材版本占用、且修改时间早于 24 小时的文件；`tmp`、`.work` 和维护锁文件不动。

软删除作品和资源保留 30 天，期间其文件始终被视为被引用；超过后由下一次 `gc -apply` 永久清除，恢复接口也返回 `NOT_FOUND`。试运行（不带 `-apply`）不进入维护模式、不加锁、不修改数据库或文件，只报告将回收的数量。不要用 `find`/`rm` 直接清理数据目录。

## 彻底删除清理 worker

用户在回收站确认彻底删除、或管理员执行永久删除后，接口只会在一个事务中删除作品行、导出任务和引用，并写入 `project_deletions` 任务及逐文件清单；文件由独立的清理 worker 异步删除。

```sh
go run ./server/cmd/cleanup-worker
```

- 每次执行领取一个到期任务并持有写入门禁的共享锁；维护模式或备份取得排他锁时停止领取，正在执行的删除会先完成。退出信号会在当前任务处理完后释放租约。
- 文件删除前会再次检查是否仍被素材版本、导出任务或暂存上传引用；仍被引用的文件标记为保留，不删除共享素材。
- 失败会记录 `safe_error_code` 与 `internal_error`，按 5 秒起、倍增、最长 5 分钟退避重试，不会放弃任务。日志中的重复失败通常意味着目录不可写、磁盘故障或权限错误；修复后无需手工改表，worker 会自动继续。
- 进程崩溃或租约过期后，另一个 worker 会接管同一任务；已删除但未确认的文件在重试时按不存在处理，不会卡住任务。
- worker 启动时校验 schema 版本，因此升级或回滚迁移前必须先停止它。

## 备份

```sh
go run ./server/cmd/maintenance backup
go run ./server/cmd/maintenance backup -dest /Volumes/backup/fastposter-20261030
```

默认写入 `var/backups/fastposter-<UTC 时间戳>`，目标目录必须不存在且不能位于 `APP_DATA_DIR` 内。流程：

1. 在数据目录获取排他锁并写入 `.fastposter-maintenance` 门禁文件；网关对非 GET 请求返回 503 `MAINTENANCE`，导出 worker 和清理 worker 停止领取新任务。
2. 通过 `.fastposter-writers.lock` 的共享/排他锁等待所有在途写入结束：每个已放行的网关写请求和导出任务持共享锁，备份写入门禁后申请排他锁，默认最多等待 3 分钟（`-wait` 调整）。排他锁由备份进程一直持有到复制结束，因此不会有请求越过门禁写进来。
3. 用 `mysqldump --single-transaction` 导出业务库，只导出该库。
4. 复制 `APP_DATA_DIR` 中除 `tmp`、`.work`、门禁与写锁文件外的常规文件；遇到符号链接直接拒绝。
5. 写入 `manifest.json`（格式版本、schema 版本、dump 大小与 SHA-256、文件数量/字节数、各表行数），同步落盘后原子重命名为最终目录。失败会清理 `.partial`，不会留下看似完整的备份。

备份包含 schema 2 的 `project_deletions`、`project_deletion_assets`、`project_deletion_files` 三张表，因此未完成的彻底删除任务（含逐文件工作清单）会随数据库一起恢复，恢复后的清理进程可以接管过期租约继续执行。new binary 只接受 schema 2 的备份；schema 1 的旧备份必须用生成它的旧版本二进制恢复，再运行 `go run ./server/cmd/migrate -direction up` 升级到 schema 2，不能直接导入新实例，否则会丢失删除任务。

门禁文件记录 PID 和开始时间：进程崩溃后其他进程可通过 PID 是否存活判断并解除暂停；两把锁由操作系统在进程退出时释放。备份结束（成功或失败）都会移除门禁文件。

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
- 目标与当前配置的正式数据库或 `APP_DATA_DIR` 相同时拒绝执行，除非显式传入 `-allow-live`；正式实例恢复前应停止网关、核心服务和两个 worker。
- 文件先复制到目标同级的 staging 目录并核对数量/总字节数，此时目标数据库与数据目录都未被修改；只有 staging 完整后才会导入数据库。
- 导入后核对 schema 版本、每张表的行数，并用 `-verify-files`（默认开启）针对 staging 重新哈希所有被引用的资源文件。全部通过后才把原数据目录移开、将 staging 原子重命名到目标位置；重命名失败会自动恢复原目录。任何一项不符都会报错，目标目录保持原样。

恢复完成不会自动切换线上配置。确认独立实例可用后，再停止旧实例、将 `MYSQL_DSN` 与 `APP_DATA_DIR` 指向恢复实例并重启。

## 恢复演练

仓库的集成测试覆盖完整流程：创建作品、上传背景、完成导出，执行 `backup`，恢复到独立数据库和数据目录，验证作品 JSON 一致、文件哈希一致、其他用户无法读取私有资源、导出结果仍可读取并可重新发起导出，最后对恢复实例运行 `check`。测试还会拒绝 schema 版本高于当前二进制的备份，并在恢复实例上运行清理 worker，确认随备份恢复的未完成任务继续执行、删除其私有文件，同时保留仍被引用的素材。运行：

```sh
python3 tools/test-integration.py --all-server -run TestRecovery -v
```

`TestRestartUsesSameAbsoluteDataDir` 验证相对 `APP_DATA_DIR` 在重启后解析到同一绝对目录，避免误读空数据目录。

限制：这是逻辑备份而非 MySQL 二进制日志的时间点恢复；备份目录本身需要另行复制到异机并限制权限；备份包含用户密码散列和私有作品文件，应按敏感数据处理，不得提交到仓库或公开网络。
