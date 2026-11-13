# FastPoster Ant Design Remediation A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Ant Design 迁移后的用户站、管理站和共享编辑器问题，并让用户从已发布背景直接创建海报。

**Architecture:** 共享 UI 负责视觉尺度、等待反馈和弹层生命周期。共享编辑会话管理选区、手势和草稿。页面沿用现有 API，独立管理创建、分页、冲突和失败恢复。后台资源事务单独放在 B 批。

**Tech Stack:** React、TypeScript、antd 6.7.0、TanStack Query、Tiptap、Vitest、Playwright、Go/MySQL 临时测试栈。

**Spec:** [迁移后修正规范](../specs/2026-11-06-antd-post-migration-remediation-design.md) · [B 批计划](2026-11-06-antd-remediation-b-implementation.md)

## 授权和接续

状态为 `PLANNED`。用户已同意进入计划编写，实施须另有明确指示。选择 A 批实施不会授权 B 批。用户批准执行后，再启用所选实施技能和工作区隔离流程。审查基线是 `124b4ea5d2dc7b1b58183749a393a3c4759fe47b`，执行基线由届时 HEAD、工作树状态和用户已有改动共同确认。当前修正规范、两个计划和原布局规范需要一起可读。此前未跟踪的分析和原型仅供对照。交付中的规范引用要能从新检出解析。

在 A01 开始时创建 `docs/verification/2026-11-06-antd-remediation.md`。A/B 共用一个执行记录，按批次分区。开始、暂停、验证失败、交接或完成时更新以下字段。此处示例不代表执行已开始。

```yaml
batch: A
status: PLANNED # PLANNED | IN_PROGRESS | BLOCKED | VERIFIED
authorization: null
execution_mode: null
workspace: null
branch: null
baseline: null
last_verified_commit: null
task: A01
next_step: A01.1
spec_ids: [FP-04, FP-14]
actual_paths: []
red: []
green: []
decisions: []
artifacts: []
blockers: []
```

恢复时先读最新用户指示、`AGENTS.md`、spec FP-00/13/14、本计划全局约束和当前任务。用 `git status --short`、`git rev-parse HEAD`、`git diff --stat`、`git diff --cached --stat` 核对记录。发现别人已完成的工作先按需求检查，不覆盖、不重复实施。标记用例 `PASS`、`FAIL`、`SKIP`、`BLOCKED`，写出命令、退出码、用例数和证据路径。只有实际结果满足本任务及其关联需求才勾选。跨任务依赖、业务契约和范围偏移写明依据，独立工作继续按已授权范围完成。

## Global Constraints

- A 批使用现有 API、权限、数据模型和路由。保留作品文档格式、账号隔离、字体字形检查、保存、回收站和 PNG 渲染。用户站与后台共享 `UIProvider`、`Editor`，renderer 独立。
- 固定 `antd@6.7.0`，使用共享主题和公开语义插槽。内容表面 `#FFFFFF`，工作区 `#F3F5F4`，画布外围 `#E6EAE7`，主要文字 `#202C25`，辅助 `#526159`，主操作 `#2E694F`，危险色 `#A63232`。普通文字对比度 ≥4.5:1。
- 常规控件 36px、桌面紧凑 32px、触控主操作 ≥44×44px。页面标题 24–29px，区域标题 14–16px，正文及常规值 14px，标签 13px，说明、单位和状态 12px，触控文本输入 16px。标签间距 4–8px，字段组间 12–16px，面板内边距 12–16px。视口 1440/1024/768/390/320px。
- 用真实会话、请求、文档、revision 和可见性作为断言。每个新行为先在当前基线看到预期失败，构建、限流和选择器错误不得算作红灯。保留已有行为用例及项目自有 DOM 标记。
- 开工环境先构建 renderer，`pnpm --filter @fastposter/renderer build`。浏览器使用 `pnpm test:e2e <单个 spec 文件> -g '<测试名>'`，每个命令有独立临时栈，测试写入仅使用仓库保护器和 `fastposter_test_*`。单文件达到注册限流时按互斥测试组再分栈。禁止用业务库、清空生产限流或复用不明进程。
- 修改过的前端文件按仓库要求定向 Prettier。每个任务完成后看完整 diff，仅按任务文件暂存，记录该任务的验证，再做一个聚焦提交。Git 写入受限时保留工作树及实际状态并记录未提交，暂存和测试通过分开记录。

