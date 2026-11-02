# FastPoster 组件基础迁移与细节完善

日期：2026-11-02。状态：用户已于本日回复“可以”批准方案；尚未安装依赖或修改产品代码。

## 意图与已确认约束

用户认为许多现有控件不够精致，存在细节问题，希望调研组件库并实际替换。页面必须保留当前小清新风格。用户同意先看浏览器中的细节示意。

下面的库、样式方案和迁移范围由本次调研提出，现已获用户批准。工作量属于跨用户站、后台与共享编辑器的项目，下一步制定实施计划。

## 代码现状与证据

- React 19、TypeScript、Vite、pnpm workspace；用户站、后台、renderer 独立构建。
- 已有 `packages/ui`，提供 Button、FormField、Dialog、BottomSheet、Status，但没有第三方组件交互基础。
- `packages/ui/src/styles.css` 定义森林绿主按钮 `#335b40`、淡绿色边框 `#dde5d5`、6px 按钮圆角、12px 弹窗圆角。这些数值是迁移基准。
- `apps/web/src/styles.css` 使用 `#f7f8f5` 页面底色；后台直接导入该文件；编辑器和 UI 都使用全局类名。样式存在跨包依赖，但不能仅凭这一点断言已经发生样式污染。
- 模板/背景/文案筛选、后台资源表单、字体/字重/缩放使用原生 select：关闭时已有定制样式，展开面板仍主要由浏览器/系统决定。
- `StylePanel.tsx` 和 `ParagraphPanel.tsx` 直接 `Number(e.target.value)`；清空字符串会变成 0，在允许零值的字段上可立即提交。此结论来自源码，尚未进行浏览器复现。
- `TextPanel.tsx` 已对格式按钮使用 `onPointerDown.preventDefault()` 保护编辑器选区，迁移必须保留这一行为，不能无条件套用新的焦点逻辑。
- 当前 Dialog 使用原生 `showModal()`，已经具备浏览器提供的模态能力和 Escape 处理。采用库不是为了补一个“完全没有焦点管理”的缺陷，而是统一可组合的弹层、下拉、层级和状态处理。
- 已有 E2E 大量使用 `selectOption()`，迁移自定义选择器后必须改为用户可见的选择操作，并继续断言实际业务结果。
- 当前工作树已有用户的未提交改动，包括 Session、CopyPicker、copy E2E 和服务端文件。实施时尊重这些改动，不覆盖、不回滚、不混入其他任务。

本次尚未启动业务栈、核验业务页面或测量包体。浏览器示意是独立 HTML 原型，左侧只按现有 CSS 复刻控件，不是产品截图；右侧也不是 Base UI 已集成的运行效果。

## 选型比较

判断维度：保留视觉的能力、现有控件覆盖、交互可组合性、接入与维护成本。以下成本比较是针对本仓库的工程判断，不是性能测量或库质量排名。

| 候选 | 官方能力及与仓库的关系 | 判断 |
| --- | --- | --- |
| Base UI | 无样式；支持 CSS Modules；提供 Button、Field/Input、Select、NumberField、Dialog、Tooltip、ToggleGroup；提供键盘与焦点管理 | 首选：在一个库中覆盖本次最相关的控件，样式继续由项目控制 |
| Radix Primitives | 无样式、可渐进接入，Dialog/Select/Tooltip/ToggleGroup 等适配需求 | 可用备选；对本次数字输入和基础输入仍需要另行封装 |
| React Aria Components | 无样式，丰富的表单与集合组件，国际化和输入适配能力 | 可用备选；对于当前仓库，集合与交互 API 的迁移面预计更大；不是说它必然更重或更慢 |
| Mantine | 支持 CSS Modules，也可通过 HeadlessMantineProvider 使用无样式模式 | 技术可行；采用现成主题需重新校准风格，headless 模式则需要额外理解其样式相关限制 |
| Ant Design | Design Token 和组件级主题定制能力完整 | 适合强调现成后台规范的情况；本项目需同时贴合创作界面，保持现有尺寸、字体和外观的调整面预计更大 |
| shadcn/ui | 可修改的组件源码分发方案，常规接入配合 Tailwind，底层可选 Base UI 或 Radix | 本项目已有共享 UI 包，直接封装无样式原语更直接；不额外接入另一套默认视觉和源码模板 |

