# FastPoster antd 迁移验证记录

> 计划：`docs/superpowers/plans/2026-11-05-antd-frontend-migration.md`。执行账本：`.superpowers/sdd/2026-11-05-antd-frontend-migration-plans/progress.md`（本文件只汇总可复核证据）。

```yaml
status: DONE
authorization: "2026-11-05 用户：请你深度分析该需求和相关文档裁量，然后继续该任务"
execution_mode: native
workspace: "/Users/aaa/acode/FastPoster"
branch: "feat/fastposter"
base_commit: "d6c3d45"
last_verified_commit: "e73aca3"
current_task: T11
next_step: "无（迁移完成，等待人工合并）"
requirements: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12, UI-13, UI-14]
changed_paths:
  - "apps/admin/src/features/Metadata.tsx"
  - "apps/web/src/styles.css"
  - "packages/poster-editor/src/Editor.tsx"
  - "packages/poster-editor/src/styles.css"
  - "packages/ui/package.json"
  - "packages/ui/src/Dialog.module.css（删除）"
  - "packages/ui/src/Select.module.css"
  - "packages/ui/src/styles.css"
  - "pnpm-lock.yaml"
  - "tests/e2e/editor-fonts.spec.ts"
  - "tests/e2e/editor-mobile.spec.ts"
  - "tests/e2e/project-permanent-deletion.spec.ts"
  - "tests/e2e/ui-baseline.spec.ts"
  - "tests/e2e/ui-controls.spec.ts"
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
  - "T07：记录页行身份钩子改名 `data-fp-record`→`data-admin-record`。原因：`data-fp-*` 是 packages/ui 共享控件的命名空间（styling-hook 用例锁 `data-fp-input`），页面行归属后台应用。代价：只有用例选择器跟着改。"
  - "T07：窄屏判断改用同步的 `matchMedia` 查询（767px），不用 `Grid.useBreakpoint()`。触发条件：断点首帧未就绪，表格与手机摘要会在加载瞬间互换一次。代价：无 SSR，后台本就是纯客户端 SPA。"
  - "T07：`RecordPager` 仅在 `total > 24` 时挂载。触发条件：antd 的上一页/下一页按钮禁用后仍留在 DOM，既有「单页列表没有分页」的 `toHaveCount(0)` 断言会失败。代价：单页时看不到分页控件，与迁移前一致。"
  - "T07：空态以 `q.isSuccess` 为准（`emptyText(arrived)`）。触发条件：react-query 出错时 `isPending` 为 false，否则请求失败会被界面说成「暂无记录」。"
  - "T07：`Table` 不设 `scroll`。触发条件：@rc-component/table 只在 `scroll` 下渲染 measure row，`tbody tr` 计数会多一行，而 project-permanent-deletion 的两处断言按行数取最后一条。横向滚动仍由 `.table-wrap` 提供。"
  - "T07：共享 `Dialog` 新增 `closable`（默认 true），失败详情设 false。触发条件：antd 右上角 X 的可访问名就是「关闭」，与页脚按钮同名，一个弹窗里出现两个「关闭」既是 strict mode 歧义也是真实的可读性问题；全站 16 处既有断言把 X 当作「关闭」控件，故只保留页脚那一个具名控件，遮罩与 Escape 仍可关闭。代价：该弹窗右上角没有 X。"
  - "T07：抽屉关闭后的焦点回归由页面保证（`drawer` 迁移的 effect + `focusable={{focusTriggerAfterClose:false}}`）。触发条件：rc-drawer 恢复的是「打开那一刻被聚焦的元素」，手机点按不聚焦按钮，那次记录是 `body`；在 `onClose` 里立即 focus 会被尚未释放的焦点锁拽回面板，在动效回调里 focus 又会被库随后写回 `body`。代价：焦点回归多一条页面自己的规则，antd 焦点锁语义变化时该断言会红。"
  - "T07：`antd lint` 的两处弃用改用公开 API — Drawer `width`→`size`、Tag `bordered={false}`→默认 filled 变体，视觉不变。"
  - "T08：文件选择用 antd `Upload` + `beforeUpload` 返回 false，命名为共享控件 `FileField`，不直接用原生 `input[type=file]`。触发条件：需求要把「选取、取消、提交」当成三个阶段可测可点，原生 input 既没有「清除待传文件」的控件，也不显示已选文件名。代价：上传请求仍由页面 `apiClient.upload` 发起，`Upload` 只负责选取；受控 `fileList` 不接 antd 的 `onChange`（`antd lint` 的 usage 警告即此项），因为列表由页面的单个 `File` 值派生，接了反而会让一次选择到达页面两次。"
  - "T08：素材表单去掉原生 `required`。触发条件：文件是否已选由提交路径判定（缺 assetId 即抛「请选择需要上传的文件」）并进通知，浏览器校验气泡不可样式化、也不进无障碍通知，且 `Upload` 的触发器是 button，`required` 无处可挂。代价：缺文件的提示从即时气泡改为提交后的通知。"
  - "T08：`Checkbox` 的可访问名取自可见文案，不再单独写 `aria-label`。触发条件：antd 的 `Checkbox` 根元素是 `<label>`，子节点文字即控件名称；再写 aria-label 会让「发布」与「发布模板」两个名字同时存在。代价：模板工作区标题行显示「发布模板」而不是「发布」。"
  - "T08：文案分类树改用 antd `Tree`（`blockNode` + `defaultExpandAll` + `selectedKeys`）。触发条件：五级结构、键盘树导航与选中态由框架承担；`defaultExpandAll` 只在数据到达后挂载才有效，所以树只在 `listState()` 判定为 ready 时渲染。代价：树非受控展开，新建深层子分类后父节点若被手工收起需再展开一次。"
  - "T08：`Tree` 组件 token `indentSize: 14`（默认 24）。触发条件：侧栏 250px、内边距 12px，五级最深行的缩进 + 展开箭头若按默认值会吃掉标题文字。代价：行首比 antd 默认更紧。"
  - "T08：加载/空/失败判定收敛到 `apps/admin/src/features/catalog-state.ts` 的 `listState()`（纯函数，先写 4 条单测）。触发条件：T07 已确立「请求失败不能被说成暂无记录」，本任务在文案树与文案列表两处需要同一优先级（pending > failed > rows）。代价：多一个小模块，换来两处状态语义一致且可单测。"
  - "T08：模板工作区用新增的共享 `Workbench`（`div[role=dialog][aria-label][tabindex=-1]`）而不是 antd `Modal`。触发条件：`Modal` 没有 `aria-label` 入口（只有 title，会再画一个与页面重复的标题行），且模态语义会声明键盘所有权。代价：没有遮罩与现成滚动锁；页面自身的全屏容器（`.template-editor-overlay`）已经占满视口。"
  - "T08：`hasActiveOverlay` 拆为 `topModalLayer()`（通知去向）与 `hasBlockingOverlay()`（键盘所有权），`registerModalLayer` 新增 `blocksShortcuts`。触发条件：UI-05 要求后台全屏打开共享 `Editor`，而 UI-10 要求弹层存在时屏蔽画布 Delete/撤销/重做——同一个容器不能既接收通知又抢走它里面编辑器的快捷键。代价：注册方需要判断自己属于哪一类；已有 modal-layer 7 例与 keyboard 13 例覆盖。"
  - "T08：`Workbench` 不绑 Escape、不做焦点陷阱。触发条件：关闭进行中的模板编辑必须是显式动作（与 T07「危险确认的取消优先」相反的破坏性方向），焦点圈定需要 `@rc-component/util` 的 `getFocusableList`，那是计划外依赖。代价：读屏用户在容器内的 Tab 顺序不受限，靠自身语义（顶栏→画布→属性）收敛。"
  - "T08：模板背景选择保留一个隐藏原生 `input[type=file]`。触发条件：`Editor` 的 `onAssetRequest` 返回 promise，取消系统对话框时也必须 settle，antd `Upload` 没有「用户取消」这个出口。代价：全站只剩这一处原生文件输入，已有注释说明边界。"
  - "T08：`Metadata.tsx` 里的原生 `select`（筛选作品状态）与已成死代码的 `Pager` 导出留给 T11.1 清理。触发条件：两者都不在 T08 的文件清单里，且 `project-permanent-deletion.spec.ts:381` 的 `selectOption` 属 T07 已验收断言，改它要连带重跑该 spec。代价：后台暂留一处未迁移控件，T11 必须处理并复跑该用例。"
  - "T11：移除 `@base-ui/react`，`packages/ui` 只保留 antd；删除无引用的 `Dialog.module.css` 与 `.pagination`。触发条件：T03–T10 已把所有调用方迁到 antd 或共享控件，旧浮层依赖只剩 lockfile 与死样式。代价：无（`pnpm verify` 与全量 E2E 复跑）。"
  - "T11：后台状态筛选改共享 `Select`，`project-permanent-deletion.spec.ts` 从原生 `selectOption` 改为 `chooseOption`/`selectValue`。原因：T11.1 要求清掉最后一处原生 `select`；断言仍锁定「筛选→回收站」的同一行为。代价：该 spec 的定位方式随控件契约变化。"
  - "T11：手机「背景」改为选择 sheet（上传图片 / 从背景库选择），保持四入口与顺序。触发条件：spec 第 85 行要求编辑器背景同时保留上传与可用背景库入口，phone 原先只有上传。代价：手机上传多一次点击。"
  - "T11：体积按两种口径记录：入口 chunk（与 T02 同口径）与入口静态闭包（manifest 的静态 `imports`）。触发条件：后台入口 chunk 只有 67,275 B，但首屏还静态加载共享 `api` chunk 786,232 B；只报前者会低估首屏。代价：两个数字需要并列解释。"
  - "T11：`ui-baseline` 的冻结样式只在截图期间挂载，`settle()` 先等 antd motion 类清空与有限动画结束。触发条件：`animation:none!important` 常驻会让 rc-motion 等不到 `animationend`，弹窗停在 `opacity:0`。代价：单次截图最多多等 10s（超时上限）。"
  - "T11：删除 `.ant-select-input` 的 `color: inherit`，并在 `editor-fonts` 增加输入文字计算色断言。触发条件：antd 搜索态把触发器文字设为透明，`inherit` 让输入框也透明。代价：无。"
  - "T11：`ui-controls` 触屏按住用例先等 sheet 静止底边等于视口高度再派发触摸事件。触发条件：Drawer 入场期间派发会点空，导致字号未变化。代价：用例多一次 `expect.poll`。"
  - "T11：按 T07–T10 先例拆分提交：`e73aca3` 收尾代码，本文件随后以 docs 提交记录；执行账本留在 `.superpowers/`（已忽略，不入库）。触发条件：计划 T11.6 只写了一个提交名，但前三个任务的 feature/docs 拆分已成历史惯例。代价：提交数为 2 而非 1。"
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
  - "T07 pnpm exec playwright test tests/e2e/admin-layout.spec.ts → 3/3 PASS（新临时栈；桌面表格与手机摘要同一任务 ID、加载/空/失败三态、分组导航与抽屉焦点）"
  - "T07 pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts → 13/13 PASS（新临时栈；含末页删除后分页回退与清理队列）"
  - "T07 pnpm --filter @fastposter/admin test → 5/5 PASS"
  - "T07 pnpm test → 162/162 PASS"
  - "T07 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
  - "T07 pnpm build → 8/8"
  - "T07 pnpm exec antd lint apps/admin/src --version 6.7.0 → 0 issues（两处弃用先修为 size 与 filled 变体）"
  - "T08 pnpm exec vitest run packages/ui/src/catalog-control-contract.test.ts apps/admin/src/features/catalog-state.test.ts packages/ui/src/modal-layer.test.ts packages/poster-editor/src/keyboard.test.ts → 33/33 PASS（新增契约 9 例 + listState 4 例；契约用例是静态标记断言，键盘所有权与焦点回归的红/绿见下方两条）"
  - "T08 pnpm exec playwright test tests/e2e/admin-catalog.spec.ts → 2/2 PASS（新临时栈，run 20261106-110022；上传计数 1→2）"
  - "T08 pnpm exec playwright test tests/e2e/copy.spec.ts → 1/1 PASS（新临时栈，run 20261106-110206；五级 antd Tree + 发布/搜索）"
  - "T08 pnpm exec playwright test tests/e2e/templates.spec.ts → 3/3 PASS（新临时栈，run 20261106-110231；含新用例 closing template editor returns to the filtered list）"
  - "T08 pnpm test → 179/179 PASS"
  - "T08 pnpm typecheck（/Users/aaa/acode/FastPoster）→ exit 0"
  - "T08 pnpm build → 8/8"
  - "T08 antd lint apps/admin/src → 0 issues；antd lint packages/ui/src → 0 deprecated / 2 warning（T05 virtual=false、T08 受控 fileList 无 onChange，均已裁量并注释）"
  - "T09 playwright ui-baseline 2/2 + projects 3/3 + project-permanent-deletion 13/13 + notifications 6/6 + session-sync 2/2 + copy/image-upload/templates 5/5（各新临时栈）；root vitest 186/186；pnpm typecheck exit 0；pnpm build 8/8；antd lint apps/web/src 0 issues"
  - "T10 playwright 7 个计划内 spec 23/23 + ui-controls 17/17 + editor-fonts 12/12 + full-flow 3/3；packages/poster-editor vitest 41/41；root vitest 186/186；typecheck exit 0；build 8/8；五档宽度截图与 scrollWidth≤viewport"
  - "T11 pnpm install --frozen-lockfile exit 0；pnpm verify exit 0（契约/typecheck/186/186/build 8/8）；turbo build --force 8/8；entry boundary 三站 PASS；Playwright 89/89 in 19 files（各新临时栈）；UI-13 matrix 1/1；PNG AE=0 且 SHA-256 一致；antd lint 0 deprecated / 2 documented warnings"
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

## T07 重做后台导航与记录页面

- 开工 HEAD `88fc56c`，本任务一个提交：`ea37d8a`。覆盖 UI-03（路由与登录不动）、UI-11（后台列表与任务详情）、UI-12（依赖与构建边界）。
- 侧栏导航（UI-11 的「分组」）：`AdminLayout` 改用 antd `Menu mode="inline"`，三分组「账号与作品 / 内容资源 / 运行记录」共 9 项，按操作者意图分组而不是按路由字母序。每个 item 的 label 仍是既有 `Link`，因此 `/admin/<route>` 路由表与权限判断零改动；当前页由 `selectedKeys` 与 `aria-current="page"` 同时表达。图标继续用 Lucide，`size={17}`。
- 顶栏与窄屏导航：顶栏加面包屑（当前路由的标签）与 `.admin-nav-toggle` 按钮，后者只在 ≤767px 显示；侧栏在同一断点整体隐藏，断点值与 `useNarrowScreen` 共用 antd 的 `md` 边界，避免表格与摘要在不同宽度互换。抽屉是 antd `Drawer`（`placement="left"`、`size={280}`、`destroyOnHidden`），关闭后焦点回到那个触发按钮——由页面上一个跟随 `drawer` 状态迁移的 `useEffect` 保证，并把 `focusable={{focusTriggerAfterClose:false}}` 交给库（详见下方红灯与账本裁量）。
- 记录页公共形状：新增 `apps/admin/src/features/records.tsx`，导出 `PAGE_SIZE=24`、`RecordSection`（`section[aria-label]`）、`RecordPager`（antd `Pagination`）、`emptyText`/`NoRecords`/`formatDate`。用户、作品元数据、操作记录、待清理队列与导出任务五处共用它；分页从自绘「上一页 / 第 X 页 · 共 N 项 / 下一页」换成 `Pagination`，zh_CN locale 让前后按钮的可访问名恰好还是「上一页」「下一页」，既有用例无需改选择器。
- 导出任务页（UI-11 的主体）：`Metadata.tsx` 里的 `JobsPage` 拆到新文件 `features/ExportJobs.tsx`，`main.tsx` 的 lazy 目标随之指向它（沿用既有的按页 lazy 拆分，UI-12）。桌面是六列 `Table`（任务 ID / 作品 ID / 版本 / 状态 / 创建时间 / 操作），窄屏是 `.admin-summary` 列表；两者读同一个 `useQuery`（`refetchInterval=5000`）、渲染同一条记录的同一份字段，所以「同一 DTO 的桌面表格与手机摘要」是可断言的而不只是宣称。行身份用 `data-admin-record={job.id}`，`Table` 走 `onRow`、摘要走 `li` 属性，两种布局共用同一选择器。状态用 `Tag`（排队中/运行中/成功/失败，未知值原样显示），失败行的「查看失败原因」打开只读详情弹窗。
- 详情弹窗的边界（UI-11 的权限面）：`JobDetails` 只列任务 ID、作品 ID、版本、状态、创建时间与 `errorMessage`，并写明「结果图片、预览和海报正文只属于作品所有者，后台不读取」。`downloadUrl`、`previewUrl` 与作品正文不进后台——用例断言弹窗文本里不含私有主机名，且桌面与手机两侧的详情文本完全相等。共享 `Dialog` 为此新增 `closable`（默认 true），该弹窗设 false。
- 样式分层：`styles.css` 新增面包屑、抽屉页脚、`.admin-records`、`.admin-pagination`、`.admin-summary*`、`.admin-code`（长 ID 不省略号、允许断词）、`.admin-job-meta`/`.admin-job-error`/`.admin-note-line`，以及 `@media (pointer: coarse)` 下菜单项 44px 触摸目标；原先 680px 的侧栏堆叠规则让位给 767px 断点。
- 待清理队列沿用 T03 的 `ProjectDeletionStatus`，只把分页换成 `RecordPager`；永久删除流程与「末页删完回退一页」的行为由 `project-permanent-deletion` 全量回归覆盖。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm exec playwright test tests/e2e/admin-layout.spec.ts` | 3/3 PASS（新临时栈；桌面表格与手机摘要同一任务 ID、加载/空/失败三态、三分组导航与抽屉焦点） |
| `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts` | 13/13 PASS（新临时栈；含末页删除后分页回退与清理队列重试） |
| `pnpm --filter @fastposter/admin test` | 5/5 PASS |
| `pnpm test` | 162/162 PASS |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | 8/8 |
| `pnpm exec antd lint apps/admin/src --version 6.7.0` | 0 issues（两处弃用先修为 `size` 与默认 filled `Tag`） |

