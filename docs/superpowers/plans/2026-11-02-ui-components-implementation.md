# FastPoster UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Base UI 和 CSS Modules 完善用户站、后台、编辑器的控件细节，保留现有小清新风格与业务行为。

**Architecture:** 第三方原语仅存在于 `@fastposter/ui`，业务层消费本项目的封装。保留页面布局 CSS，组件内部逐步改用 CSS Modules，共用根级主题变量与一致的弹层层级。先建立基线，再迁移基础、选择器、编辑器和弹层，每一步同步更新真实用户操作的测试。

**Tech Stack:** React 19、TypeScript、Vite、pnpm workspace、`@base-ui/react`、CSS Modules；Vitest node 环境与现有 Playwright 浏览器栈。

**Spec:** `docs/superpowers/specs/2026-11-02-ui-components-design.md`（用户已批准）。

## Global Constraints

- 仅在 `@fastposter/ui` 添加 `@base-ui/react`，业务组件不直接依赖其内部结构；安装时核实版本和 React peerDependencies，使用精确版本。
- 保留页面布局、字体栈、现有文字层级、留白、卡片、导航、海报画布和主要控件外框尺寸。
- 森林绿主按钮 `#335b40`、淡绿色边框 `#dde5d5`、6px 按钮圆角、12px 弹窗圆角；页面底色 `#f7f8f5`。
- 不同时加入 Tailwind，也不进行全项目样式重写。主题变量使用 `--fp-*`。
- 触屏沿用至少 44px 的点击目标；遵循 reduced-motion。
- Dialog/BottomSheet 保留现有 title/onClose/className 接口；不增加拖拽关闭手势。
- 文件输入、系统颜色选择器、语义链接、表格和 CategoryTree 不机械替换；不改 API、数据库、自动保存策略或服务端。
- 保护现有未提交修改，尤其 CopyPicker 与 copy E2E；提交不得混入其他任务。开始实施时再次确认工作树状态，必要时按文件/补丁精确暂存。
- 当前 E2E 使用真实隔离测试栈；不新增 jsdom、Testing Library 或产品内演示路由，仅为测试引入的组件行为在真实浏览器中验证。

## Review Focus

1. Select 中真实空字符串、禁用的混合状态、异步选项和五级分类变化：正确显示与过滤，不把空字符串当作未选值丢弃；Task 3。
2. 临时空值、`-`、小数、非法粘贴与外部值更新：不将未完成输入写入海报，Escape/失焦按约定恢复；Task 4。
3. Tiptap 选区在 Select/Tooltip/Toggle 操作与移动端弹层中保留，修改只作用于选区，撤销仍有效；Tasks 4–6。
4. Portal 内菜单的 Delete/Escape/撤销按键不传给画布，嵌套弹层只关闭最上层并恢复正确焦点；Tasks 4–5。
5. Button 默认 type 改动后，登录/密码/后台保存仍可提交；图标与次要动作不意外提交，Portal 不丢失主题；Tasks 2、5。

## File Structure

- `packages/ui/src/tokens.css`：根级主题与层级变量；`styles.css` 保留兼容类、spinner 和少量公共规则。
- `Button.tsx`、`Form.tsx`、`Status.tsx` 及各自 `*.module.css`：现有接口的实现；`Input.tsx`/`Input.module.css`：可复用 TextInput、Textarea。
- `Select.tsx`/`Select.module.css`：强类型选择器；`NumberField.tsx`/`NumberField.module.css`：带草稿状态的数字控件；`number-draft.ts`/`.test.ts`：数字分类与范围校验。
- `Dialog.tsx`、`BottomSheet.tsx`、`Dialog.module.css`：模态与底部弹层；`Tooltip.tsx`/`.module.css`、`ToggleButton.tsx`/`.module.css`：提示与格式状态；IconButton 在 `Button.tsx` 导出。
- `packages/ui/src/css-modules.d.ts`：无 Vite 环境的 CSS Modules 类型；`index.ts` 为唯一公共出口。
- `packages/poster-editor/src/keyboard.ts`/`.test.ts`：编辑快捷键保护；原有 Editor、Stage、panels 仅修改控件与必要的选区处理。
- `tests/e2e/ui-controls.spec.ts`：在现有登录/作品/编辑页面验证交互；`helpers.ts` 加选择器操作辅助函数。原有 E2E 随对应消费方迁移，不等最后统一修复。
- `docs/verification/ui-components.md`：基线、截图路径、包体与最终结果；运行输出放被忽略的 `test-results/ui-components/`，不把临时原型当产品基线。