## Review Focus

1. 用户打开嵌套字体菜单时启用减少动效，两次 Escape 应分别退出菜单和抽屉并解除滚动锁。A01。
2. 手机打开属性面板时，靠下文字在可见区响应调整，关闭后恢复打开前的手动视图。A02。
3. 颜色值停顿超过 650ms 后更改，删除再撤销应恢复最后有效颜色，而非旧块草稿。A03。
4. 已发布背景在确认前下架或改版，清除选择且保留筛选，零创建请求。A06。
5. 创建已由服务端提交但响应断开，点击刷新只读列表，旧账号请求完成不得触发新账号跳转。A05。

---

## 文件边界与顺序

| 任务 | 需求                | 主要责任边界                   | 前置                    |
| ---- | ------------------- | ------------------------------ | ----------------------- |
| A01  | FP-04               | 共享浮层、工作台隔离、手机焦点 | 环境就绪                |
| A02  | FP-07               | 共享编辑操作、Stage 可见区域   | A01                     |
| A03  | FP-08               | 手势所有权、数值草稿及保存     | A02                     |
| A04  | FP-01、FP-03        | 共享主题、Select 和属性区视觉  | A01，最终截图在 A10     |
| A05  | FP-06               | 项目创建操作与两步上传重试     | A01                     |
| A06  | FP-05               | 入口、背景选择器、复用创建操作 | A05                     |
| A07  | FP-02               | 加载组件及两站真实等待入口     | A03、A04、A06           |
| A08  | FP-09               | 分页、查询成功判断与改名冲突   | A05，收敛同一作品页改动 |
| A09  | FP-10               | 管理重置会话、完整分类读取     | A01、A06                |
| A10  | FP-12、FP-13、FP-14 | 文档、五档矩阵、导出、完整证据 | A01–A09                 |

按上表顺序为默认。共享 `Editor.tsx`、`ProjectsPage.tsx`、后台资源页以及 `tests/e2e` 同一文件的修改由同一时点合入，执行者避免并行改同一条边界。

### A01 让缩减动效下的浮层和键盘恢复可用

**文件**：`packages/ui/src/{UIProvider.tsx,styles.css,Dialog.tsx,BottomSheet.tsx,Workbench.tsx,modal-layer.ts}`、`packages/poster-editor/src/Editor.tsx`、`apps/admin/src/{AdminLayout.tsx,features/templates/TemplateEditor.tsx,features/templates/TemplateList.tsx}`、`apps/web/src/features/projects/ProjectWorkspace.tsx`。测试用 `tests/e2e/{ui-controls,editor-mobile,templates,admin-layout}.spec.ts`。若需命令外层容器，保持其所有权在壳层，不给浮层栈增第二套全局状态。

**接口**：沿用 `registerModalLayer(element, { blocksShortcuts })`，工作台容器不屏蔽自己的编辑命令。给来源切换使用可选焦点回退 `restoreFocusTo?: () => HTMLElement | null`，仅在原触发器不存在或被隔离时选用。手动把焦点归还稳定的后台列表入口或手机底栏背景按钮。

