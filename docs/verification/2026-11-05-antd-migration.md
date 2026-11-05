# FastPoster antd 迁移验证记录

> 计划：`docs/superpowers/plans/2026-11-05-antd-frontend-migration.md`。执行账本：`.superpowers/sdd/2026-11-05-antd-frontend-migration/progress.md`（本文件只汇总可复核证据）。

```yaml
status: IN_PROGRESS
authorization: "2026-11-05 用户：请你深度分析该需求和相关文档裁量，然后继续该任务"
execution_mode: native
workspace: "/Users/aaa/acode/FastPoster"
branch: "feat/fastposter"
base_commit: "d6c3d45"
last_verified_commit: "e5a5018"
current_task: T07
next_step: T07.1
requirements: [UI-03, UI-04, UI-11]
changed_paths:
  - "packages/ui/src/Button.tsx"
  - "packages/ui/src/button-appearance.ts"
  - "packages/ui/src/Input.tsx"
  - "packages/ui/src/Form.tsx"
  - "packages/ui/src/Status.tsx"
  - "packages/ui/src/Tooltip.tsx"
  - "packages/ui/src/ToggleButton.tsx"
  - "packages/ui/src/NumberField.tsx"
  - "packages/ui/src/UIProvider.tsx"
  - "packages/ui/src/theme.ts"
  - "packages/ui/src/styles.css"
  - "packages/ui/src/{Button,Input}.module.css"
  - "packages/ui/src/{Form,Status,Tooltip}.module.css"
  - "packages/ui/src/{form-contract,styling-hook,toggle-tooltip,status-contract}.test.ts"
  - "packages/poster-editor/src/Stage.tsx"
  - "tests/e2e/ui-controls.spec.ts"
  - "tests/e2e/editor-settings.spec.ts"
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
  - "T06：`FormField` 不用 antd `Form.Item`。触发条件：页面用受控值 + 原生 `submit`，且 hint 与 error 要同时进 `aria-describedby`；`Form.Item` 的校验状态与 `id` 生成会接管这两件事。代价：标签/错误关联由包内自绘，antd 升级不会替它兜底，已有 form-contract 用例覆盖。"
  - "T06：`Status` 用 antd `Alert` 但保留 `status status-{tone}` 钩子与 `role=alert/status`，`showIcon={false}`（图标会重复文字已经说的话）。代价：E2E 依赖的 `.status-error` 是自有类，不是 antd 类。"
  - "T06：`busy` 走 `loading={{icon}}` 自定义 spinner。触发条件：布尔 `loading` 会插入 `role=img aria-label=loading`，污染按钮的可访问名。代价：spinner 动画由包内 CSS 提供。"
  - "T06：文本控件的几何与焦点墨色放全局 `styles.css` 的 `[data-fp-input]` 限定选择器，不放 CSS module。触发条件：`Input.tsx` 里 `styles` 不再被引用时 esbuild 按 TS 规则丢弃该 import，整个 module 不进 bundle，bare 搜索框的焦点环退回页面边框色（实测 `rgb(221,231,209)`）。代价：包内全局样式表变长；换来与注入顺序无关、且不会被 tree-shake 的覆盖。"
  - "T06：`Tooltip` 的 Escape 在 document 捕获阶段消费并 `stopPropagation`。触发条件：冒泡阶段监听时，编辑器 `Escape→取消选中` 会先卸载那排工具按钮，焦点无处可归；UI-10 要求第一次 Escape 只关内层。代价：提示打开期间一次 Escape 不会同时关外层弹层，需按第二次。"
  - "T06：画布「点空白取消选中」改按 `data-fp-control`/`data-fp-input` 判断（`isControlPress`）。触发条件：antd 的 Select 触发器是 div+input，不是 `button`/`select`，点预览缩放会把选中的文字块丢掉（full-flow、editor-geometry 复现，属 T05 遗留）。代价：共享控件必须继续带这两个钩子，已有 styling-hook 用例锁住。"
  - "T06：账号页无需页面级改动，`/login`、`/register`、`/password`、`/password?reset=1`、`/admin/login` 只消费共享控件。代价：页面 CSS 里 `.auth-form > .button` 的 45px CTA 等几何仍由页面负责，属预期分层。"
  - "T06：`editor-settings` 混合字号用例在 `input.focus()` 后补一次选区复位轮询，不改产品代码。原因：与 T05 同一 `prosemirror-view@1.42.8` 的 20ms 延迟写回，合成按键快过真人。"
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
  - "T06 pnpm exec vitest run packages/ui → 79/79 PASS（8 文件，含新增 status-contract 3 例）"
  - "T06 pnpm exec playwright test tests/e2e/ui-controls.spec.ts → 17/17 PASS（新临时栈）"
  - "T06 pnpm exec playwright test tests/e2e/session-sync.spec.ts → 2/2 PASS（新临时栈）"
  - "T06 pnpm exec playwright test tests/e2e/full-flow.spec.ts → 3/3 PASS（新临时栈，注册→登录→改密→真实 PNG→管理员登录）"
  - "T06 pnpm exec playwright test tests/e2e/editor-geometry.spec.ts → 1/1 PASS（新临时栈，把手与拖动）"
  - "T06 pnpm exec playwright test tests/e2e/editor-settings.spec.ts → 4/4 PASS（新临时栈）"
  - "T06 pnpm exec playwright test tests/e2e/editor-mobile.spec.ts → 3/3 PASS（新临时栈，44px 触摸目标）"
  - "T06 pnpm test → 162/162 PASS"
  - "T06 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
  - "T06 pnpm build → 8/8（删除 Input.module.css 后仍可构建）"
  - "T06 pnpm exec antd lint packages/ui/src → 0 deprecated / 1 warning（T05 的 virtual=false 取舍）"
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

## T06 迁移基础控件和账号页

- 开工 HEAD `f9d452e`，本任务两个提交：`ec8a915`（画布把手遗留修复）与 `e5a5018`（共享控件与账号页）。
- `Button`/`IconButton`/`ToggleButton` 改由 antd `Button` 实现：`variant` 映射 `type`/`danger`（映射表放 `button-appearance.ts`，页面不接触 antd 类名）、`density="compact"` 映射 `size="small"`、`busy` 用自定义 `aria-hidden` spinner 走 `loading` 对象并保留 `aria-busy`；`ButtonProps.type` 仍是 HTML 按钮类型，内部映射 `htmlType`；`ToggleButton` 保留 `aria-pressed` 与 `button-{variant}` 钩子。
- `TextInput`/`Textarea` 改为 antd `Input`/`Input.TextArea`：`variant="bare"` 映射 `borderless`，`density="compact"` 映射 `size="small"`，ref 仍交回原生 `<input>`/`<textarea>`（antd 6 的 TextArea 实例只有 `nativeElement`）。`FormField` 保留自绘的 label/hint/error 关联（两个 `aria-describedby` 是页面契约），错误改由 `status="error"` 表达。
- `Status` 改为 antd `Alert`：`tone` 映射 `type`，`role` 仍按 error=alert、其余=status，`showIcon={false}`，保留 `status status-{tone}` 钩子供页面与 E2E 选择。
- `Tooltip` 改为 antd `Tooltip`：受控 `open` + `destroyOnHidden`，`trigger=["hover","focus"]`，气泡内层继续带 `data-fp-tooltip`；Escape 在 document 捕获阶段消费（UI-10 的第一层归内层）。`UIProvider` 关闭 `button.autoInsertSpace`，否则两字中文标签变成「取 消」，按精确可访问名定位的用例全部落空。
- 样式分层：主题补 `Button`/`Alert`/`Tooltip` 组件 token（14/12px 字号、36/32px 高度、Alert 内边距与圆角）；`Button.module.css`、`Input.module.css` 删除，剩下的几何与焦点墨色用 `[data-fp-control]`/`[data-fp-input]` 限定选择器并入全局 `styles.css`；44px 触摸目标与 iOS 16px 防缩放仍由 `@media (pointer: coarse)` 提供。
- 账号页（`/login`、`/register`、`/password`、`/password?reset=1`、`/admin/login`）没有页面级改动：它们只消费共享控件，认证与强制改密顺序由 `ui-controls` 首条用例与 `full-flow` 覆盖。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm exec vitest run packages/ui` | 79/79 PASS（8 文件，新增 `status-contract.test.ts` 3 例） |
| `pnpm exec playwright test tests/e2e/ui-controls.spec.ts` | 17/17 PASS（新临时栈；含密码页显式提交、Escape 层级、焦点墨色、图标按钮可访问名与禁用不响应） |
| `pnpm exec playwright test tests/e2e/session-sync.spec.ts` | 2/2 PASS（新临时栈） |
| `pnpm exec playwright test tests/e2e/full-flow.spec.ts` | 3/3 PASS（新临时栈；注册→登录→改密→真实 PNG 下载→管理员登录） |
| `pnpm exec playwright test tests/e2e/editor-geometry.spec.ts` | 1/1 PASS（新临时栈；把手拖动与一步几何撤销） |
| `pnpm exec playwright test tests/e2e/editor-settings.spec.ts` | 4/4 PASS（新临时栈；含混合选区与按住步进） |
| `pnpm exec playwright test tests/e2e/editor-mobile.spec.ts` | 3/3 PASS（新临时栈；44px 触摸目标） |
| `pnpm test` | 162/162 PASS |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | 8/8（删除 `Input.module.css` 后仍可构建） |
| `pnpm exec antd lint packages/ui/src` | 0 deprecated、1 warning（T05 已裁量的 `virtual=false`） |

