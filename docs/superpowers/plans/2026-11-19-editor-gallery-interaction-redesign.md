# FastPoster 渐变与卡片交互实现计划

> 执行时按任务使用 test-driven-development，并在整合后做独立代码复核。

**目标** 交付已确认的颜色编辑交互和三处卡片优化。

**结构** 共享编辑器使用一个颜色弹层，渐变色值计算与控件拆开。背景库用可见的 Image 封面拥有预览，回收站和后台沿用已有卡片外观和操作服务。

**技术栈** React、TypeScript、Ant Design 6.7.0、Vitest、Playwright。

**设计** [FastPoster 渐变与卡片交互重设计](../specs/2026-11-19-editor-gallery-interaction-redesign.md)

## 跨任务约束

沿用 antd 默认主题与 Font、v1/v2 文档契约、保存事务、公共和管理端权限。保留当前工作区的渐变默认开放修改。前端改动定向格式化。创建背景保持资源复查，替换保持原有异尺寸确认，永久删除维持既有安全确认。

## 重点检查

- 清空角度和色标位置会恢复最近有效值。覆盖 0° 边界、小数回显和与滑动同步。
- 两个同位置色标需要能分别选中。覆盖带透明度的色标、切换类型和小屏触摸。
- 渐变层拥有键盘时，Esc 逐层退出。覆盖未改值、嵌套取色器、未保存的取消、切换选区和撤销后保存。
- 原图 404、缩略图 404、选中项变版要保留对话框操作。覆盖焦点回归和预览与选用隔离。
- 回收站长标题及后台不同发布状态的卡片保持操作可达。覆盖 320px 到 1440px 的按钮边界和高亮。

### 任务 1 · 共享颜色编辑

**文件** `packages/poster-editor/src/panels/TextColorField.tsx`、`TextPanel.tsx`、新增同目录的渐变控件和样式及色值工具，`tests/e2e/editor-richtext.spec.ts`。必要时在共享 BottomSheet 增加可选的开放态属性。

- [x] 添加色值工具单测及新版入口浏览器用例，先验证继承旧纯色、环绕角度、最大间隔的插值色标和同位置编辑用例失败。
- [x] 用一个受控弹层注册键盘作用域。桌面 Popover 左开，≤680px BottomSheet。颜色、方向和提交动作用相同子面板。
- [x] 渐变控件提供方向盘、径向坐标板、色标轨道与序号选择，复用 antd InputNumber、Button、ColorPicker 和 Segmented。类型转换沿用色标，维护会话内角度和圆心记忆。用画布和字样预览显示即时结果。
- [x] 保持一笔控制事务和文本选区。类型或选区变化后保留适当范围 ID，Esc 先关取色器，再取消渐变编辑。用新版交互入口重跑现有渐变和纯色事务用例。

### 任务 2 · 用户站背景库

**文件** `apps/web/src/features/catalog/BackgroundPicker.tsx`、相应卡片样式、`tests/e2e/projects.spec.ts` 和 `full-flow.spec.ts`。

- [x] 先在用例中要求 Image 封面本身是预览入口，无独立可见的预览文字按钮。
- [x] Ant Design Image 同时承担缩略图和大图，使用 cover、previewUrl 和受控原图，加入键盘焦点与版本变化时的回退。用卡片信息区按钮处理创建或替换。
- [x] 核对创建、替换、原图请求、404 与焦点断言，以及长标题和窄屏卡片排版。

### 任务 3 · 回收站和后台素材卡片

**文件** `apps/web/src/features/projects/ProjectList.tsx`、`apps/web/src/styles.css`、`apps/admin/src/features/Resources.tsx`、`apps/admin/src/styles.css`、对应单测或浏览器验收。

- [x] 增加桌面回收站按钮同排及大小断言，增加背景卡片编辑、发布和删除均描边的断言。
- [x] 回收站采用描边，44px 只用于触屏。管理站仅背景卡片统一三个等高描边按钮及卡片布局。
- [x] 检查 320px 长标题、按钮触达、删除确认、发布冲突和字体页面原有按钮行为。

### 任务 4 · 整体验收

- [x] 按 spec 检查 1440、1024、768、390、320px。实测共享编辑器与两个背景入口，输出截图。
- [x] 运行 `pnpm verify`、受影响的 Playwright 用例、`git diff --check`。记录实际通过或待解决的验证项。
- [x] 独立审阅共享弹层关闭、状态手势与卡片边界，在验收记录中写明结论和源码范围。