### 中途红灯与处理

- 「关闭」控件重名（strict mode violation）：失败详情弹窗里同时有 antd 右上角 X（可访问名就是「关闭」）和页脚的「关闭」按钮，`getByRole("button", {name:"关闭"})` 命中两个。这不只是测试问题——一个弹窗里两个同名控件本身读起来含糊。共享 `Dialog` 加 `closable`（默认 true）、该弹窗设 `closable={false}`，保留页脚那个具名控件，遮罩与 Escape 仍能关；全站 16 处把 X 当「关闭」用的既有用例因此不受影响。
- 抽屉关闭后焦点回不到触发按钮，连续三次红灯：先在 `afterOpenChange(false)` 里 focus，被 rc-drawer 自己的恢复覆盖（它恢复的是「打开那一刻被聚焦的元素」，手机点按不聚焦按钮，那次记录是 `body`）；改在 `onClose` 里立即 focus，被尚未释放的 `useLockFocus` 拽回面板；最终 `focusable={{focusTriggerAfterClose:false}}` 关掉库的恢复，页面上用 `wasOpen` 守卫的 `useEffect` 在面板卸载后 focus——父组件 passive effect 晚于子组件 cleanup，这是最早能安全 focus 的时机。3/3 通过。
- 单页列表仍渲染分页按钮：antd 的上一页/下一页禁用后不离开 DOM，既有 `toHaveCount(0)` 断言失败。裁量为 `RecordPager` 在 `total <= 24` 时整体返回 `null`，与迁移前的可见行为一致。
- 请求失败被说成「暂无记录」：react-query 出错时 `isPending` 为 false，`Table` 的空槽会显示空态。改由 `emptyText(q.isSuccess)` 决定——只有真的拿到数据才声称「暂无」，加载与失败各自交给 spinner 与错误通知；用例断言失败态下页面既无行也无「暂无记录」。
- `antd lint` 报两处弃用：Drawer 的 `width` 在 6.x 由 `size` 取代、`Tag` 的 `bordered={false}` 由默认 `variant="filled"` 取代。按公开 API 重写后复跑 0 issues，视觉未变。