---

### Task 1: Capture the existing UI and build baseline

**Files:** Create `docs/verification/ui-components.md`；运行产物 `test-results/ui-components/before/`（不提交）。

**Interfaces:** Consumes approved spec and existing E2E helpers. Produces fixed viewport/data recipes, before screenshots and per-app JS/CSS raw/gzip totals.

- [ ] **Step 1:** 用只读 git 命令确认目录、分支和 worktree；执行 using-git-worktrees 的环境判断。若新建隔离工作树，不得遗漏当前用户改动所包含的功能；不得以切换干净 HEAD 导致基线功能倒退。
- [ ] **Step 2:** 运行 `pnpm typecheck`、`pnpm test`、`pnpm build` 记录基线输出；记录 web/admin/renderer 的 JS、CSS、gzip 大小，使用相同文件集合和统计方法。
- [ ] **Step 3:** 在现有 Playwright 隔离栈内，按 `helpers.ts` 的注册/导入流程，使用 `tests/fixtures/images/editor.png` 和固定文案。采集桌面 1440×1000、移动 390×844 的登录、作品列表、库弹窗、编辑面板与后台素材表单截图；等待字体与数据完成，关闭动画，固定可见数据。
- [ ] **Step 4:** 文档写明每张图的视口、路径、操作和可见数据；如果已有测试/业务栈失败，记录根因后先隔离于本次变更，不能把失败写成通过。
- [ ] **Step 5:** 仅提交基线记录：`git add docs/verification/ui-components.md`，提交 `docs: record UI migration baseline`。此任务不创建测试镜像实现，只保留真实基线证据。

### Task 2: Introduce styled primitives and preserve form submission

**Files:** Modify `packages/ui/package.json`、`pnpm-lock.yaml`、`packages/ui/src/{Button,Form,Status}.tsx`、`packages/ui/src/index.ts`、`packages/ui/src/styles.css`；Create `packages/ui/src/{tokens.css,css-modules.d.ts,Input.tsx,Button.module.css,Form.module.css,Status.module.css,Input.module.css,form-contract.test.ts}`；Modify `apps/web/src/features/auth/PasswordPage.tsx` 与审计发现的真实 submit 调用；Create `tests/e2e/ui-controls.spec.ts`。

**Interfaces:**
- `ButtonProps` 保留现有原生 button 属性、`variant`、`busy`，新增 `density?: 'normal' | 'compact'`，默认 type=button。
- `IconButton(props: ButtonProps & { 'aria-label': string }): ReactElement`；ref 可传递，保留 pointer 事件。
- `TextInput(props: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; density?: 'normal'|'compact' }): ReactElement`；Textarea 使用相应原生 textarea 属性。
- `FormField` 保留现有接口，支持 `error?: ReactNode`、传入 id/ref，正确合并 aria-describedby；内部使用 Field/Input。