### 中途红灯与处理

- bare 搜索框焦点墨色失败（实测 `rgb(221,231,209)`，期望 `rgb(136,164,113)`）：`Input.tsx` 中 `styles` 已无引用，esbuild 按 TS 规则丢弃未使用的 import，整个 CSS module 不进 bundle，焦点环退回页面边框色。三条规则并入始终加载的 `packages/ui/src/styles.css`，选择器用 `input[data-fp-input]:focus`（0,2,1）压过 antd 注入样式与页面 `[data-fp-input]` 规则（0,2,0），与加载顺序无关；`Input.module.css` 删除。
- 图标提示 Escape 用例两层失败：其一，antd Tooltip 离场动画让上一个气泡多停留约 360ms，`[data-fp-tooltip]` 计数在切换焦点时为 2，改为按气泡自身文本定位当前焦点动作的提示；其二，冒泡阶段的 document 监听不阻止传播，编辑器 `Escape→取消选中` 随即卸载那排工具按钮，焦点无处可归。监听移到捕获阶段并 `stopPropagation`，与 `ColorField` 既有「内层吃掉第一次 Escape」一致。
- `full-flow` 找不到「调整右侧宽度」把手、`editor-geometry` 拖动不生效（`ec8a915` 修复）：T05 换成 antd `Select` 后触发器不再是 `button`/`select` 元素，画布的「点空白取消选中」只认标签名，于是点预览缩放即丢选区，100% 缩放改按画布中心定位，鼠标按下落在画布上变成平移。判断改用共享控件自带的 `data-fp-control`/`data-fp-input` 钩子，触摸捏合的同一处判断一并更新。此为 T05 遗留，`full-flow`/`editor-geometry` 自 T04 后未复跑，本次 T06.5 复跑暴露。
- 混合字号用例字段显示 `64` 而非空（占位符「混合」）：`input.focus()` 后 Tiptap 在 20ms 才把 state 选区写回 DOM，测试的 `Home` + 4×`Shift+ArrowRight` 恰好被这次写回打断——截图里画布高亮只剩「你好」，面板按 2 字选区算出 64。真人按键远慢于 20ms，产品行为不变，沿用 T05 的处理：先轮询选区复位再键入。