- [ ] **A01.1** 建立执行记录。验证 renderer、测试 DSN 保护、Chrome 和临时端口，记录实际基线，保留产品样式未改动的正常/缩减动效对照。
- [ ] **A01.2** 在现有 spec 写 `reduced motion leaves overlays usable`、`workbench contains tab focus and keeps editor shortcuts`、`mobile background picker returns focus to background tool`。矩阵包含卡片 Dropdown、Select、字体、ColorPicker、Modal、Drawer 和提示交互。断言 `expect(popup).toBeVisible()` 后实际点击或按键，连续 Escape 各关一层，最终 `expect(body).not.toHaveCSS("overflow-y", "hidden")`。工作台反向 Tab 留在内部，关闭后回归触发或等价入口。
- [ ] **A01.3** 逐文件按测试名运行。记录缩减动效出现 0×0 或无法完成点击、工作台焦点外泄和手机焦点落到 BODY 的对应失败。
- [ ] **A01.4** 在共享 provider 按 `matchMedia("(prefers-reduced-motion: reduce)")` 初始化并订阅变化，通过现有 antd 公开动效 token 接入。把应用自己的动画规则限定到自有组件，移除影响 rc-motion 的全局强制规则。实际处理每种浮层的可见、结束、滚动锁与提示生命周期。
- [ ] **A01.5** 在模板工作台挂载期间隔离底层导航和列表，将 workbench 挂到隔离容器之外的同级或 portal，保证底层列表和侧栏不可聚焦。Tab 在活动工作台内循环，嵌套浮层取得焦点后暂停工作台的循环处理。保留显式关闭、可编辑快捷键和稳定焦点回退。手机背景选择用存活的底栏按钮作回退。
- [ ] **A01.6** 复跑三项新增用例和 `ui-controls`、`editor-mobile`、`admin-layout`、`templates` 相关现有用例。按批次记录结果并提交 `fix(ui): preserve overlay behavior with reduced motion`。

### A02 恢复手机撤销并让属性面板下的选区可见

**文件**：`packages/poster-editor/src/{Editor.tsx,Stage.tsx,geometry.ts,styles.css,panels/EditorInspector.tsx}`、`tests/e2e/editor-mobile.spec.ts`、`packages/poster-editor/src/geometry.test.ts`。已有几何模块持有视图数学，Editor 管理手机面板生命周期，Stage 读取和呈现。

**接口**：共用现有 `store.undo`、`store.redo` 和 `state.canUndo/canRedo`。面板将计算出的可见区域作为 Stage 的 `visibleViewport?: Rect` 纯视图输入。新增 `fitSelectionIntoViewport(view: ViewTransform, bounds: Rect, viewport: Rect): ViewTransform`，其中 `Rect = Point & Size`，计算时将选区边界换算到 Stage 局部视口坐标。

- [ ] **A02.1** 写 `phone can undo and redo after deleting a text block`、`phone inspector keeps lower selection visible and restores the view`、`add text capacity is the same on mobile and desktop`。320px 和 390px 测试实触控删除后 `expect(blocks).toHaveCount(0)`，撤销后为 1，再重做为 0。检查命中区域两轴 ≥44px。放置靠下文字，用变换后可见交集和属性值变化证明实时反馈，关闭抽屉后比对手动视图。用 100 块固定文档核对禁用且无写入。
- [ ] **A02.2** 运行 `pnpm test:e2e tests/e2e/editor-mobile.spec.ts -g 'phone can undo|phone inspector keeps|add text capacity'`，确认缺少历史入口或画布被遮住导致失败。
- [ ] **A02.3** 在手机画布工具条增加具名 44px 撤销、重做。将字体就绪、100 块、选区和文案忙碌规则置于共享操作判断。桌面和手机共用回调与禁用原因，抽屉打开时底层按 A01 焦点规则处理。
- [ ] **A02.4** 基于 Stage、手机抽屉、可视视口和安全区的实际交集，在开面板前保存手动视图，优先平移、必要时缩放。大块显示当前编辑行或有效选区的可见部分。尺寸改变时使用新尺寸适配。所有调整只走 `setView`，不得写文档和历史。
- [ ] **A02.5** 复跑新增用例、`pnpm exec vitest run packages/poster-editor/src/geometry.test.ts` 及 `tests/e2e/editor-geometry.spec.ts`。记录 320/390 和模板工作台对照后提交 `fix(editor): restore phone history and selection visibility`。

### A03 统一编辑手势和数值草稿

**文件**：`packages/poster-editor/src/{Editor.tsx,store.ts,history.ts,text/RichTextEditor.tsx,panels/ColorField.tsx,panels/TextPanel.tsx,panels/StylePanel.tsx,panels/ParagraphPanel.tsx}`、`packages/ui/src/NumberField.tsx`、`apps/web/src/features/editor/{useProjectAutosave.ts,autosave.ts}`。`useProjectAutosave` 与 `autosave` 仅在既有事务传递不足时改动。测试用 `packages/poster-editor/src/store.test.ts`、`tests/e2e/{editor-settings,editor-richtext,autosave,export,editor-fonts}.spec.ts`。

