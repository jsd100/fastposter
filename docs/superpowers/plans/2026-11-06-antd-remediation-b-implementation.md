# FastPoster Ant Design Remediation B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止后台资源保存、发布或分类移动覆盖并发写入，并使分类内容编辑和移动同成同败。

**Architecture:** 沿用 `resources.current_version` 与 `resource_versions` 作为冲突标识和历史版本。先让现有更新都受版本保护，再把列表发布动作改成服务端基于当前快照的独立意图。管理站为过期快照保留输入、显示冲突并要求重新确认。

**Tech Stack:** Go、MySQL、Thrift、Kitex/Hertz、生成的 TypeScript API client、React、Playwright。

**Spec:** [迁移后修正规范 FP-11](../specs/2026-11-06-antd-post-migration-remediation-design.md#fp-11-后台资源写入边界b-批) · [A 批计划及全局验证入口](2026-11-06-antd-remediation-a-implementation.md)

## 授权、基线和接续

当前为 `PLANNED`。只有用户明确授权 B 批实施才能修改 IDL 和业务代码。批准 spec 或 A 批开工均不授权 B 批。B 批可在 A 批之前或之后单独实施。若 A 批尚未合入，从用户指定 HEAD 开始。两批涉及相同后台文件时按顺序集成。保留实际工作树、用户改动和生成文件，使用 [A 批执行记录格式](2026-11-06-antd-remediation-a-implementation.md#授权和接续)，在同一个 `docs/verification/2026-11-06-antd-remediation.md` 中单列 B。开工时若记录尚不存在，在 B01 创建。

## Global Constraints

- 适用 FP-11 至 FP-14 及原规范中的身份、引用和 renderer 边界。资源 ID、公开目录契约、文档格式、管理员权限、现有删除与回收策略照原规则。复用现有版本模型，不新增迁移或依赖。
- 修改契约从 `idl` 开始，运行 `pnpm contracts:generate`，同时审查生成的路由、`server/gen` 和 `packages/api-client/src/generated.ts`。不得手写生成产物。现有字段编号保留。
- 并发前提为正整数规范十进制字符串，避免 JavaScript number 丢失精度。已有资源更新缺字段、空值或格式非法返回 `INVALID_INPUT`，缺字段提示刷新旧页面。合法但过期返回 `REVISION_CONFLICT` / HTTP 409。未授权先按既有错误返回，不泄露当前版本。保存、移动、发布前提都在事务锁内核对。
- 创建无历史前提，既有资源编辑表单可原子保存内容和发布复选框。列表/卡片快捷发布最终只发送发布意图。重复点击和迟到响应只作用于同一管理员、目标和操作。保留错误和原始草稿。
- 成功写入对外暴露一致的版本、引用与结果。锁、校验、行更新、新版本行、依赖引用和审计同一事务。现有资源不可见或被删除时沿用服务端权限校验，过期和失败没有成功审计或部分写入。
- Go 测试只使用 `python3 tools/test-integration.py` 和独立 `fastposter_test_*`。测试需实际触发 MySQL 断言，`[no tests to run]` 或 `SKIP` 单列。Playwright 预构建 renderer 后逐 spec 起新测试栈。最终运行 `pnpm verify`、`git diff --check`，按 `AGENTS.md` 定向格式化。
- 各任务单独提交。涉及服务、网关、静态 admin 前端及生成客户端的 B 批发布作为一个兼容单元，开发中间提交不得单独部署。若 Git 写入受限，记录真实验证基线和未提交 diff。

## Review Focus

1. 两次写入读到同一版本时，竞争结束后只有一次写入和一条成功审计。B01。
2. 分类换父级后子树将超过 5 层，即便新标题有效也应整体回滚。B01。
3. 旧前端漏发版本，必须安全失败。普通用户即使持有版本也不能写。B01、B02。
4. 正在发布的模板含外部字体和背景，发布应保留准确的资产版本与引用。B02。
5. 过期但目标已相同的发布也应报冲突。管理员明确重载并重新确认后才可重试。B02。

---

## 文件边界与顺序

| 任务 | 目标                                                 | 前置         |
| ---- | ---------------------------------------------------- | ------------ |
| B01  | 已有资源保存和分类移动并发保护，分类表单一次原子请求 | B 批明确授权 |
| B02  | 独立发布意图、资源引用继承和冲突恢复                 | B01          |
| B03  | 验证、部署兼容、回滚和交付记录                       | B01、B02     |

### B01 使保存和分类移动共享版本前提

**文件**：`idl/common/requests.thrift`、`idl/http/admin.thrift`，再重新生成。修改 `server/internal/catalog/{service.go,category_tree.go}`、`server/internal/copy/service.go`、`server/internal/transport/{catalog_adapter,dispatch}.go`。同步 `apps/admin/src/features/{Resources.tsx,templates/TemplateList.tsx,templates/TemplateEditor.tsx,copy/CopyPage.tsx,copy/CopyForm.tsx}`。测试用 `server/internal/copy/service_test.go`、`server/tests/integration/{catalog_test,catalog_http_test,templates_test}.go`、`tests/e2e/{admin-catalog,copy,templates}.spec.ts`。

**接口**：`ResourceInput` 追加字段 15 `optional string expectedVersion (api.body="expectedVersion")`，`MoveResourceInput` 追加字段 3 同名同类型字段。可选 wire 字段保留 Thrift 兼容读写，已有资源更新要求其存在。Go `catalog.ResourceInput.ExpectedVersion string`。目录统一的移动服务签名为 `MoveCategory(ctx context.Context, p auth.Principal, id, parentID, expectedVersion string) error`，原 copy 服务方法委托给目录服务。保留现有 move HTTP 路径和 EmptyReply。新增管理员详情 `AdminGetResource`，`GET /api/v1/admin/resources/:id/detail`，用 `IDRequest` 和 `ResourceReply`。复用 `CatalogCall.id` 及 `Service.Get(ctx, p, id, true)`，仅用于按 ID 安全重载当前版本。不存在或已删除映射到现有 NOT_FOUND。B01 的快捷发布仍使用现有保存路由，但同时携带同一快照的版本，B02 将换成仅发送状态。

- [ ] **B01.1** 核对实际基线、保护 DSN、IDL 生成工具与两个站点构建，建立执行记录。用 `rg -n 'AdminSaveResource|AdminMoveResource|\.MoveCategory\(|catalog.ResourceInput\{' apps server idl` 记录所有调用者，标出创建、已有资源写入和内部 copy 发布包装。
- [ ] **B01.2** 先写 `TestCatalogSaveVersionRejectsConcurrentOverwrite`、`TestCatalogCategoryEditRollsBackParentAndFields`、`TestCatalogMoveVersionAndDepth`、`TestCatalogHTTPRejectsUnversionedAndNonAdminMutation`。两个 goroutine 读取同一版本并发保存，断言仅一次成功、另一次冲突，`current_version == old + 1` 且成功审计一次。测试分类字段和父级一起成功，以及空标题、循环、移入另一类型、子树越过五层的失败均没有版本、字段或树变化。已有 HTTP 路径发送旧 payload 应拒绝，普通账号先拒权。管理员详情 GET 以 ID 读取实际最新版本，不受原分页、分类、旧标题影响。
- [ ] **B01.3** 按接口加 IDL 并生成，运行 `pnpm contracts:generate`。运行 `python3 tools/test-integration.py -run 'TestCatalog(SaveVersion|CategoryEdit|MoveVersion|HTTPRejects)' -count=1 -v`。缺服务前提时先编译通过，并确认红灯是版本/分类行为缺失，避免把工具错误当成功复现。
- [ ] **B01.4** 在 `Service.Save` 增加现有资源的锁内比较和更新。复用目录的树加载和整棵子树校验，单个事务写父级、内容、发布状态、版本行、引用和审计。分类编辑与独立移动走同一树校验和锁顺序。对同类分类先取得稳定树锁再取目标行，核查与删除的锁次序，保留删除规则。独立移动在保留其他字段的前提下增加版本，旧版可读。
- [ ] **B01.5** 对管理站每个已存在资源的完整保存和仍存的发布调用传入同一资源快照的版本，创建请求无版本要求。分类表单移除先 move 再 save 的两请求链路。接通管理员详情路由。版本冲突时保留编辑值和已上传的素材引用，按 ID 重载并显示最新资源，提示明确确认后才重新提交。被删除或失权时终止重试。无版本旧页面返回可理解的刷新提示。更新已有测试和内部调用方传版本，覆盖模板包导入继续创建。
- [ ] **B01.6** 复跑 B01 的 MySQL 定向测试、`python3 tools/test-integration.py --all-server -run 'TestRejectCyclesAndDepthSix|TestUnpublishedCopyHidden|TestCatalog' -count=1 -v` 与 `pnpm contracts:check && pnpm typecheck`。逐 spec 核对分类改名加移动只发送一次保存，保持后台表单发布行为。提交 `fix(catalog): enforce versions on resource and category writes`。

### B02 独立发布意图并保留版本引用

**文件**：`idl/common/{requests,calls}.thrift`、`idl/http/admin.thrift` 及生成文件。修改 `server/internal/catalog/service.go`，发布逻辑可放在同包 `publication.go`。修改 `server/internal/copy/service.go`、`server/internal/transport/{catalog_adapter,dispatch}.go`、`apps/admin/src/features/{Resources.tsx,templates/TemplateList.tsx,copy/CopyPage.tsx}`。测试用 `server/tests/integration/{catalog_test,catalog_http_test,templates_test}.go`、`tests/e2e/{admin-catalog,templates,copy}.spec.ts`。

**接口**：新增 `PublishResourceInput`，字段 1 `required string id (api.path="id")`，字段 2 `optional bool published (api.body="published")`，以指针区分缺字段和 `false`，dispatch 必须拒绝缺字段，字段 3 `required string expectedVersion (api.body="expectedVersion")`。为 `CatalogCall` 加字段 8 `optional requests.PublishResourceInput publication`。新增 `AdminPublishResource`，`POST /api/v1/admin/resources/:id/publication`，返回 `ResourceReply`。Go `(*catalog.Service).SetPublished(ctx context.Context, p auth.Principal, id string, published bool, expectedVersion string) (Resource, error)`。保留 B01 中表单保存复选框。

- [ ] **B02.1** 写 `TestCatalogPublicationPreservesVersionContentAndRefs`、`TestCatalogPublicationRejectsStaleEvenForSameState`、`TestCatalogPublicationHTTPContract`，以及 E2E `stale publication preserves newer resource and requires confirmation`。断言发布请求 body 只有 `published` 和 `expectedVersion`，旧快照 409 后服务端新文档保持，需重载再确认。模板、背景、字体、文案各核对版本内容和准确的资产依赖。测试合法版本且状态相同无新版本或成功审计。HTTP 层应接受明确 `published: false`，缺字段或 null 返回 400 且无写入。
- [ ] **B02.2** 加 IDL 与生成产物，运行生成和 `python3 tools/test-integration.py -run 'TestCatalogPublication' -count=1 -v`，确认新操作缺少行为或旧全量 payload 导致失败。
- [ ] **B02.3** 接通 gateway、Catalog adapter 和服务端发布操作，归入管理员路径。锁内比较版本后，从**同一个已锁资源的当前版本行**复制 title 等未变元数据、资产版本、内容和依赖。按稳定顺序锁定必要资产版本，保留资源引用并复制 resource-version 专属依赖给新版本。若写入受阻整体回滚。发布动作只能改变状态和相应版本/审计，服务端不使用客户端内容快照。保存和发布的响应版本从本次事务快照取得，避免提交后再读到另一个并发写入产生的版本。
- [ ] **B02.4** 管理站快捷发布改用新路由。过期时显示冲突和最新状态，完成重载并由管理员明确确认后再发。复用 B01 的版本和冲突处理方式，保留表单内保存发布状态。内部 copy 发布包装改委托 `SetPublished`，继续限定 copy 类型并保持鉴权。
- [ ] **B02.5** 复跑 B02 MySQL 测试、`TestCatalogUnpublishKeepsReferencedVersionReadable`、`TestTemplateApplyCreatesIndependentPrivateProject` 与相应 E2E。验证普通用户不能发布，已引用背景下架后仍可用，过期应用模板维持原行为，发布版本与依赖一致。提交 `feat(catalog): publish resources with versioned intent`。

### B03 验收并记录升级和回滚条件

**文件**：`AGENTS.md`、`README.md`、`docs/verification/2026-11-06-antd-remediation.md`。B 批独立交付时补全项目当前 antd 工具链说明，涉及版本的记录用 `deploy/toolchain.lock.json`。保持同一份验收入口。

**接口**：现有数据和版本行向前兼容。交付单元包含同一代码版本的核心服务、网关、管理站和生成客户端。启动更新前确认旧写入无法继续通过旧实例，重新打开管理员工作台以获取新前端。B 批执行完成不代表自动部署。

- [ ] **B03.1** 更新维护文档，说明管理员详情和发布路由、缺版本的旧客户端如何刷新、冲突如何恢复、适用批次及验证环境。写清没有 schema 迁移，审核部署必须按同一版本切换网关、核心与管理站。若独立前端或旧服务不能同步切换，禁止开放管理写入直到整组就绪。
- [ ] **B03.2** 记录回滚规则。先停止管理写入，整组回退，核对当前资源版本与资产引用再恢复写入。回退旧服务会失去本批并发保护，记录风险及是否需要继续保持写入冻结。回滚不修改已提交的资源版本或删除数据。
- [ ] **B03.3** 运行下方最终门槛。记录实际用例、跳过项和原因。按 A 批 A10 命令执行 renderer、入口边界和固定导出样本检查，若当前 A 批未执行，按实际产品基线记录。
- [ ] **B03.4** 对照 FP-11/12/13/14，核查代码、Thrift 生成、审计、API 与后台实际调用均匹配；确认工作树包含规范及验收入口。只在证据充分时标 VERIFIED，提交 `docs: record catalog write compatibility and verification`。

```bash
set -euo pipefail
pnpm verify
go test ./internal/...
pnpm test:server
python3 tools/test-integration.py --all-server -count=1 -v
python3 tools/test-integration.py -count=1 -v
pnpm --filter @fastposter/renderer build
for suite in admin-catalog templates copy; do
  pnpm test:e2e "tests/e2e/$suite.spec.ts"
done
git diff --check
```