建议：仅在 `@fastposter/ui` 添加 `@base-ui/react`，业务组件不直接依赖其内部结构。落地时核实实际可安装版本与 React peerDependencies，锁定确切版本并更新 pnpm lockfile。官方页面显示的版本不代替安装验证。只通过真实构建产物记录引入成本，不给未经测量的 KB 承诺。

CSS Modules 与 Tailwind 都不能替代组件交互库。这里建议 CSS Modules，因为可以逐条迁移既有 CSS，减少大面积改写 JSX；不同时加入 Tailwind，也不进行全项目样式重写。

## 设计与范围

### 视觉约束

保留页面布局、字体栈、现有文字层级、留白、卡片、导航、海报画布和主要控件外框尺寸。以现有颜色和数值提取 `--fp-*` 变量，不趁迁移重新设计主题。维持普通按钮与编辑面板控件的尺寸差异，通过 normal/compact 等组件参数表达。

可改善的细节限定为：同色系菜单项高亮与选中标记、统一箭头与图标对齐、清晰的 focus/disabled/busy 状态、错误提示关联、短时柔和的状态过渡。保持当前小圆角与克制阴影，不变成大圆角卡片或高饱和主题。遵循 reduced-motion；触屏沿用至少 44px 的点击目标和可用的输入文字大小。

### 共享 UI 边界

1. Button 保留 primary/secondary/ghost/danger、busy、disabled 与原有调用方式；新增明确的 IconButton/Tooltip 封装。普通动作默认 type=button，登录/保存表单显式 type=submit，逐一审查 submit 行为。
2. FormField 基于 Field/Input 统一 label、hint、error、id 和 invalid 状态；保留标准 React `onChange` 调用契约。TextInput/Textarea 暴露必要的标准属性和 ref。Textarea 若无匹配原语则保留原生语义并统一样式，不为“全替换”制造无用依赖。
3. Select 使用显式 options/items、value、onValueChange，不伪造 ChangeEvent。覆盖动态选项、空字符串“全部”、禁用“混合”占位、数字 value 映射、长标签和异步空选项。对字体这种可能较长的选项集，若当前数据规模需要再采用同库 Combobox，不默认增加搜索交互。
4. NumberField 处理草稿输入、null/空值、负数、小数、min/max/step；编辑中允许清空和临时的负号/小数，失焦或 Enter 时验证提交，Escape 恢复最后有效值。有效数值的实时更新沿用原来的即时预览；未完成和非法值不写入海报文档；失焦仍为空则恢复旧值。保留当前小巧外观，不强加额外步进按钮。
5. Dialog/BottomSheet 保留现有 title/onClose/className 接口，在内部替换模态原语。Escape、遮罩点击、滚动锁定、初始焦点、关闭后的焦点恢复和嵌套弹层交由一致的策略处理。BottomSheet 本次保持现有底部面板交互，不增加拖拽关闭手势。
6. 格式/对齐按钮按需接入 Toggle/ToggleGroup，图标提示接入 Tooltip；保留选区、混合状态及已有快捷键，不把一般动作按钮误改成切换控件。
7. Status、分页、空状态、列表卡片保留语义与页面布局，仅复用新的按钮/输入/提示基础。文件输入、系统颜色选择器、语义链接及真正的表格不机械替换成无必要的库控件。

### 迁移覆盖

- `packages/ui`：上述共享封装与组件级 `*.module.css`；保留有限的兼容类和现有对外接口，帮助逐步迁移。
- `apps/web`：登录/密码、作品列表搜索、模板/背景/文案库筛选、导出及草稿/冲突弹窗。
- `apps/admin`：登录、文案、资源、模板与元数据表单中的适用输入/选择/弹窗/图标操作。CategoryTree、数据表格结构和领域行为沿用现有实现。
- `packages/poster-editor`：字体/字重/缩放 Select，字号/段落/效果数字输入，格式和对齐按钮的状态及提示。画布尺寸、拖拽、缩放计算、Tiptap 文档、渲染与导出不改。

### 样式过渡与弹层兼容