**接口**：编辑器会话的事务所有者区分富文本输入和外部控件。事务句柄携带会话、目标和唯一身份，`finish(handle, "commit" | "cancel")` 只结束仍匹配的事务。现有 `NumberDraftBinding` 改传 `NumberDraftSnapshot = { raw: string; baseline: number | null; lastValid: number | null }`，会话侧将它和事务身份关联。共享控件保留无草稿绑定调用者的本地行为。结束事务仍由 `onInteractionChange` 传到自动保存。

- [ ] **A03.1** 写 `color gesture owns range changes until close`、`unmodified picker does not block export`、`number Escape after resize restores original baseline`、`deleting a block discards its suspended number draft`。实测整块与选区两次有效改色，中间超过 650ms。关前写入请求计数为 0，关闭后一次撤销回原色。选区换目标和删除前结束旧手势，撤销删除保留最后有效色。数值从 0 输入 12 再追加小数点，跨断点后 Escape 为 0。快捷键删除再撤销只恢复有效值。
- [ ] **A03.2** 逐文件运行匹配测试，记录意外保存、撤销拆分或草稿回退不正确等预期红灯。
- [ ] **A03.3** 让 ColorField 首次有效变更才取得事务句柄。普通关闭、Escape 或切目标在原目标提交，未改变的打开/关闭无写入。RichTextEditor 的定时器和 blur 只结束自身事务，外部样式更新仍更新真实选区和内容，旧定时回调不能提交新事务。
- [ ] **A03.4** 将完整数值快照绑定到编辑会话和属性目标，重挂载继续同一输入。主动换目标按失焦整理，Escape 按会话起值取消。两种删除入口读取当前 store 的选区并清草稿。退出、账号变化、远端彻底删除沿用 spec 的原作用域草稿处置，避免迟到回调。
- [ ] **A03.5** 复跑新增测试以及上述现有 spec，另跑 `pnpm exec vitest run packages/poster-editor/src/store.test.ts apps/web/src/features/editor/autosave.test.ts`。保留长按取消、IME、字形预检、草稿冲突与已保存 revision 导出证据。提交 `fix(editor): scope gestures and drafts to the edit session`。

### A04 收敛主题、Select 和属性面板的视觉规则

**文件**：`packages/ui/src/{theme.ts,tokens.css,styles.css,Select.tsx,Select.module.css,Combobox.tsx,Combobox.module.css}`、`packages/poster-editor/src/{styles.css,panels/ColorField.tsx,panels/ColorField.module.css}`、`apps/{web,admin}/src/styles.css`。视觉边界只涉及作品页头部、用户/模板工作台、后台同类表单与弹层。测试用 `tests/e2e/ui-controls.spec.ts`。

**接口**：保留共享 Button/Select/Combobox 的现有 props，样式使用共享语义尺寸和颜色，页面类仅安排布局。保留 `data-fp-select-value`、`data-fp-control` 等现有交互与测试约定。

- [ ] **A04.1** 写 `antd action buttons have no resting shadow`、`closed select values share the trigger center`。按钮静止态 `expect(button).toHaveCSS("box-shadow", "none")`，Tab 后有可见焦点。读取控件、文字容器和箭头的中心，`expect(Math.abs(valueCenter - triggerCenter)).toBeLessThanOrEqual(2)`。覆盖字号、中文字体、预设色、空值、禁用、长值、字体搜索及后台分类。
- [ ] **A04.2** 运行 `pnpm test:e2e tests/e2e/ui-controls.spec.ts -g 'resting shadow|trigger center'`。确认当前 2px 阴影、约 7.1px 垂直偏差。
- [ ] **A04.3** 在 `theme.ts` 将 default/primary/danger 三种阴影 token 设为 `none`。共享选择框的有效内容容器垂直居中。若不能用公开槽位，依赖 antd 内部类的规则集中在 CSS Module 并加原因。展开态保留可用菜单宽度、对齐与长值截断。
- [ ] **A04.4** 用全局约束的尺寸、色值和间距收敛属性区及相同界面状态，保留原四组。触控数字与实际文本输入 16px。控制 320px 顶栏溢出，必要时具名「更多」容纳低频动作。色样分棋盘底和真实色前景。确认样式不作用到海报文档节点。
- [ ] **A04.5** 复跑 `ui-controls` 新旧用例，覆盖左右留白、垂直居中、展开滚动、焦点和选择行为。记录一张长值、一张透明色样对照，提交 `fix(ui): align shared controls and inspector typography`。

