# FastPoster antd 迁移验证记录

> 计划：`docs/superpowers/plans/2026-11-05-antd-frontend-migration.md`。执行账本：`.superpowers/sdd/2026-11-05-antd-frontend-migration/progress.md`（本文件只汇总可复核证据）。

```yaml
status: IN_PROGRESS
authorization: "2026-11-05 用户：请你深度分析该需求和相关文档裁量，然后继续该任务"
execution_mode: native
workspace: "/Users/aaa/acode/FastPoster"
branch: "feat/fastposter"
base_commit: "d6c3d45"
last_verified_commit: "c0e769d"
current_task: T05
next_step: T05.1
requirements: [UI-07, UI-08]
changed_paths:
  - "packages/ui/src/NumberField.tsx"
  - "packages/ui/src/NumberField.module.css"
  - "packages/ui/src/number-draft.ts"
  - "packages/ui/src/number-draft.test.ts"
  - "packages/ui/src/styling-hook.test.ts"
  - "tests/e2e/ui-controls.spec.ts"
  - "tests/e2e/editor-settings.spec.ts"
decisions:
  - "全程以执行账本记录任务级证据；计划复选框不勾选，避免与账本双写。"
  - "T03：antd 6 的模态滚动锁是注入的 html body 规则而非内联样式，断言改读 computed overflow-y。"
  - "T03：antd Drawer 面板 .ant-drawer-section 设为 position: relative，让它成为浮层包含块与裁剪边界，字体菜单留在面板内。"
  - "T03：≤680px 工具栏改为横向滚动，消除 HEAD 上已存在的 371px 页面级溢出（已在 HEAD 复现）。"
  - "T04：编辑器数值控件采用 antd Input + 两个 Button，而非 InputNumber/spinner。触发条件：rc-input-number 1.8.0 的步进按钮固定英文名 Increase/Decrease Value，无法改成本字段可访问名；其输入解析与 changeOnBlur 会规范化 0.、-. 等原始草稿；onStep 不是按住开始/结束事务协议。"
  - "T04：styling-hook 用例从「类名完全相等」改为「包含共享 focus 类」，因为 antd Input 会附加自己的类；这是实现细节校正，不改变焦点钩子契约。"
red_check: "见各任务「中途红灯」"
checks:
  - "T03 pnpm exec vitest run packages/ui/src/modal-layer.test.ts packages/ui/src/notifications.test.ts packages/poster-editor/src/keyboard.test.ts → 20/20 PASS"
  - "T03 pnpm exec playwright test tests/e2e/ui-controls.spec.ts → 17/17 PASS"
  - "T03 pnpm exec playwright test tests/e2e/notifications.spec.ts tests/e2e/editor-mobile.spec.ts → 9/9 PASS"
  - "T03 pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts -g 'defaults to cancel' → 1/1 PASS（新临时栈）"
  - "T03 pnpm test → 145/145 PASS"
  - "T03 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
  - "T04 pnpm exec vitest run packages/ui/src → 68/68 PASS（含新增 stepNumber 4 例）"
  - "T04 pnpm exec playwright test tests/e2e/ui-controls.spec.ts → 17/17 PASS（新临时栈）"
  - "T04 pnpm exec playwright test tests/e2e/editor-settings.spec.ts → 4/4 PASS（新临时栈，含两次撤销边界）"
  - "T04 pnpm exec playwright test tests/e2e/editor-geometry.spec.ts tests/e2e/editor-mobile.spec.ts → 4/4 PASS"
  - "T04 pnpm exec playwright test tests/e2e/autosave.spec.ts tests/e2e/editor-richtext.spec.ts tests/e2e/full-flow.spec.ts → 11/11 PASS"
  - "T04 pnpm test → 149/149 PASS"
  - "T04 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
artifacts: []
blockers: []
```

## T01 建立可重复的浏览器基线

- commit `6bb9356`；开工 HEAD `d6c3d45`，分支 `feat/fastposter`。
- `pnpm exec playwright test tests/e2e/ui-baseline.spec.ts tests/e2e/export.spec.ts` → 4/4 PASS。
- `pnpm turbo build` → 8/8 PASS。
- 环境：Node 24.21.0、pnpm 11.25.0、Go 1.27.2、MySQL 26.7、Chrome、ImageMagick 7.1.2；`go run ./tools/doctor -check all` PASS。
- 裁定：旧的 ui-baseline Inter 点击断言按计划改为 `toBeDisabled`，属测试校正，不改产品行为。

## T02 主题与入口依赖

- commit `b21aef5`。
- `pnpm typecheck` → exit 0；`pnpm test` → 139/139 PASS；`pnpm build` → 8/8 PASS。
- `pnpm exec playwright test tests/e2e/ui-controls.spec.ts` → 17/17 PASS；`... tests/e2e/templates.spec.ts` → 2/2 PASS。
- 入口边界检查（`tools/check-entry-boundary.mjs`，web/admin/renderer）→ PASS；`assets/rolldown-runtime-*.js` 无 sourcemap 时按生成样板跳过，其余缺失即失败。
- 裁定：typecheck 固定从规范大小写 `/Users/aaa/acode/FastPoster` 执行；`@fastposter/api-client/browser` 单独导出浏览器 helper。

