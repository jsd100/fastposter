# FastPoster 全流程验收

日期：2026-10-30。环境版本和数据库边界见 [local-environment.md](local-environment.md)。本记录只列实际执行的检查；未执行项和人工缺口在末尾明确列出。

## 执行结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 契约与前端闸门 | `pnpm verify` | 通过。Thrift 重新生成后文件集合与 SHA-256 无漂移；TypeScript typecheck、Vitest 单元测试、8 个 workspace 构建全部通过 |
| Go 单元/适配 | `pnpm test:server`（`go test ./server/... ./tools/...`） | 通过；未设置测试 DSN 时真实数据库用例按设计跳过 |
| 真实 MySQL 集成 | `python3 tools/test-integration.py --all-server` | 通过，10.323 秒。使用独立随机 `fastposter_test_*` schema，覆盖存储、作品、导出、模板、恢复和维护 |
| 浏览器端到端 | `pnpm test:e2e` | 18 个 Playwright 用例全部通过，1.4 分钟。临时 schema、真实服务、Chrome 和 Vite 前端，不接触业务库 |
| 渲染容量 | `FASTPOSTER_RENDER_TEST=1 FASTPOSTER_CAPACITY_TEST=1 go test ./server/tests/integration -run TestRender -count=1 -v` | 通过，批次 8.316 秒；8192×4800 约 1.61 秒，4800×8192 约 1.56 秒 |
| 本机环境 | `go run ./tools/doctor -check all` | config、MySQL、Redis、Chrome、ImageMagick 全部可用 |
| 独立实例恢复 | 集成用例 `TestRecoveryRestoresDatabaseFilesAndPrivateAccess` | 通过：备份→恢复到独立库/目录→校验作品、哈希、私有权限、导出和 `check`，哨兵库未被改动 |

`pnpm verify` 的契约检查由 `tools/check-generated.sh` 完成：先在临时快照记录 `server/gen/**`、路由文件和 TypeScript DTO 的 SHA-256，随后运行 `go run ./tools/contractgen`，再比较文件集合和内容。生成文件没有手工修改。

## 全流程覆盖

`tests/e2e/full-flow.spec.ts` 的三条用例分别执行：

1. **原生编辑与下载**：注册→本机图片导入→文字编辑并使用 Inter + 思源黑体混合字体→拖动右侧把手调宽→自动保存→新浏览器会话登录恢复→最终预览与“下载原尺寸 PNG”。断言新会话保留字体标记和坐标，PNG 为 1200×1600，预览、API 响应和浏览器下载三者 SHA-256 一致。
2. **公共资源生命周期**：管理员发布共享背景→用户选用并保存→管理员下架→用户刷新后背景仍可读取→导出成功→普通用户访问管理接口返回 403。
3. **断网不丢数据**：拦截作品 PUT 后显示“离线 · 草稿已保留”→恢复网络并刷新→出现本地草稿选择→恢复后宽度保留并重新保存。

过期租约注入由 Go 集成用例覆盖，不通过浏览器伪造数据库：

- `TestExportStaleLeaseCannotPublishOrDeleteNewResult`：旧 token 不能发布或删除新结果。
- `TestExportRenewAcceptsUnchangedValidLeaseAndRejectsExpired`：过期租约不能续约。
- `TestExportCrashRecoveryAndMaxAttempts`：进程中断后新 worker 重新领取，超过次数显式失败。
- `TestExportPrivateDownloadAndSevenDayExpiry`：私有下载和 7 天到期。
- `TestExportSnapshotUnaffectedByLaterEdit`：导出快照不被后续编辑改变。

作品保存与草稿另有 Playwright 冲突/离线/重开用例；后端 revision 与引用在同一事务回滚（`TestProjectRevisionAndReferencesRollbackTogether`），不会出现保存成功但引用丢失的静默状态。

## 其他已确认项

- 全仓库未发现演示路由或模拟数据返回；测试通过真实领域服务、Hertz/Kitex 传输和 MySQL 运行。渲染 fixture 和容量测试入口保留。
- 不依赖 Postgres、S3/MinIO、Docker 或云对象存储；`go.mod`、依赖和部署说明中没有对应占位凭据。
- 管理员资源下架不删除版本文件，旧作品继续引用明确版本；管理作品接口不返回正文或私有文件。
- 软删除作品/资源 30 天内可恢复；导出结果 7 天；`gc -apply` 暂停写入后清除超过 30 天的软删除数据，回收无 `asset_refs`/`resource_versions` 引用的素材版本及文件；备份恢复不会触碰其他数据库。详见 [backup.md](../../deploy/backup.md)。
- 生成器版本锁定在 `deploy/toolchain.lock.json`，生成命令 `pnpm contracts:generate`，检查命令 `pnpm contracts:check`。

## 未执行 / 人工缺口

- **真实 iOS Safari 和 Android Chrome 未人工验收**：输入法候选、系统选词、软键盘安全区、双指与输入切换、手机保存图片仍未确认。自动化只覆盖 Chrome 360×800 触摸模式，见 [mobile.md](mobile.md)。
- **未部署到公网**：没有配置 HTTPS、反向代理、防火墙或生产证书，也没有自动部署脚本。
- **未在第二台物理主机演练恢复**：恢复流程在独立数据库和数据目录上自动验证，但没有跨机复制备份包后的实机演练。
- **MySQL 版本为 26.7.0**：满足 8.0+ 语法兼容检查，但未逐一测试所有 MySQL 8 小版本。

## 剩余限制

- 单机原生架构，文件存储与导出 worker 不跨主机共享；横向扩展需要另设计共享存储和队列协调。
- 备份是逻辑导出 + 文件复制，不是二进制日志时间点恢复；备份包含密码散列和私有作品，必须按敏感数据保管。
- 导出 worker 并发 1，大尺寸渲染时其他任务排队；当前容量数据是单进程实测，不是多 worker 峰值承诺。