### A05 让创建和上传在失败时可以安全接续

**文件**：新增 `apps/web/src/features/projects/project-creation.ts`、`project-creation.test.ts`，修改 `ProjectsPage.tsx`、`../templates/TemplatePicker.tsx`，复用 `apps/web/src/api.ts` 及会话作用域。测试用 `tests/e2e/{image-upload,templates,session-sync}.spec.ts`。

**接口**：`ProjectBackground = Pick<AssetDTO, "id" | "version" | "width" | "height">`，`buildProjectFromBackground(title: string, asset: ProjectBackground): CreateProjectInput`。构造既有 schemaVersion、canvas、background、空 `fonts` 和 `textBlocks`。从文件名取标题时按 120 个 Unicode 码点和控制字符约束整理，空值回退「未命名海报」。本地流程持有上传完成的素材结果；背景库调用相同构造和创建入口，模板仍用原接口。

- [ ] **A05.1** 写 `retrying known create rejection reuses uploaded asset`、`unknown creation outcome only refreshes list`、`stale create reply cannot navigate after account change`。注入明确可恢复拒绝后，断言上传 POST 一次、Create POST 两次、两次引用相同。模拟服务已接收但响应断开后，返回和重新加载只读列表。覆盖模板应用及 ZIP 响应不明，连续操作只允许一个在途写入。单测覆盖长中文、控制字符、空标题和原始尺寸。
- [ ] **A05.2** 逐个执行上述 spec 的新增测试。确认旧实现重复上传或跳转、无法区分已提交结果。
- [ ] **A05.3** 将本地流程改为选择、上传、持有素材、创建、结果五个阶段。提交锁同步建立，收集当前用户、操作 ID 与页面有效期。明确拒绝保留可恢复的已上传素材。仅已知未提交的失败可重试写入。超时、断连、未能确认结果的服务端错误统一进入「结果未确认」，仅给重新加载作品列表操作。
- [ ] **A05.4** 在背景创建的公用入口及模板应用/导入接入相同未知结果规则与迟到响应保护。正常失败依原入口呈现，退出或切换账号隔离通知、缓存更新和导航。保留现有 40 MiB 和模板包限制。
- [ ] **A05.5** 复跑 `pnpm exec vitest run apps/web/src/features/projects/project-creation.test.ts` 与 A05 三个 E2E 文件，分别记录真实栈和注入失败。提交 `fix(web): separate upload and project creation recovery`。

### A06 提供背景库创建与替换的共用交互

**文件**：`apps/web/src/features/projects/{ProjectsPage.tsx,ProjectList.tsx,ProjectWorkspace.tsx}`、`apps/web/src/features/catalog/BackgroundPicker.tsx`、`tests/e2e/{projects,admin-catalog,editor-mobile,image-upload}.spec.ts`、`tests/e2e/helpers.ts`。必要时更新使用「选用」旧按钮的测试，保留真实入口和行为断言。

**接口**：背景选择器增加 `mode: "create" | "replace"` 与 `onChoose: (asset: AssetDTO, resource: ResourceDTO) => void | Promise<void>`。创建使用 A05 接口。稳定选中身份为资源 ID、资源版本、素材 ID、素材版本。替换调用者继续把已确认素材送入现有异尺寸预检和事务。