## T08 迁移后台素材及模板入口

- 开工 HEAD `b4f2b9e`，本任务一个提交：`3d3bdc5`。覆盖 UI-05（后台素材、模板与文案的原有行为）、UI-06（后台模板在全屏工作区顶部的控件）、UI-10（弹层栈、焦点归还与快捷键归属）。
- 开工前的基线复跑（`t08-baseline-20261106-093443.log`）：`admin-catalog` 1 失败 1 通过、`copy` 1 通过、`templates` 2 通过。那条失败是 T05 遗留的字体下拉断言写法（`toHaveValue` 读的是 antd 关闭后清空的搜索框），不是本任务引入；其余既有回归在迁移前确认是绿的。
- 上传的三个阶段（UI-05 的第一条）：新增共享 `FileField`（antd `Upload` + `beforeUpload` 返回 false）。选择文件只写页面的 `File` 状态，不发请求；已选文件显示为可删除的一行，点「删除文件」等于取消这次选择（`onChange(null)`）；请求仍由页面走 `apiClient.upload` 的 FormData、Cookie 与错误处理。`admin-catalog` 在登录处装了 `POST /api/v1/assets/images` 计数器，断言「选一次 = 1 次上传」「删除后再选并提交 = 共 2 次」，这比原来「提交时才知道文件有没有带上」更可检验。
- 素材与模板的其余原生控件：`立即发布`、`发布模板`、`发布分类`、`发布文案` 改为 `CheckboxField`；素材/分类/文案的排序改为 `NumberField`（沿用 T04 的草稿与边界语义）；模板包导入改为 `FileField`，并把 80 MiB 上限、`正在导入…` 文案与结束后清掉待传项集中到 `importPackage()` 一处。
- 文案页（UI-05 的「分类树、搜索、列表与编辑」）：`CategoryTree` 从手写递归按钮列表换成 antd `Tree`，五级结构、未发布徽标、行内「添加子分类 / 编辑分类」与「全部文案」根节点全部保留；`indentSize: 14` 与 `titleHeight: 30` 是主题里的 `Tree` token，为了 250px 侧栏。加载 / 无分类 / 失败三种状态在树自己的容器里分别呈现，判定来自新纯函数 `listState()`（4 条单测先写）；文案列表同样按 `listState()` 呈现，失败不再冒充空态。分页换成共享 `RecordPager`（`文案分页`），`PAGE_SIZE` 与其余记录页共用。
- 模板工作区（UI-05 最后一条 + UI-06）：`TemplateEditor` 的根容器改为新增的共享 `Workbench`，`role="dialog"`、可访问名、`tabindex="-1"`、打开取焦、关闭把焦点还给「编辑」；`Editor` 仍在工作区打开后才惰性加载。弹层机制此前只有「有没有东西压在上面」一个答案，现在拆成 `topModalLayer()`（通知去向）与 `hasBlockingOverlay()`（谁占键盘），workbench 注册时带 `blocksShortcuts: false`，因此全屏容器里的撤销/重做/删除仍然活着，通知也仍能落进来（modal-layer 7 例 + keyboard 13 例）。
- 新增回归 `closing template editor returns to the filtered list`：按分类筛选 + 搜索词过滤后打开某个模板，关闭工作区，断言筛选值与搜索词仍是打开时的那两个，且焦点落回该卡的「编辑」。它同时是 `Workbench` 的红→绿证据（见下方红灯）。
- 保留的一处原生控件：模板背景选择仍是隐藏 `input[type=file]`，因为 `Editor` 的 `onAssetRequest` 返回一个必须在用户取消系统对话框时 settle 的 promise，antd `Upload` 不提供这个出口；文件里写了注释说明边界。
- 样式分层：`packages/ui/src/styles.css` 新增 `.checkbox-field.ant-checkbox-wrapper`、`.file-field`、`.file-field-hint`、`.workbench:focus`；`apps/admin/src/styles.css` 删除 `.copy-node*` 的手写行几何、`.button-like`、`.resource-form input[type=file]` 与旧的 `.checkbox-field`，新增 antd Tree 的标题行规则（省略号、徽标、行内动作 hover 显现、`pointer: coarse` 下 44px）与 `.copy-tree-failed`。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm exec vitest run packages/ui/src/catalog-control-contract.test.ts apps/admin/src/features/catalog-state.test.ts packages/ui/src/modal-layer.test.ts packages/poster-editor/src/keyboard.test.ts` | 33/33 PASS（契约 9 + `listState` 4 + 弹层 7 + 快捷键 13） |
| `pnpm exec playwright test tests/e2e/admin-catalog.spec.ts` | 2/2 PASS（新临时栈；一次选择=1 次上传、删除后再选再提交=2 次） |
| `pnpm exec playwright test tests/e2e/copy.spec.ts` | 1/1 PASS（新临时栈；五级 antd Tree、发布、搜索与插入/替换撤销） |
| `pnpm exec playwright test tests/e2e/templates.spec.ts` | 3/3 PASS（新临时栈；含新用例与工作区打开后的字体/背景可达） |
| `pnpm test` | 179/179 PASS |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | 8/8 |
| `antd lint apps/admin/src` / `antd lint packages/ui/src` | 0 issues / 0 deprecated，2 条 warning（T05 `virtual=false`、T08 受控 `fileList` 无 `onChange`，均为已记录的取舍） |

### 中途红灯与处理

- 新用例先红在 `await expect(workspace).toBeFocused()`（Expected: focused / Received: inactive）：那时 `TemplateEditor` 的根还是普通 `div[role=dialog]`，谁都不注册、也没人取焦。实现 `Workbench`（注册 + `node.focus()` + 卸载时 `queueMicrotask` 归还 opener）后转绿。这条同时是 UI-10「关闭归还焦点」在后台的第一个可执行断言。
- `FileField` 的 `density` 契约用变异验证过：把 `density={density}` 写死成 `density="normal"`，`catalog-control-contract` 立即报「expected … to contain 'ant-btn-sm'」，说明这条断言真的在约束入参（模板标题行里的紧凑触发器与表单里的 36px 触发器不是同一个尺寸）。
- `copy.spec.ts` 第一次跑红在 `chooseOption(admin, "文案分类", …)` 的 strict mode violation：`getByLabel` 会命中任何有可访问名的元素，我给侧栏 `<aside aria-label="文案分类">` 起名时撞上了弹窗里那个同名 `Select`。侧栏改名为「文案分类树」——landmark 仍具名，控件名不再重复。这也是「给区域起名」这类 a11y 改动的真实代价：名字在页内必须唯一。
- `antd lint packages/ui/src` 新增一条 usage 警告（受控 `fileList` 建议提供 `onChange`）。裁量保留不接：列表由页面的单个 `File` 派生，接了 antd 的 `onChange` 会让同一次选择到达页面两条路径；已在 `Upload.tsx` 的注释里写明理由。
- 未处理但已登记：`Metadata.tsx` 仍有一个原生 `select`（筛选作品状态）和已成为死代码的 `Pager` 导出，两者不在 T08 文件清单内，交给 T11.1 清理并复跑 `project-permanent-deletion.spec.ts`（其 381 行的 `selectOption` 需要跟着换成共享选择器的定位写法）。

## T09 重做作品集和素材选择

- 开工 HEAD `ac8a952`，本任务一个提交：`52c599e`。覆盖 UI-04（作品集、回收站与账户隔离）与 UI-05（素材、模板和文案选择），并继续使用 T07 的 `RecordPager` 与 T08 的素材入口。
- 作品集（UI-04）：顶部导航 + 图库改为 4/3/2 列，断点 ≥881px、681–880px、≤680px，缩略图使用原始比例；主要动作是「新建海报」与并列的「模板库」。`Dropdown`、`Input`、`Pagination` 承接原有菜单、搜索和分页，列表仍由同一个 `useQuery` 返回的 DTO 渲染。卡片动作收敛为纯数据 `CARD_MENU`（`project-menu.ts`），因此「普通作品只有重命名/复制/移到回收站」能由 Vitest 锁定。
- 会话内位置（`collection-position.ts`）：`CollectionPosition` 记录 `{ userId, trash, search, keyword, page, deletionPage, scrollTop }`，由 App 的 ref 持有、渲染期间按当前 `user.id` 校验。从编辑器返回时输入值与已提交关键词一起恢复，只有用户改动筛选才启动重置页码的防抖；有效结果落地后再恢复滚动。换账号、退出和会话过期都因键不匹配而回到空白上下文；服务端结果证明末页超界时用 `lastValidPage` 回退（4 个单测）。
- 回收站与删除：两组结果（待清理 / 已删除）各有分页、请求键和地标名；软删除、恢复、彻底删除确认、重试和按任务 ID 更新保持原行为。软删除后两组页码各自回退，同账号返回仍恢复原页。
- 素材选择（UI-05）：`TemplatePicker`、`BackgroundPicker`、`CopyPicker` 改用共享 `Dialog` 与输入控件；模板从现有素材或 ZIP 新建，背景保留尺寸确认，文案保留五级分类、搜索、插入与替换。加载/空/失败/取消各有落点，失败不再冒充「暂无」。
- 样式分层：`apps/web/src/styles.css` 重写图库网格、筛选行、卡片菜单与窄屏摘要；`.pagination` 等旧规则开始退出。作品集与弹层截图以同一条件采集，作为 T01 基线的迁移后对照。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @fastposter/web test` | 29/29 PASS |
| `pnpm test` | 186/186 PASS |
| `pnpm exec playwright test tests/e2e/ui-baseline.spec.ts` | 2/2 PASS（22 张迁移后基线截图，桌面与手机同栈） |
| `pnpm exec playwright test tests/e2e/projects.spec.ts` | 3/3 PASS（新临时栈；筛选返回恢复页码/滚动、换账号清空） |
| `pnpm exec playwright test tests/e2e/project-permanent-deletion.spec.ts` | 13/13 PASS（新临时栈；含末页回退与清理队列重试） |
| `pnpm exec playwright test tests/e2e/notifications.spec.ts` / `session-sync.spec.ts` | 6/6 / 2/2 PASS |
| `pnpm exec playwright test tests/e2e/{copy,image-upload,templates}.spec.ts` | 5/5 PASS（各新临时栈） |
| `pnpm typecheck` / `pnpm build` | exit 0 / 8/8 |
| `pnpm exec antd lint apps/web/src --version 6.7.0` | 0 issues |