- [ ] **Step 1:** 用 `React.createElement` 和现有 `renderToStaticMarkup` 风格写 `form-contract.test.ts`，断言普通 Button 为 `type="button"`、显式 submit 保留、busy 为 disabled/aria-busy、传入字段 id 不被覆盖、hint/error 的 id 包含在 aria-describedby 中。此测试不依赖 DOM 模拟。
- [ ] **Step 2:** 运行 `pnpm exec vitest run packages/ui/src/form-contract.test.ts`，确认测试因缺少新契约失败，而非路径/环境错误。
- [ ] **Step 3:** 查实际 registry 版本/peerDependencies，在 UI 包以 `pnpm --filter @fastposter/ui add --save-exact @base-ui/react@<核实版本>` 安装。将原样式值转为 tokens 和 Modules；各 tsconfig 均能读取 CSS Modules 声明，按需通过类型入口引用，不依赖消费者的 Vite 声明。
- [ ] **Step 4:** 实现接口，保留 `.button` 等现有页面选择器所需的兼容钩子；审查每个 `<form>` 内 Button，显式标注 submit，重点修正 PasswordPage 当前隐式提交按钮。Textarea 保留原生语义；不改文件和颜色 input。
- [ ] **Step 5:** E2E 增加 `password form submits explicitly and secondary actions do not submit`，登录后进入现有密码页面，断言正确提交反馈，次要动作不触发密码请求；保留注册/登录流程原断言。
- [ ] **Step 6:** 运行上述单测、`pnpm exec playwright test tests/e2e/ui-controls.spec.ts tests/e2e/projects.spec.ts`、`pnpm typecheck`、`pnpm --filter @fastposter/ui build`。全部通过后精确提交 `feat(ui): add Base UI form and button primitives`。

### Task 3: Replace catalog and admin Select controls

**Files:** Create `packages/ui/src/{Select.tsx,Select.module.css}`；Modify `packages/ui/src/index.ts`、`apps/web/src/features/{templates/TemplatePicker,catalog/BackgroundPicker,catalog/CopyPicker}.tsx`；Modify `apps/admin/src/features/{Resources,templates/TemplateList,templates/TemplateEditor,copy/CopyForm}.tsx`；Modify `apps/web/src/styles.css`、`apps/admin/src/styles.css`；Modify `tests/e2e/helpers.ts`、`tests/e2e/{copy,templates,admin-catalog,ui-controls}.spec.ts`。

**Interfaces:**
- `SelectOption<T extends string|number> = { value:T; label:string; disabled?:boolean }`。
- `Select<T>(props: {options:readonly SelectOption<T>[]; value:T; onValueChange:(value:T)=>void; id?:string; name?:string; 'aria-label'?:string; 'aria-labelledby'?:string; disabled?:boolean; required?:boolean; className?:string; density?:'normal'|'compact'}): ReactElement`。不向业务发送 null，不伪造 DOM ChangeEvent；混合值通过显式禁用选项表示。
- `chooseOption(page:Page, label:string, optionLabel:string): Promise<void>` 在 helpers 导出；通过可访问 trigger 和 Portal 中 role=option 操作，不能限定选项一定在 dialog DOM 子树。

- [ ] **Step 1:** 在 copy E2E 保留现有五级分类流程，补充上级切换后下级清空、选择“全部分类”后恢复结果的断言；ui-controls 增加 `catalog selects support keyboard selection and Escape`，验证方向键/Enter 和 Escape 不更改已选值。
- [ ] **Step 2:** 运行 `pnpm exec playwright test tests/e2e/copy.spec.ts tests/e2e/ui-controls.spec.ts`，确认新选择器契约断言失败；保留已有业务断言，不先删除 selectOption 的测试覆盖。
- [ ] **Step 3:** 实现 Base Select 封装、选项显示、长文本截断、选中标记、菜单宽度和边缘可用高度；空字符串作为真正选项显示。沿用根变量和紧凑/普通尺寸，使用自定义属性获取 anchor width/available height。
- [ ] **Step 4:** 迁移上述页面，保留 setPage(1)、级联路径截断、异步选项与 value 类型。后台字体字重等 number 与字符串的转换在消费方明确完成。同步移除该批次对原生 select 标签的样式依赖。
- [ ] **Step 5:** 将对应 E2E 中 selectOption 改成 chooseOption；toHaveValue 改为可见标签及业务结果断言。加长分类名和异步分类返回场景，确认当前值显示正确、菜单可滚动、选择禁用项不可提交。
- [ ] **Step 6:** 运行 `pnpm typecheck`、`pnpm build`，以及上述 copy/templates/admin-catalog/ui-controls E2E；完整保留用户已有 copy 测试改动，精确暂存本次补丁后提交 `feat(ui): migrate catalog and admin selects`。

### Task 4: Make editor numbers, selections and shortcuts robust