- [ ] **A06.1** 写 `gallery creates at the published background dimensions` 和 `create clears a selection that changes in the catalog`。顶部和空态均能到达来源选择。点取消时上传与创建计数均为 0。实际发布并以普通用户选中、确认。核对零本地上传、文档原始宽高和背景版本、打开返回 ID 并可重开。改筛选、已下架、改版及复查失败分别核对选中、错误与筛选保留。
- [ ] **A06.2** 运行 `pnpm test:e2e tests/e2e/projects.spec.ts -g 'gallery creates|create clears'`。确认基线的新建仍直接打开文件选择器或缺少新入口。
- [ ] **A06.3** 由顶栏和空态统一打开来源选择。「上传本地图片」在点击的用户激活内打开文件选择器，取消后无写入并恢复焦点。拖放继续直接导入。「从背景库选择」显示单选卡片和「用此背景创建」，提供返回来源、空目录、搜索、分类及分页。
- [ ] **A06.4** 确认时重新读取同一公开目录查询。响应仅在同一账号、查询与选中身份内可用。选中失效时清除并说明。正常后把返回的资产元数据和资源标题传给 A05 创建。既有作品用「替换背景」和原异尺寸确认。A 批保留复查与写入之间的现有授权窗口。
- [ ] **A06.5** 分别复跑 `projects`、`admin-catalog`、`editor-mobile`、`image-upload`、`templates`。保留模板、拖放、同尺寸与异尺寸替换/撤销、已引用背景下架后可用的证据。提交 `feat(web): start posters from the published background library`。

### A07 全站等待态改用 Ant Design

**文件**：新增 `packages/ui/src/LoadingState.tsx`，修改 `packages/ui/src/{index.ts,Button.tsx,ToggleButton.tsx,button-appearance.ts,ProjectDeletion.tsx,styles.css}`。用户站检查 `apps/web/src/main.tsx`、`features/projects/{ProjectsPage,ProjectWorkspace,ProjectList}.tsx`、`features/catalog/{BackgroundPicker,CopyPicker}.tsx`、`features/templates/TemplatePicker.tsx`、`features/export/ExportDialog.tsx`、`features/editor/SaveStatus.tsx`。后台检查 `apps/admin/src/main.tsx`、`features/templates/{TemplateList,TemplateEditor}.tsx`、`features/copy/{CategoryTree,CopyList}.tsx`、`features/{Resources,Metadata,ExportJobs}.tsx`。相邻 CSS 只清理该批已替换的等待视觉。测试新增 `tests/e2e/loading-states.spec.ts`。

**接口**：`LoadingState({ label, size }: { label: string; size?: "small" | "default" | "large" })` 封装区域 `Spin` 和一处可访问状态。网格直接用 antd Skeleton，操作用 Button loading，后台表格保留 Table loading。业务组件控制何时使用等待、错误、空或离线，`Status` 继续表示真实提示。

- [ ] **A07.1** 写 `waits render antd loading and keep their own outcomes`。分别延迟会话、懒加载、作品、草稿、字体、背景/文案/模板目录、后台表格、文件上传、导出和清理请求。使用公开角色检查等待文案，并核对区域内为 antd 等待组件、无 `Alert type=info` 等待块、无重复状态。验证失败有重试，成功空结果有空态，刷新不展示其他查询的记录。
- [ ] **A07.2** 运行 `pnpm test:e2e tests/e2e/loading-states.spec.ts`，记录旧蓝块、自绘动画或空态提前出现的证据。测试按场景分组确保单栈注册量。
- [ ] **A07.3** 实现共享区域 LoadingState、首屏网格 Skeleton 和操作 Button loading。减少动效时使用可识别静态等待表现，保持单一状态播报。移除被替代的自绘 spinner/骨架逻辑，保留已有错误、任务轮询和焦点语义。
- [ ] **A07.4** 用 `rg -n 'spinner|project-skeleton|正在(打开|加载|载入|检查|准备)|<Status' apps/web/src apps/admin/src packages/ui/src packages/poster-editor/src` 做全入口清点，将每个动态等待路径记入执行记录。分别验证首次、局部刷新、可恢复错误、离线和任务完成。
- [ ] **A07.5** 复跑新增测试及导出、清理、通知和控件回归。提交 `fix(ui): standardize loading states on Ant Design`。

### A08 按真实分页结果恢复页面，并处理并发改名

**文件**：`apps/web/src/features/projects/{ProjectsPage.tsx,collection-position.ts,collection-position.test.ts,useProjectDeletion.ts}`、`apps/admin/src/features/{records.tsx,Resources.tsx,Metadata.tsx,templates/TemplateList.tsx,copy/CopyPage.tsx,projects/pagination.ts}`。测试用 `tests/e2e/{projects,project-permanent-deletion,admin-catalog,templates,copy}.spec.ts`。

