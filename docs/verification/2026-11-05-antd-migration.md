# FastPoster antd 迁移验证记录

> 计划：`docs/superpowers/plans/2026-11-05-antd-frontend-migration.md`。执行账本：`.superpowers/sdd/2026-11-05-antd-frontend-migration/progress.md`（本文件只汇总可复核证据）。

```yaml
status: IN_PROGRESS
authorization: "2026-11-05 用户：请你深度分析该需求和相关文档裁量，然后继续该任务"
execution_mode: native
workspace: "/Users/aaa/acode/FastPoster"
branch: "feat/fastposter"
base_commit: "d6c3d45"
last_verified_commit: "e63952a"
current_task: T06
next_step: T06.1
requirements: [UI-07, UI-08, UI-10]
changed_paths:
  - "packages/ui/src/Select.tsx"
  - "packages/ui/src/Select.module.css"
  - "packages/ui/src/Combobox.tsx"
  - "packages/ui/src/Combobox.module.css"
  - "packages/ui/src/modal-layer.ts"
  - "packages/ui/src/BottomSheet.tsx"
  - "packages/poster-editor/src/panels/ColorField.tsx"
  - "packages/poster-editor/src/panels/ColorField.module.css"
  - "packages/poster-editor/src/panels/TextPanel.tsx"
  - "packages/poster-editor/src/panels/StylePanel.tsx"
  - "packages/poster-editor/src/keyboard.ts"
  - "packages/poster-editor/package.json"
  - "tests/e2e/helpers.ts"
  - "tests/e2e/ui-baseline.spec.ts"
decisions:
  - "全程以执行账本记录任务级证据；计划复选框不勾选，避免与账本双写。"
  - "T03：antd 6 的模态滚动锁是注入的 html body 规则而非内联样式，断言改读 computed overflow-y。"
  - "T03：antd Drawer 面板 .ant-drawer-section 设为 position: relative，让它成为浮层包含块与裁剪边界，字体菜单留在面板内。"
  - "T03：≤680px 工具栏改为横向滚动，消除 HEAD 上已存在的 371px 页面级溢出（已在 HEAD 复现）。"
  - "T04：编辑器数值控件采用 antd Input + 两个 Button，而非 InputNumber/spinner。触发条件：rc-input-number 1.8.0 的步进按钮固定英文名 Increase/Decrease Value，无法改成本字段可访问名；其输入解析与 changeOnBlur 会规范化 0.、-. 等原始草稿；onStep 不是按住开始/结束事务协议。"
  - "T04：styling-hook 用例从「类名完全相等」改为「包含共享 focus 类」，因为 antd Input 会附加自己的类；这是实现细节校正，不改变焦点钩子契约。"
  - "T05：Combobox 用 `virtual={false}`。触发条件：rc-select 的虚拟列表只为可见行赋值，44px 手机行高与「过滤后的选项都能滚到」的断言都要读到全部行；字体目录按作品作用域最多数十项。代价：字体目录若成长到数百项，菜单渲染会变慢，`antd lint` 的 performance 警告即此项。"
  - "T05：Combobox 的搜索词受控并在 `onOpenChange(false)` 清空。触发条件：rc-select 在 blur/Escape 后保留 searchValue，下次打开会被旧查询过滤。"
  - "T05：`ColorField` 以「打开=事务开始、关闭=事务结束」组成一次撤销项，Escape/遮罩/卸载都走同一条收尾路径。代价：面板内反复开合同一颜色会产生多个撤销项，与既有「一次交互一次撤销」一致。"
  - "T05：新增 `hasVisiblePopup()`（按 `getClientRects()` 过滤隐藏弹层）替代 `[data-fp-popup]` 存在性判断，因为 antd 关闭的下拉仍以 `display:none` 留在 DOM，否则快捷键会被永久屏蔽。"
  - "T05：`ui-baseline` 的截图冻结样式改为「截图期间存在、拍完移除」。原因：`animation:none!important` 常驻会让 antd 的 rc-motion 等不到 `animationend`，字体菜单停在 `opacity:0`/`0×0`。"
  - "T05：光标样式用例改为显式回到画布并轮询 caret 复位后再键入，不改产品代码。原因：`prosemirror-view@1.42.8` 的 focus 处理器用 `setTimeout(…, 20)` 延迟把 state 选区写回 DOM，紧接其后的自动键入会落在块首。"
  - "T05：`editor-richtext.spec.ts` 的 Prettier 警告保留：`git show HEAD:` 检查确认开工前该文件已不合规，只整理本次新增的 import，避免无关格式化。"
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
  - "T05 pnpm exec vitest run packages/poster-editor/src/fonts → 14/14 PASS"
  - "T05 pnpm exec playwright test tests/e2e/editor-fonts.spec.ts → 12/12 PASS（新临时栈）"
  - "T05 pnpm exec playwright test tests/e2e/editor-mobile.spec.ts → 3/3 PASS"
  - "T05 pnpm exec playwright test tests/e2e/ui-controls.spec.ts → 17/17 PASS（新临时栈）"
  - "T05 pnpm exec playwright test tests/e2e/editor-richtext.spec.ts tests/e2e/editor-mobile.spec.ts → 7/7 PASS"
  - "T05 FP_UI_BASELINE=1 pnpm exec playwright test tests/e2e/ui-baseline.spec.ts → 2/2 PASS"
  - "T05 antd lint packages/ui/src + packages/poster-editor/src --version 6.7.0 → 1 warning（virtual=false performance）/ 0 issues"
  - "T05 pnpm test → 153/153 PASS"
  - "T05 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
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

## T05 迁移选择器、字体和颜色

- 开工 HEAD `e63952a`。变更：`Select` 与 `Combobox` 由 Base UI 改为 antd `Select`；新增 `ColorField`（antd `ColorPicker` + 自定义触发按钮）接管文字颜色、文字背景色、描边色、阴影色；`modal-layer` 新增 `hasVisiblePopup()`，`BottomSheet` 与编辑器快捷键改用它判断弹层占用；`packages/poster-editor` 直接依赖 `antd@6.7.0`。
- `Combobox` 保留 `onValueChange` 与 `onHighlightChange` 分离：hover/方向键只更新预览，Enter 或点击才写文档；分组由 `group` 字段合成 antd 的 grouped options；`getPopupContainer` 仍选最近的 `[data-fp-overlay]`，无嵌套时回到根容器；`labelRender` 保留 `data-fp-select-value` 值节点与长文字截断。
- `ColorField` 保留六位/八位 hex 与透明哨兵 `#00000000`，色板预设入口不动；打开即 `onInteractionStart`，关闭（含 Escape、遮罩、卸载兜底）即 `onInteractionEnd`，一次颜色交互一个撤销项；第一次 Escape 只关颜色面板并把焦点还给触发按钮。
- 测试基建：`helpers.ts` 新增 `setColor`（点开→填 hex→点合，断言面板消失）与 `selectRoot`；`ui-controls` 的滚动与高亮断言改读 `.ant-select-dropdown-list-holder` 和 `.ant-select-item-option-active`；`editor-mobile` 断言第一次 Escape 后菜单为 0、抽屉仍在、选区不变，关闭抽屉后焦点回到「文字设置」。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm exec vitest run packages/poster-editor/src/fonts` | 14/14 PASS |
| `pnpm exec playwright test tests/e2e/editor-fonts.spec.ts` | 12/12 PASS（新临时栈，含禁用 Inter、过期校验、真实导出字体、alpha 与透明哨兵） |
| `pnpm exec playwright test tests/e2e/editor-mobile.spec.ts` | 3/3 PASS |
| `pnpm exec playwright test tests/e2e/ui-controls.spec.ts` | 17/17 PASS（新临时栈） |
| `pnpm exec playwright test tests/e2e/editor-richtext.spec.ts tests/e2e/editor-mobile.spec.ts` | 7/7 PASS |
| `FP_UI_BASELINE=1 pnpm exec playwright test tests/e2e/ui-baseline.spec.ts` | 2/2 PASS（桌面+手机截图采集入口未变） |
| `antd lint packages/ui/src / packages/poster-editor/src --version 6.7.0` | 1 warning（`virtual=false`）+ 0 issues |
| `pnpm test` | 153/153 PASS |
| `pnpm typecheck` | exit 0 |

### 中途红灯与处理

- 三个 spec 同跑时后 12 个用例全部停在 `/register`：临时栈的注册限流是每 IP 每 10 分钟 20 次。按文件分批、每批新栈后全部通过；不把 429 记为控件失败。
- 光标样式用例得到「后前」而不是「前后」：`prosemirror-view@1.42.8` 的 `handlers.focus` 在 20ms 后才把 state 选区写回 DOM，颜色弹层关闭后焦点在触发按钮，测试紧接着键入即落在块首。产品行为符合 UI-10（选区快照保留、关闭归还焦点），改为用例显式回到画布并轮询 caret 复位。
- alpha 期望 `0.502` 失败：当前 Chrome 把 `#ff000080` 序列化为 `rgba(255, 0, 0, 0.5)`，按实测值断言。
- 「设为透明」出现两个同名按钮触发 strict mode：改为在包含「文字背景色」的 `label.panel-field` 内定位。
- 手机字体行首帧高度为 0（`ant-slide-up-appear-prepare`）：改为轮询稳定后 ≥44px、字号 16px。
- `ui-baseline` 打开字体菜单时 listbox 判定 hidden：T01 的 `settle()` 注入 `animation:none!important` 且常驻页面，rc-motion 收不到 `animationend`，菜单停在 `opacity:0`/`0×0`。用诊断用例对照「有/无冻结」两种状态确认，改为截图后移除该样式。
- 抽屉内 `window.getSelection().toString()` 断言取消：antd 组合框把焦点移入自身搜索框，DOM 选区暂时离开画布；改用「只有风景被改字体/字号、其余文字保持原值」的行为断言证明范围保留。