### 中途红灯与处理

- 打开卡片下拉后立即断言菜单消失时 strict mode 抛错：antd 的离场约 200ms，期间弹层仍是 `display:block`、`opacity≈0.99`，role 引擎仍把它当作可见。`chooseCardAction()` 改为「先断言只有一个菜单，点完再等菜单数为 0」，五个 spec 共用；同时给卡片 `Dropdown` 加 `destroyOnHidden`（`destroyPopupOnHide` 在 6.7.0 已弃用），减少关闭后的第二份 `menuitem`。离场窗口仍需等待，故两件事都保留。
- 换账号用例读到播种前的旧缓存：播种走 `page.request`，不经过当前 App 的 react-query（`staleTime: 15_000`）。用例在播种后 `page.goto("/projects")` 重新取列表；「搜索为空」仍先在会话内断言，隔离语义不变。
- 手机后台基线找不到 `admin-sidebar` 链接：390px 下侧栏是 `display:none`，导航只在 T07 的抽屉里。手机基线先点「导航菜单」再取链接，桌面仍直点侧栏。
- 分页文案：rc-pagination 1.7.0 的页码可访问名是 `页 N`（zh_CN），不是旧的「第 N 页」；用例改为 `aria-current="page"` + `页 N`，并把五个分页地标分别命名，避免回收站同时挂两组结果时的定位歧义。
- 搜索框没有退回页面边框色：直接换裸 antd `Input` 会丢掉 T06 锁定的 `[data-fp-input]` 焦点墨色契约；保留共享 `TextInput variant="bare"`（内部是 antd `Input variant="borderless"`）。
- `pnpm exec antd lint apps/web/src` 另报 `Dropdown` 的 `destroyPopupOnHide` 弃用；按 6.7.0 公开 API 换成 `destroyOnHidden` 后复跑 0 issues。
- 登记：`packages/ui/src/styles.css` 的 `.pagination` 已无调用方，待 T11 统一清理。