**Files:** Create `packages/ui/src/{NumberField.tsx,NumberField.module.css,number-draft.ts,number-draft.test.ts}`；Modify `index.ts`；Create `packages/poster-editor/src/{keyboard.ts,keyboard.test.ts}`；Modify `packages/poster-editor/src/{Editor,Stage}.tsx`、`panels/{TextPanel,ParagraphPanel,StylePanel}.tsx`、`styles.css`；Modify `tests/e2e/{editor-richtext,editor-geometry,full-flow,admin-catalog}.spec.ts`、`ui-controls.spec.ts`。

**Interfaces:**
- `classifyNumberDraft(raw:string,min?:number,max?:number): {kind:'pending'}|{kind:'invalid'}|{kind:'valid';value:number}`；空白、`-`、`.`、`-.`、尾部小数点是 pending，不隐式转 0；范围外/非有限/非法字符为 invalid；合法有限数含负数和小数。
- `NumberField(props:{value:number|null;onValueChange:(value:number)=>void;min?:number;max?:number;step?:number;'aria-label':string;id?:string;className?:string;density?:'normal'|'compact';placeholder?:string;disabled?:boolean}):ReactElement`；null 表示混合，onValueChange 仅发有效数字。默认不添加额外步进按钮。
- `isEditorShortcutBlocked(context:{defaultPrevented:boolean;isComposing:boolean;editableTarget:boolean;interactiveTarget:boolean;overlayOpen:boolean}):boolean` 是纯逻辑；`shouldIgnoreEditorShortcut(event:KeyboardEvent):boolean` 在浏览器中提取上下文。忽略 defaultPrevented、IME、input/textarea/select/contenteditable、项目 UI 控件/Portal 交互范围，及文档中打开的模态/选择弹层。标记来自封装的明确 `data-fp-*`，不依赖库私有类名。原 mode=edit 保护保留。

- [ ] **Step 1:** table-driven `number-draft.test.ts` 固定断言 `''/'-'/'.'/'1.'` 为 pending，`'0'`/`'-12.5'` 合法，`'NaN'/'Infinity'/'1x'` 非法，`'4097'` 在 1–4096 下非法；`keyboard.test.ts` 测纯函数，各上下文标记分别为 true 时返回 true，全 false 时返回 false；不在 node 环境构造 DOM。
- [ ] **Step 2:** 运行 `pnpm exec vitest run packages/ui/src/number-draft.test.ts packages/poster-editor/src/keyboard.test.ts`，验证缺失实现导致失败。Portal DOM 层级等不伪造 node 环境，在下一步 E2E 验证。
- [ ] **Step 3:** 基于 Base NumberField 实现本地草稿与有效值通知；pending/invalid 不写 model，Enter/失焦验证，失败恢复外部有效值或混合空显示，Escape 恢复。外部 undo/选中文字块变化要刷新草稿，不能复用旧块字段值。有效数值即时更新预览，保留现有 min/max/step，包括动态 padding 上限。
- [ ] **Step 4:** 迁移字体/字重/缩放 Select 和字号、文本框宽度、段落、效果数字输入。用 keyboard guard 保护编辑全局按键；将 TextPanel 当前样式/选区快照保护接入选择器打开/选择行为，保持 Tiptap 文档与选区应用规则。
- [ ] **Step 5:** 新增真实浏览器断言：字距设为 12 后清空不变成 0、失焦恢复 12；输入 -2.5 可生效；字号超出 4096 不写文档；Escape 恢复；撤销/切换文字块刷新字段。`selectScenery` 选中“风景”后改字体/字号，验证“你好”样式不变且撤销可恢复。
- [ ] **Step 6:** 字体菜单打开时按 Escape 只关菜单、按 Delete 不删除文字块；缩放选择后画布几何与存储文档尺寸不变。同步迁移 full-flow/editor-geometry/admin-catalog 的字体/缩放 selectOption 与 value 断言。
- [ ] **Step 7:** 运行该任务单测、`pnpm typecheck`、`pnpm --filter @fastposter/poster-editor build` 和 richtext/geometry/full-flow/admin-catalog/ui-controls E2E。通过后提交 `feat(editor): migrate controls and preserve selection semantics`。