**接口**：用户站沿用 `lastValidPage`，后台沿用 `pageAfterShrink`，输入来自当前查询的成功结果。已完成页面数据才参与校正。改名使用同一 `ProjectDTO` 快照上的 `document` 和 `revision`，只改标题。

- [ ] **A08.1** 写 `failed second page stays on page two and retries it`、`deleting final second-page row returns to page one`、`rename conflict resubmits latest document only after confirmation`。覆盖作品和删除队列的失败/成功，后台背景、模板、文案同类缩页。第 2 页失败后重试请求 page=2，成功 25→24 后请求 page=1。并发请求先改文字，再提交改名，保留用户标题，旧版本请求不循环。显式确认后校验 payload 的 document 和 revision 都来自最新快照。
- [ ] **A08.2** 每个相关 spec 单独运行目标用例，记录旧列表回页、空态锁死或旧 revision 重复发送。
- [ ] **A08.3** 只用成功且对应当前账号、筛选和页码的响应校正页码。失败保留本页与重试，旧查询回包不覆盖位置。对成功缩页、过滤和滚动恢复分开处理。
- [ ] **A08.4** 改名冲突时保留输入和显示最新标题。读取成功后等待显式确认，再用新快照和该次输入提交。再次冲突继续留在流程中。关闭、切账号或作品被删除后失效，迟到响应不恢复旧弹窗。
- [ ] **A08.5** 复跑 `pnpm exec vitest run apps/web/src/features/projects/collection-position.test.ts apps/admin/src/features/projects` 及上述 E2E。记录请求序列并提交 `fix(web): recover pagination and rename conflicts safely`。

### A09 保存重置结果并补齐分类分页

**文件**：`apps/admin/src/{main.tsx,AdminLayout.tsx,features/Metadata.tsx,features/Resources.tsx,features/templates/TemplateList.tsx,features/templates/TemplateEditor.tsx,features/copy/CopyPage.tsx,features/copy/CategoryTree.tsx}`，`apps/web/src/features/{catalog/BackgroundPicker.tsx,catalog/CopyPicker.tsx,templates/TemplatePicker.tsx}`。共享分页读取新增 `packages/api-client/src/catalog-pages.ts` 与同名测试，导出自现有 API 客户端入口。测试用 `tests/e2e/{admin-layout,admin-catalog,copy,templates}.spec.ts`。

**接口**：`loadCatalogPages(fetchPage: (page: number, pageSize: number) => Promise<CatalogReply>): Promise<ResourceDTO[]>`，调用者绑定自己的公开/后台 route、账号、kind 和信号。固定单页上限 100，按 ID 去重，并对提前空页、重复导致的总数不一致或请求失败返回可重试错误。发布父节点不可见是公开树的正常情况，后台缺父级须提示不完整。密码重置中的操作状态及结果交由管理站授权会话内存持有，并为应用内导航提供忙碌约束。

- [ ] **A09.1** 写 `reset token remains visible after delayed success`、`catalog includes category 101 and cross-page ancestry`、`published copy child without visible parent remains selectable`。延迟重置请求后尝试取消、遮罩、Escape 和导航，仍在原流程，POST 仅一次。成功可访问令牌，合成测试令牌不写日志或产物。分类单测断言两页、失败、稳定总量和 ID 去重，E2E 检查后台完整树、公开顶层回退和分类可选。
- [ ] **A09.2** 逐文件运行测试，确认重置结果丢失或后续分类不可见。用 `pnpm exec vitest run packages/api-client/src/catalog-pages.test.ts` 定向记录分页规则。
- [ ] **A09.3** 完成重置会话状态。成功前禁用重复确认，直至点击「完成」前阻止应用内导航隐藏重置流程。成功后可复制并明确完成。未确认结果提示核对并通过现有流程再次签发。外部页面关闭、刷新或会话失效后清理，不持久化令牌，不把秘密放进截图或 trace。
- [ ] **A09.4** 接入分页读取函数，覆盖资源/模板/背景选择器及文案树。完整读取前不公布树。公开树把缺可见父级的已发布节点作为根，带上可见后代。后台完整读取后缺父则标记不完整。查询失败可重试并保持相应作用域。
- [ ] **A09.5** 复跑新增单测、上述 E2E 与重置登录回归。记录模拟与真实 API 的区别。提交 `fix(admin): keep reset results and complete catalog filters`。