## T10 实施共享工作台和导出交互

- 开工 HEAD `52c599e`，本任务一个提交：`d79ded1`。覆盖 UI-06（桌面与手机工作台布局）、UI-07（属性分组、选区和事务）、UI-09（保存、冲突与导出）以及 UI-10 在编辑器内的延续。
- 四档布局（UI-06）：编辑器自己有 `useEditorLayout()`，按 1200/881/681 三个 `matchMedia` 分界得到 wide / medium / narrow / phone。wide 是三栏 178px / 1fr / 292px，图层与文字设置各自独立收起；medium 是画布 + 278px 设置，图层作为 182px 覆盖抽屉；narrow 画布全宽，图层与设置任一单侧展开；phone 只保留画布、当前块操作行和底部四入口。断点变化会关闭 sheet 与两侧抽屉，避免浮层留在不再属于它的容器里；`visualViewport` 高度写入 `--editor-viewport-height`，底部导航吃 `env(safe-area-inset-bottom)`。
- 创建入口：宽/中/窄的工具栏保留「切换图层 + 添加文字 + 背景 + 文案 + 背景库」，右侧是撤销/重做和设置开关；phone 不渲染工具栏，创建入口只出现在文字设置 sheet 顶部。因此任一宽度下「添加文字」都只有一个入口，图层行仍是 `aria-pressed` 按钮，选中块的操作（复制/前移/后移/删除）位于设置面板的作用域行下方。
- 检查器（UI-07 / T10.4）：新增受控 `EditorInspector`，四个 `aria-pressed` 分组「文字 / 段落 / 效果 / 位置」；`TextPanel` 继续拥有文档值、字体选择与事务回调，`ParagraphPanel` / `StylePanel` 只在对应分组挂载。分组切换会卸载 `NumberField`，所以未完成的原始值改由 `Editor` 按 `会话:块:字段` 持有：输入时写回，提交、离开、Escape 与断开（null）时清掉；换作品、`fontCheckScope` 变化、删除块和完成编辑会话都会让会话号自增并整体清空。1440→390 的切换因此不写文档、不产生撤销项，回填仍是 `12.` 这样的未完成原文，继续输入后只作用于原选区。
- `NumberField` 为实现上述契约增加可选 `NumberDraftBinding`（`initialDraft` / `onDraftChange`），提交、步进与按键语义不变；T04 的 41 个单测复用同一实现（这正是 T04 预检里登记的 GAP，按当时的裁量选择「先在属性所有者捕获草稿，再加可选绑定」）。
- 导出与保存（UI-09）：`ExportControls` 继续 `flush()` 后取 `saved.revision` 建任务，队列与结果来自真实的 `GetExport` 查询，预览和下载是同一份 PNG。导出按钮从 `disabled={overflow || blocked}` 改为 `disabled={!running && (overflow || blocked)}`：运行中的任务在最新稿件溢出或保存错误时仍可「查看导出」，只有新任务被挡住。冲突弹窗的「加载云端版本」改为「加载已保存版本」，与实际读取的对象一致。
- 320px：顶栏在 320 时比视口多 12px（返回、标题、保存/模板包/导出三组动作）。`apps/web/src/styles.css` 在 ≤360px 收窄 header 间距与按钮内边距，五个宽度都不再横向滚动。