## T03 迁移弹层、快捷键桥接和通知

- 变更：`Dialog` 组合 antd `Modal`（`data-fp-overlay` 标记、宽度 CSS 变量、关闭按钮名「关闭」）；`BottomSheet` 组合底部 antd `Drawer`；新增 `modal-layer` 弹层注册与 `notice-layer` 稳定通知容器；通知改由 antd `message` 渲染，保留 `createNoticeStore` 的 id 去重、更新、时长与账号 generation；编辑器快捷键经 `hasActiveOverlay()` 兼容新旧标记；共享测试与验收用例同步更新。

### 验证

| 命令                                                                                                                    | 结果        |
| ----------------------------------------------------------------------------------------------------------------------- | ----------- |
| `pnpm exec vitest run packages/ui/src/modal-layer.test.ts packages/ui/src/notifications.test.ts packages/poster-editor/src/keyboard.test.ts` | 20/20 PASS  |
| `pnpm exec playwright test tests/e2e/ui-controls.spec.ts`                                                               | 17/17 PASS  |
| `pnpm exec playwright test tests/e2e/notifications.spec.ts tests/e2e/editor-mobile.spec.ts`                             | 9/9 PASS    |
| `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts -g 'defaults to cancel'`（新临时栈）            | 1/1 PASS    |
| `pnpm test`                                                                                                             | 145/145 PASS |
| `pnpm typecheck`                                                                                                        | exit 0      |

### 中途红灯与处理

- 三文件同跑时 26 个用例累计注册超过服务端 20 次/10 分钟的注册限流，后续用例停在 `/register`；改为按文件分批，每批使用新临时栈。
- 模板库内嵌 Select 的选项点击被 `.ant-modal-container` 子树拦截：antd 给 `.ant-modal` 设了 `pointer-events: none` 以放行遮罩点击，内嵌浮层继承后不可点。新增 `[data-fp-overlay] [data-fp-popup][data-open] { pointer-events: auto; }` 后通过。
- antd Drawer 有入场位移，移动端用例在动画首帧读取几何（面板 bottom=1320、菜单越出面板）；用例改为轮询稳定后的盒模型。
- Drawer 面板默认 `position: static`，浮层以 wrapper 为包含块并采用视口碰撞边界，字体菜单翻到面板上方；面板改为 `position: relative` 后菜单留在滚动面板内。
- 手机 360px 下工具栏把文档撑到 371px；临时还原 T03 文件在 HEAD `b21aef5` 复现同一数值，确认是既有失败。≤680px 命令栏改为 `overflow-x: auto` 后页面宽 360px，所有按钮仍可到达。

## T04 迁移数值输入并保留编辑事务

- 变更：`NumberField` 从 Base UI NumberField 改为 antd `Input` + 两个 antd `Button`；原始草稿、边界、Enter/Escape、全角与 Unicode 减号继续由 `classifyNumberDraft` 判定；`stepNumber` 承担步进、夹取和 12 位有效数字取整；按钮按住仍以一次 `onInteractionStart/End` 组成一个撤销项，pointerup/pointercancel/窗口失焦/卸载都会停止重复。`role=spinbutton`、`aria-valuemin/max/now` 与逐字段按钮名保留。
- 用例：未完成小数用例新增「Escape 回到 12、重新建立 0. 草稿」；长按用例新增两次撤销边界（长按回退到 65，再撤销单次点击回 64）。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm exec vitest run packages/ui/src` | 68/68 PASS（新增 `stepNumber` 4 例） |
| `pnpm exec playwright test tests/e2e/ui-controls.spec.ts` | 17/17 PASS（新临时栈） |
| `pnpm exec playwright test tests/e2e/editor-settings.spec.ts` | 4/4 PASS（新临时栈，含两次撤销边界） |
| `pnpm exec playwright test tests/e2e/editor-geometry.spec.ts tests/e2e/editor-mobile.spec.ts` | 4/4 PASS |
| `pnpm exec playwright test tests/e2e/autosave.spec.ts tests/e2e/editor-richtext.spec.ts tests/e2e/full-flow.spec.ts` | 11/11 PASS |
| `pnpm test` | 149/149 PASS |
| `pnpm typecheck` | exit 0 |

### 中途红灯与处理

- `InputNumber` 评估结论：`rc-input-number@1.8.0` 的 `StepHandler` 固定输出 `Increase Value`/`Decrease Value`，无法保留「增加文字字号」等逐字段可访问名；输入事件会即时解析、失焦按 `changeOnBlur` 整理显示，无法保留 `0.`/`-.` 原始草稿；`onStep` 只报告步进，不是按住事务协议。按 UI-08 的允许路径改用 `Input` + `Button`。
- 首次 E2E 中行高从 `1.4` 一步变成 `2.4`：步进按钮把方向 ±1 直接当增量，未乘 `step`（字号 step=1 掩盖了问题）。新增 `stepOnce` 后行高回到 `1.5`。
- `styling-hook` 的类名相等断言因 antd 附加 `ant-input` 等类失败；改为断言输入仍带共享 focus 类。