### Task 5: Unify modal and bottom-sheet behavior

**Files:** Modify `packages/ui/src/{Dialog,BottomSheet}.tsx`、`styles.css`；Create `Dialog.module.css`；Modify 弹窗定位相关 `apps/web/src/styles.css`、`apps/admin/src/styles.css`、`packages/poster-editor/src/styles.css`；Modify `tests/e2e/{ui-controls,editor-mobile,templates,autosave,export}.spec.ts`。

**Interfaces:** `Dialog({title,children,onClose,className='',...internal}:existing props & optional internal focus/layout props):ReactElement`；BottomSheet 消费同一内部模态组件，公开现有参数不变；两者可使用同一关闭/焦点策略，不手动覆盖库的模态机制。

- [ ] **Step 1:** ui-controls 添加 `select in template dialog closes before its parent and restores focus`、`modal traps focus and restores trigger after closing`；mobile 添加底部设置面板打开字体菜单、选择后保留“风景”选区范围，并验证无横向滚动。迁移前运行并记录新行为差异。
- [ ] **Step 2:** 用受控 Base Dialog Root、Portal、Backdrop、Popup、Title、Close 替换 showModal；保留 title 语义和 busy 时调用方拒绝关闭的能力。去掉 ::backdrop/top-layer 定位假设，用显式 center/bottom 变体保持原布局、视口高度、安全区和内部滚动。
- [ ] **Step 3:** 管理初始焦点和 finalFocus，覆盖无对应库 Trigger 的现有外部按钮；触发器已卸载时不调用失效节点。嵌套弹层的遮罩/滚动锁/焦点恢复由库策略管理；适配 Task 4 keyboard guard 的打开状态标记。
- [ ] **Step 4:** 检查 Portal 根主题变量、字体、菜单与弹窗 z-index、窄屏避让和滚动时定位；兼容既有 template-picker/export-dialog 等 className 的宽度规则。
- [ ] **Step 5:** 验证 Tab/Shift+Tab 被限制、Escape 只关闭最上层、遮罩关闭正确、关闭恢复触发器、页面滚动恢复、导出进行中可关闭后重新打开；移动端样式只作用于原选区，画布尺寸不变。
- [ ] **Step 6:** 运行 `pnpm typecheck`、`pnpm build` 和 ui-controls/editor-mobile/templates/autosave/export E2E，通过后提交 `feat(ui): unify dialogs and mobile sheets`。

### Task 6: Polish toolbar states and finish form adoption

**Files:** Create `packages/ui/src/{Tooltip,ToggleButton}.tsx` 和对应 Modules；Modify `index.ts`；Modify `packages/poster-editor/src/panels/{TextPanel,ParagraphPanel,StylePanel}.tsx`、`Editor.tsx`；Modify `apps/web/src/features/{projects/ProjectsPage,projects/ProjectList,projects/ProjectWorkspace,templates/TemplatePicker,catalog/BackgroundPicker,catalog/CopyPicker}.tsx`、`apps/admin/src/features/{Resources,Metadata,templates/TemplateList,templates/TemplateEditor,copy/CopyPage,copy/CopyForm}.tsx` 与样式中对应控件规则；Modify `tests/e2e/{ui-controls,editor-richtext,editor-mobile,copy}.spec.ts`。

**Interfaces:** `Tooltip({label:string,children:ReactElement}):ReactElement`；`ToggleButton(props:Omit<ButtonProps,'onChange'> & {pressed:boolean;onPressedChange:(pressed:boolean)=>void;tooltip?:string}):ReactElement`，触发器不可嵌套 button，保留 aria-label/ref/pointer 事件。普通动作使用 Button/IconButton，格式开关才使用 ToggleButton。