### 验证

| 命令 | 结果 |
| --- | --- |
| `fp_antd_e2e T10 tests/e2e/{editor-mobile,editor-geometry,editor-richtext,editor-settings,autosave,export,templates}.spec.ts` | 23/23 PASS（每个文件独立新临时栈：4 + 1 + 4 + 5 + 4 + 2 + 3） |
| `pnpm exec playwright test tests/e2e/ui-controls.spec.ts` | 17/17 PASS（新临时栈；共享控件的布局/菜单/触摸回归） |
| `pnpm exec playwright test tests/e2e/editor-fonts.spec.ts` | 12/12 PASS（新临时栈；分组标签替换旧 `summary` 后仍覆盖字体校验、保存、重载与导出） |
| `pnpm exec playwright test tests/e2e/full-flow.spec.ts` | 3/3 PASS（新临时栈；混合排版、后台下架与离线草稿） |
| `pnpm exec vitest run packages/poster-editor` | 41/41 PASS |
| `pnpm test` / `pnpm typecheck` | 186/186 PASS / exit 0 |
| `pnpm build` | 8/8（保留既有的 >500kB chunk 警告，包体记录留给 T11） |
| 手动宽度核验（临时脚本，不入库） | 1440×1000、1024×768、768×1024、390×844、320×700 五档 `scrollWidth ≤ 视口`；截图在 `.cache/fastposter-antd-migration/T10/visual/`，含 390/320 的文字设置 sheet |