保留 reset、字体、主题变量、页面布局 CSS；共享控件内部样式迁移为 Modules。原有 `.panel-field select`、`.picker-filters input`、`.dialog` 等依赖 DOM 标签和全局类的选择器必须审计，并迁移到显式 className/variant；不能仅替换 JSX 后假定样式继续生效。清理样式时只删除已验证无引用的规则。

Portal 的主题变量放在 document root 可继承范围，避免脱离页面父节点后丢失颜色和字体。统一层级规则，验证 Dialog 内 Select/Tooltip 的定位、指针事件、屏幕边缘避让与滚动；从原生 dialog 迁移时同步移除依赖 ::backdrop/top layer 的假设，防止新旧弹层互相遮挡。

编辑器应在弹层/交互控件处理按键时跳过全局 Delete/Escape/撤销快捷键，避免选择菜单项触发画布操作；不能只依赖 stopPropagation，也需要编辑器端按 target/defaultPrevented/弹层状态判断。记录并恢复编辑选区，关闭弹层后按交互来源恢复到触发器或编辑器，不无条件调用 editor.focus()。

## 验收与实现边界

1. 实施前在同一浏览器、相同视口与相同业务数据下采集基线；覆盖登录、作品、库弹窗、编辑侧栏和后台表单，桌面与移动宽度均有记录。完成后做同条件对照，允许变化仅限本方案列明的控件细节；未批准的布局/配色/字体/画布变化应恢复。当前 HTML 示意不作自动化截图基线。
2. Select 验证鼠标、触屏模拟和键盘，覆盖空值、禁用、长选项、动态分类与边缘弹出。改写相关 `selectOption()` 用例为打开控件、选择可访问选项，并验证过滤/编辑结果。
3. 验证 Dialog 的 Tab/Shift+Tab、Escape、遮罩、恢复焦点、滚动锁及嵌套库选择；仅关闭最上层，不误触下面的页面。
4. NumberField 验证清空、负数、小数、上下限、非法粘贴与恢复；字体/字重/粗斜体/对齐改变后，选中文字与整块文字的应用范围符合原逻辑，撤销仍可用。
5. CSS Modules 类型声明必须被根 tsconfig 和 UI/编辑器独立构建覆盖；不依赖只有 Vite dev 才存在的类型。按实际需要新增声明。
6. 运行 `pnpm typecheck`、`pnpm test`、`pnpm build`，以及覆盖模板、文案、编辑器、移动端、后台和导出的相关 E2E。共享 UI 包影响多应用，最终执行完整前端 E2E；业务栈若无法运行，报告具体阻塞，不能声称已完成验收。
7. 以安装前后相同生产构建比较 JS/CSS 与 gzip 大小，并在必要时调整导入；不引入与本次无关的全部组件。海报 renderer 的 DOM/CSS 与导出结果保持一致，必要时执行现有几何/导出回归。

不改 API、数据库、自动保存策略或服务端；不新增新页面、主题切换、颜色编辑器、拖拽抽屉等需求。

## 交给实施者的选择

以上默认决策由本次调研提出并获用户批准。具体组件拆分、变量名、内部样式文件组织及无行为影响的去重可由实施者决定。若某个封装需要改变业务契约或页面布局，先修订设计。

## 官方调研来源

- Base UI 起步、组件集与 tree shaking：https://base-ui.com/react/overview/quick-start
- Base UI 无样式/CSS Modules：https://base-ui.com/react/handbook/styling
- Base UI 键盘与焦点责任：https://base-ui.com/react/overview/accessibility
- Base UI Select：https://base-ui.com/react/components/select
- Base UI Dialog（包含嵌套、焦点与 Drawer 区别）：https://base-ui.com/react/components/dialog
- Base UI Number Field：https://base-ui.com/react/components/number-field
- Radix Primitives：https://www.radix-ui.com/primitives/docs/overview/introduction
- React Aria：https://react-aria.adobe.com/ 、https://react-aria.adobe.com/styling
- Mantine：https://mantine.dev/styles/css-modules/ 、https://mantine.dev/styles/unstyled/
- Ant Design 主题：https://ant.design/docs/react/customize-theme/
- shadcn/ui：https://ui.shadcn.com/docs