- [ ] **Step 1:** richtext 增加 `format toggles preserve selected range and announce pressed state`，断言选区加粗只修改“风景”、再次切换恢复；ui-controls 验证聚焦图标显示 Tooltip，Escape 隐藏，禁用动作不执行。迁移前确认缺失提示/选区回归的测试确实捕获目标行为。
- [ ] **Step 2:** 使用 Base Tooltip/Toggle 构建封装。图标提示不得成为唯一可访问名称；触屏必要功能有可见说明，不依赖 hover；保留格式按钮 pointerdown 防止编辑选区丢失。
- [ ] **Step 3:** 迁移格式/对齐开关、适用图标动作；剩余 search/text/textarea 和普通按钮采用共享封装。保留领域卡片/树节点的复合结构和语义；checkbox 可保留原生语义并统一状态样式，不引入无必要包装。
- [ ] **Step 4:** 将依赖 `.panel-field input/select`、`.picker-filters input/select` 的外观收敛到显式变体/类；保留布局与复合卡片规则。保留 FormField type=number 的标准事件接口，但后台存在会把空值立即提交为数字的独立字段时，在消费方改用 NumberField，保留表单标签与 min/max。
- [ ] **Step 5:** 搜索残留原生控件，逐项记录保留理由（文件、颜色、必要的 checkbox 等）；检查表单 type、label、hint/error，所有禁用状态、reduced-motion 与触屏点击目标。
- [ ] **Step 6:** 运行 `pnpm typecheck`、`pnpm test`、`pnpm build` 和 ui-controls/richtext/mobile/copy/admin-catalog E2E，通过后提交 `feat(ui): finish component adoption and interaction polish`。

### Task 7: Verify the full migration and record evidence

**Files:** Update `docs/verification/ui-components.md`；按真实缺陷必要修改上述拥有该行为的文件；截图/构建统计放 `test-results/ui-components/after/`。

**Interfaces:** Consumes all public wrappers, baseline recipes and existing acceptance suites. Produces completed validation record and bounded final diff.

- [ ] **Step 1:** 按 Task 1 同条件采集 after；逐张检查布局、颜色、字体、留白、海报尺寸，明确允许变化为菜单、反馈和微交互；任何额外变化修正后重新核对受影响截图。
- [ ] **Step 2:** 执行 `pnpm typecheck`、`pnpm test`、`pnpm build`；重新统计相同 JS/CSS/gzip 集合，记录各应用增量，核查只引入实际使用的库入口；renderer 体积/样式或像素结果发生变化时追踪并恢复非预期依赖。
- [ ] **Step 3:** 运行 `pnpm test:e2e` 完整前端套件。既有 session-sync/copy 测试与本次功能一并验证；遇到失败采用 systematic-debugging 定位并归属，不擅自改服务端或减弱断言。无法运行时记录命令、具体错误及未验证范围。
- [ ] **Step 4:** 检查 `rg -n 'selectOption|toHaveValue' tests/e2e`，仅在真正保留原生输入的场景保留；检查业务层不直接 import Base UI。审阅 diff，确认不改导出文档结构、API/后端和用户既有改动。
- [ ] **Step 5:** 按 verification-before-completion 核对实际输出，按 requesting-code-review 获取一次完整变更审阅；修复有效问题并重跑受影响测试。文档记录真实浏览器覆盖范围，不把模拟移动视口写成真实手机验证。
- [ ] **Step 6:** 仅提交本任务文档/修复，提交 `docs: record UI component migration verification`；通过 finishing-a-development-branch 汇报改动、测试、截图与残余限制，不自动合并、推送或发布。

## Plan self-review

- Spec coverage：基础接口/Modules → Task 2；筛选/分类 → Task 3；数字、字体、选区/快捷键 → Task 4；模态/手机 → Task 5；格式提示和剩余控件 → Task 6；样式、包体、渲染/导出与全套回归 → Tasks 1、7。
- Type consistency：业务 Select 使用 onValueChange，Input/FormField 保持原生 onChange；NumberField 公开有效数字通知，null 只用于混合显示；内部草稿校验不向业务发 null 或伪造事件。
- Review Focus 的五类风险都有拥有代码的任务与真实浏览器断言；纯函数/静态语义使用现有 node Vitest，不新增测试框架。
- 任务间依赖：1 → 2 → 3 → 4 → 5 → 6 → 7。共享接口和样式关联紧密，推荐在当前会话由同一实施者连续执行，最后独立审阅。