### 中途红灯与处理

- T10.1 的草稿用例先红在 `press("End")`：`End` 在 `NumberField` 是「跳到上界」的既有快捷键，草稿变成 `40965`（值 4096），不是把光标放到末尾。改为 `focus()` + `setSelectionRange(value.length, value.length)` 后再按 `5`，既保留用户的键位契约，又测到「继续输入未完成草稿」的原意。
- 手机字体菜单贴边断言红在 1.14px：弹层顶 `278.859`，sheet 内容顶 `280`，差值来自 sheet 的 1px 边框与菜单圆角。轮询容差从 0.5 调到 2px 并写明理由；断言仍是「菜单在 sheet 的滚动盒内」，没有放宽到任意溢出。
- `ui-controls` 的右边缘点击红在「字重仍为 400」：坐标本身是菜单矩形右缘 -15，但菜单还在 `ant-slide-up-appear` 的入场里，rc-trigger 挂载后还会重新对齐；记录的矩形是旧位置，裸 `page.mouse.click` 落到了后面的 `.text-panel`。用例改为先等可见下拉的 `opacity` 落定到 `1` 再取矩形点击，原意（短选项整行、右缘可点）不变。这不是产品回归：菜单稳定后同一点击正常选中。
- `ui-controls` 的触屏步进测试在 844 高度下点不到加号：新增的分组标签与作用域行把字号步进推到首屏之外，sheet 本身可滚动。用例先 `scrollIntoViewIfNeeded()` 再等按钮进入视口，保留「触摸按住/取消」的断言。
- 320px 顶栏横向溢出 12px（`scrollWidth 332`）：在 ≤360px 收窄间距后回到 320，四档布局的横向溢出检查全部通过。
- 位置/段落/效果的旧 `summary` 与堆叠面板改为受控分组：相关 e2e 在操作字段前先点「文字 / 段落 / 效果 / 位置」。这是 T10.4 的界面契约，不是放宽断言；每个分组仍验证原来的数值、边界与撤销行为。
- 手机 `openPoster` 拿不到工具栏的「添加文字」：phone 的创建入口在 sheet 顶部，helper 先点「文字设置」再点 sheet 内的「添加文字」，关闭 sheet 后返回首个文字块；桌面与平板仍走工具栏。

## T11 收尾、清理和完整验收

- 开工 HEAD `ceec4ec`；收尾代码提交 `e73aca3`，本文件随后以 docs 提交记录（执行账本留在已忽略的 `.superpowers/`，不入库）。覆盖 UI-01～UI-14 的收口，重点是 UI-05、UI-06、UI-10、UI-12、UI-13。
- 清理（T11.1）：`packages/ui` 移除 `@base-ui/react`（`pnpm-lock.yaml` −71/+4 行，全仓不再有 base-ui/floating-ui 旧浮层依赖）；删除无引用的 `packages/ui/src/Dialog.module.css` 与 `styles.css` 中已无调用方的 `.pagination`；`apps/web/src/styles.css` 删除迁移后无引用的 `.canvas-placeholder`、`.editor-footer`、`.editor-commandbar` 与 `.command-group` 规则；`apps/admin/src/features/Metadata.tsx` 的原生 `select` 改为共享 `Select`（`aria-label="筛选作品状态"`，三个选项与行为不变），删除死代码 `Pager`。
- 手机背景入口（spec 第 85 行）：phone 底部「背景」不再直接打开文件选择，而是打开 `更换背景` sheet，提供「上传图片」与「从背景库选择」；四个底部入口与顺序（文字/背景/文案/图层）不变。`editor-mobile.spec.ts` 新增第 5 例（先红后绿），`ui-baseline` 手机分支改走该路径。
- 字体搜索可读性：删除 `Select.module.css` 中对 `.ant-select-input` 的 `color: inherit`（antd 搜索态会把触发器文字设为透明，`inherit` 让输入的字也透明）；`editor-fonts.spec.ts` 增加输入文字计算色断言，先红后绿。
- 截图稳定性：`ui-baseline.spec.ts` 的 `settle()` 等到 antd motion 类清空、`document.getAnimations()` 的有限动画结束后再截图；冻结样式只在截图期间挂载，拍完移除。此前入场中的弹窗会被拍成 `opacity:0` 或 `0×0`。
- 触屏步进稳定性：`ui-controls.spec.ts` 的按住取消用例先等 sheet 静止底边等于视口高度，再派发 `touchStart`，消除入场动画期点空的偶发失败。

### 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm verify` | exit 0：契约与生成物一致、typecheck、Vitest 186/186、build 8/8 |
| `pnpm exec turbo run build --force` | 8/8（0 cached） |
| `node tools/check-entry-boundary.mjs …/entry-audit-after/{web,admin,renderer}` | web PASS（2 入口 chunk / 753 source）、admin PASS（4 / 740）、renderer PASS（1 / 35） |
| `pnpm exec playwright test --list` | 89 tests / 19 files（T01 基线 79 / 18；新增 `admin-layout.spec.ts`） |
| `pnpm test` | 186/186 PASS |
| `go test ./internal/...` | PASS |
| `pnpm exec antd lint packages/ui/src --version 6.7.0` | 0 deprecated / 2 已裁量 warning（T05 `virtual={false}`、T08 受控 `fileList` 无 `onChange`） |
| `pnpm exec antd lint apps/admin/src apps/web/src --version 6.7.0` | 0 issues |
| 固定样本导出对比 | `magick compare -metric AE` = `0 (0)`；前后 SHA-256 均 `f36c78f99c2d354c6dd2c4ee8f02cc645ee4988c9b03701c6af227d674c19e85`；1200×1600 PNG 8-bit |

逐文件 E2E（每个文件独立新临时栈，合计 89/89）：

| spec | 结果 | spec | 结果 |
| --- | --- | --- | --- |
| `admin-catalog` | 2/2 | `admin-layout` | 3/3 |
| `autosave` | 4/4 | `copy` | 1/1 |
| `editor-fonts` | 12/12 | `editor-geometry` | 1/1 |
| `editor-mobile` | 5/5 | `editor-richtext` | 4/4 |
| `editor-settings` | 5/5 | `export` | 2/2 |
| `full-flow` | 3/3 | `image-upload` | 1/1 |
| `notifications` | 6/6 | `project-permanent-deletion` | 13/13 |
| `projects` | 3/3 | `session-sync` | 2/2 |
| `templates` | 3/3 | `ui-baseline` | 2/2（22 张截图） |
| `ui-controls` | 17/17 | | |

