# 本机导出验证

2026-10-30，实际 MySQL + FileStore + Chrome 工作进程验证。

- MySQL 持久队列，每用户最多一个运行中和两个排队任务；幂等请求不重复创建。
- 30 秒租约，每 10 秒续约；单次处理最多 120 秒，崩溃恢复最多两次领取。旧 token 无法续约、发布或改写新尝试的结果。
- 实际构建并启动 worker，在任务运行时中断，保留可恢复租约；测试使租约到期后启动第二个 worker，任务以第 2 次尝试成功。超时/租约条件另以传入时间覆盖。
- 任务冻结作品 revision、素材版本/散列与渲染版本。之后编辑不改变本次结果。
- 实际渲染 1200×1600 原尺寸 PNG；未覆盖区域像素保持标准化背景数值。沿用原渲染容量检查，8192×4800 / 4800×8192 完整合成通过。
- ENOSPC、文字溢出和字体丢失均产生明确失败状态，不标成功。
- 浏览器导出会先 flush；最终预览与 API 下载、浏览器下载的 SHA256 一致。最终预览使用完整 ResultKey，由 CSS 缩放显示；列表缩略图独立生成。
- 私有授权读取，结果完成后保留 7 天。尝试文件每次使用不同 key，租约失效的旧进程不删除已发布结果；未引用文件由 GC 延迟回收。

`pnpm dev` 启动前构建内部 renderer；独立 worker 使用 `go run ./server/cmd/export-worker`。各进程须共享绝对路径 `APP_DATA_DIR`，MySQL 为任务权威，Redis 不参与队列持久化。

运行实际验证：

```sh
FASTPOSTER_RENDER_TEST=1 python3 tools/test-integration.py -run TestExport -count=1 -v
pnpm exec playwright test tests/e2e/export.spec.ts
```

原图是导入后标准化的 sRGB RGBA8 背景；图片编码与合成无有损压缩。真机手机保存图片流程仍待人工验收，见 mobile-editor.md。