### A10 把验收、视觉证据和维护入口一起交付

**文件**：`AGENTS.md`、`README.md`、`deploy/toolchain.lock.json`、`docs/verification/2026-11-06-antd-remediation.md`、`tests/e2e/ui-baseline.spec.ts`。原布局规范作为实施必需参考，与本规范和计划一起交付，或在同一次文档提交中把必需契约写入可追踪文件。原实施计划、分析与原型是历史资料，仅保留实际可访问的交付链接。PNG 采样入口复用 `tests/e2e/export.spec.ts`。

**接口**：沿用 `FP_UI_BASELINE`、`FP_UI_BASELINE_OUT` 与 `tools/check-entry-boundary.mjs`。沿用已有 `FP_EXPORT_BASELINE_PATH` 导出采样钩子，将固定用例的下载字节写入指定位置。视觉证据包含测试夹具、构建版本、运行参数与截图路径。记录 A 批结果及 B 批实际状态。

- [ ] **A10.1** 扩展可跟踪的五档视觉用例。1440×1000、1024×768、768×1024、390×844、320×700 分别记录作品、编辑器、模板后台、设置、加载、失败和浮层等代表状态。断言 `document.documentElement.scrollWidth <= innerWidth`、选区可见及关键操作可达。人工核对字体、字号、色样、对比度与触控目标。
- [ ] **A10.2** 更新三份维护文档和验收入口。写明共享 provider、antd 版本、renderer 隔离、背景库入口、手机历史、截图开关、逐文件临时测试栈、预构建 renderer 和当前 Chrome 设置方式。区分历史验证与当前结果。
- [ ] **A10.3** 运行 `pnpm verify`。按下方命令逐 spec 执行 E2E，并单独执行截图 spec。记录真实用例数与跳过原因。相关代码未通过用例时回到拥有该需求的任务定位。
- [ ] **A10.4** 构建带 manifest 和 sourcemap 的三入口临时产物并审计。以 `FP_EXPORT_BASELINE_PATH=/绝对路径/sample.png pnpm test:e2e tests/e2e/export.spec.ts -g 'flushes latest edits and previews the exact native PNG'` 采样。审查基线 `124b4ea` 在单独临时工作区采样，已自带该钩子。两边各自构建 renderer，使用同一合成文档、字体、Chrome 和运行环境。记录尺寸、SHA-256，并运行 `magick compare -metric AE baseline.png current.png null:`，固定样本预期像素差为 0。
- [ ] **A10.5** 对照 FP-13 把证据映射到 FP-01 至 FP-10、FP-12。核对 diff、格式、引用与隐私后将 A 批记录为 VERIFIED 或实际阻塞状态，提交 `docs: record verified Ant Design remediation`。B 批按其自己的门槛处理。

```bash
set -euo pipefail
pnpm --filter @fastposter/renderer build
pnpm verify
review_output="$(mktemp -d)"
printf 'Evidence directory %s\n' "$review_output"
rg --files tests/e2e -g '*.spec.ts' | sort | while IFS= read -r spec_file; do
  if [ "$spec_file" != tests/e2e/ui-baseline.spec.ts ]; then
    suite="${spec_file##*/}"
    pnpm test:e2e "$spec_file" --output "$review_output/results/$suite" \
      2>&1 | tee "$review_output/$suite.log"
  fi
done
FP_UI_BASELINE=1 FP_UI_BASELINE_OUT="$review_output/screenshots" \
  pnpm test:e2e tests/e2e/ui-baseline.spec.ts --output "$review_output/results/ui-baseline" \
  2>&1 | tee "$review_output/ui-baseline.log"
for app in web admin renderer; do
  pnpm --filter "@fastposter/$app" exec vite build --manifest --sourcemap --outDir "$review_output/$app"
done
node tools/check-entry-boundary.mjs "$review_output/web" "$review_output/admin" "$review_output/renderer"
```