- 截图证据：迁移后 22 张在 `.cache/fastposter-antd-migration/after/`；UI-13 宽度矩阵 17 张在 `.cache/fastposter-antd-migration/after-ui13/`（1440/1024/768/390/320 五档，含 1024 图层、768 文字设置与错误态、390/320 三张 sheet、1440 加载/焦点/空态）。
- UI-13 临时矩阵（不入库）：1/1 PASS；五档 `scrollWidth ≤ innerWidth`，1440 延迟响应截图、聚焦态与空搜索、768 断网错误态均符合预期。

体积变化（raw 字节精确；gzip 为 `gzip -9`，入口为单文件、总计为拼接后的单流）：

| 应用 | 口径 | 迁移前 raw / gzip | 迁移后 raw / gzip | 变化 |
| --- | --- | --- | --- | --- |
| web | 入口 chunk | 1,107,130 / 346,677 | 965,501 / 303,062 | −141,629 / −43,615 |
| web | 入口静态闭包 | 1,107,130 / 346,677 | 966,100 / 303,330 | −141,030 / −43,347 |
| web | 全部 JS | 1,107,130 / 346,677 | 1,543,210 / 483,666 | +436,080 / +136,989 |
| web | 全部 CSS | 40,762 / 8,983 | 39,169 / 8,656 | −1,593 / −327 |
| admin | 入口 chunk | 1,102,739 / 342,519 | 67,275 / 21,657 | −1,035,464 / −320,862 |
| admin | 入口静态闭包 | 1,102,739 / 342,519 | 857,285 / 274,365 | −245,454 / −68,154 |
| admin | 全部 JS | 1,102,739 / 342,519 | 1,776,129 / 557,596 | +673,390 / +215,077 |
| admin | 全部 CSS | 53,472 / 11,151 | 37,517 / 8,273 | −15,955 / −2,878 |
| renderer | 入口 = 全部 JS | 311,836 / 93,935 | 311,836 / 93,935 | 0 / 0 |

- 迁移前数值来自 `d6c3d45` 工作树的构建（单 chunk）；迁移后来自最终 `entry-audit-after`（`vite build --manifest --sourcemap`，映射文件不计）。web 首屏变小是因为 `ProjectWorkspace` 懒加载移出入口；总量变大是 antd 与共享控件的成本。
- admin 入口 chunk 67,275 B 需要与静态闭包一起读：首屏还会静态加载共享 `api-C0-2Y-Eh.js` 786,232 B（另有 3,179 B 的图标 chunk），所以首屏 JS 是 857,285 B，仍低于迁移前的 1,102,739 B。
- renderer 的 JS 与 gzip 字节完全一致，说明导出入口没有混入 antd 或 `@fastposter/ui`；入口边界检查同时锁住 web/admin 登录入口不含 Tiptap/ProseMirror。

### 已知限制

- 真机输入法与硬件触摸未覆盖：触摸用 Chrome DevTools Protocol `Input.dispatchTouchEvent` 合成，中文输入法/软键盘遮挡需在真机补测；本记录不把模拟结果当作真机结论。
- antd 6 的组件样式是运行期 CSS-in-JS，样式成本部分在 JS 里；本文件用计算样式与截图验证，不以 CSS 文件体积作为全部样式成本。
- `Workbench` 不做焦点陷阱、Escape 不关闭（T08）；读屏用户在模板工作区内的 Tab 顺序不受限，关闭必须是显式动作。
- 后台首屏 857,285 B 仍可继续优化：把 antd/共享依赖拆成独立缓存 chunk 属计划外工作。
- `project-permanent-deletion` 的手机上传 helper 已按 T10 的 sheet 创建入口适配；桌面路径未变。

### 中途红灯与处理

- `ui-baseline` 手机先在工具栏「背景库」超时：phone 没有该按钮，属产品缺口（spec 第 85 行）。新增 `更换背景` sheet 后，`editor-mobile` 5/5、`ui-baseline` 2/2。
- 基线截图里的弹窗不可见或为 `0×0`：`settle()` 改为等 antd motion 类与有限动画结束后再冻结；冻结样式只在截图期间存在，拍完移除。
- 字体搜索输入的文字透明：`color: inherit` 继承了 antd 搜索态的透明色；删除后计算色断言通过。
- `ui-controls` 触屏按住偶发读回 64：sheet 还在入场，触摸点落空；改为轮询静止底边后整文件 17/17。
- UI-13 临时矩阵的短暂 410px 溢出与半程截图：用 `expect.poll` 等布局稳定，320/390 的 sheet 截图按视口底边轮询，截图前留 300ms 沉降。
- T11.1 的状态筛选改为共享 `Select` 后，`project-permanent-deletion` 的原生 `selectOption` 失效：按新契约改 `chooseOption`/`selectValue`，13/13 复跑；这是测试适配，不是放宽断言。

### 覆盖对照（T01–T10 → UI-13）

| UI-13 行 | 证据 |
| --- | --- |
| 登录/权限/重定向 | T02/T06 账号页；`full-flow` 3/3、`session-sync` 2/2 |
| 搜索/分页/返回恢复 | T09 `projects` 3/3；T07 `admin-layout` 3/3、`project-permanent-deletion` 13/13 |
| 删除/冲突/草稿 | T09/T10 `project-permanent-deletion`、`autosave` 4/4、`notifications` 6/6 |
| 图片/背景/模板/文案选择 | T08/T09 `admin-catalog` 2/2、`copy` 1/1、`templates` 3/3、`image-upload` 1/1 |
| 1440/1024/768/390/320 + 触摸 | T10 + T11 宽度矩阵 1/1、`editor-mobile` 5/5、`ui-controls` 17/17 |
| 字体/颜色/拖拽/历史 | T04–T06/T10 `editor-fonts` 12/12、`editor-geometry` 1/1、`editor-settings` 5/5、`editor-richtext` 4/4 |
| 加载/空/失败/导出 | T11 宽度矩阵与 `ui-baseline` 2/2、`export` 2/2 |
| PNG 像素与入口边界 | `AE=0`、SHA-256 一致；web/admin/renderer 三站 boundary PASS |
