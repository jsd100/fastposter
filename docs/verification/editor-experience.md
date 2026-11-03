# FastPoster 编辑体验、内置字体与上传兼容验证

日期：2026-11-03。分支：`feat/fastposter`。基线：`f702d18`（前轮数字草稿与 Select 整行点击修复单独提交之后）。

环境：本机 Google Chrome（Playwright `workers:1`），隔离 Go/Vite 测试栈（每次运行新建一次性 MySQL schema）；桌面 1440×1000，触屏模拟 390×844（`hasTouch`、`deviceScaleFactor:2`）。移动端是视口/触摸模拟，不是真机验证。

## Task 1：共享焦点与 Select 留白

### 变更

- `TextInput`/`Textarea` 的 field、bare 两种变体都获得同一个焦点基础类；该类只设置焦点颜色与阴影，不设置高度、边框宽度或内边距，页面尺寸规则继续生效。焦点使用 `--fp-focus-line`（`#88a471`）与 `--fp-focus-shadow`（`#b4c7a522`），并移除浏览器原生 outline。
- `NumberField` 的输入复用同一焦点类，后台排序等没有页面焦点规则的输入不再露出原生轮廓。
- 项目页搜索框保留容器边框，焦点环画在 `.search-input` 容器上，输入自身不再叠加一圈内环。
- Select 触发器默认持有 `padding: 0 10px`，compact 仍为 `0 8px`；删除 Value 的 `4px` 缩进与 Icon 的 `-6px` 边距。页面 Select 消费者的 9px 内边距收敛到 10px（后台筛选/资源表单、模板编辑器元信息、文案分类）。
- 编辑面板 Select 使用 10px；同面板的数字输入保持 8px 原值，避免顺带移动用户熟悉的数字文本。画布缩放控件是无边框的行内选择器，显式保持 0 内边距，外框尺寸不变。

### 先失败后通过

- `packages/ui/src/styling-hook.test.ts`：bare 变体原先除页面类外没有任何共享类（共享类数量 0，应为 1）；`NumberField` 输入没有共享焦点类。实现后 4/4 通过。
- `tests/e2e/ui-controls.spec.ts › bare picker search uses the green focus treatment`：聚焦背景库搜索时边框实际为 `rgb(221, 231, 209)`（页面 `#dde7d1`），模板库同理；项目页搜索容器为 `rgb(227, 232, 220)`。实现后断言边框 `rgb(136, 164, 113)`、outline 为 `none`、阴影含 `rgba(180, 199, 165, …)`。
- `tests/e2e/ui-controls.spec.ts › the select trigger balances text and caret insets`：修复前文字左内距 15px、箭头右内距 5px，差 10px（旧断言只要求箭头距右边框 ≤4px，正是问题来源）。实现后断言左右视觉内距差 ≤2px，并保留整行点击用例。

### 验证结果

- `pnpm typecheck`：退出 0。
- `pnpm test`：14 个文件、85 个用例通过。
- 针对性 E2E：`--grep 'green focus|insets|right edge'` 3/3；数字草稿与焦点复跑 5/5。
- ui-controls 全量按注册限流拆两组：9/9、6/6。每组使用独立 `pnpm exec playwright test`，测试栈各自新建数据库。
- 截图对比使用 `FP_UI_BASELINE=1`（opt-in 采集用例，不计入功能用例）：修复前 `/tmp/fastposter-task1-before`，修复后 `/tmp/fastposter-task1-after3`，均在仓库外，避免 Playwright 清理 `test-results/`。桌面编辑面板差异仅落在字体、字重两个 Select 的文字与箭头；数字输入、画布与布局无位移。ImageMagick 归一化差异：编辑面板 0.00018、模板库 0.00006、后台表单 0.00005。
- 采集脚本存在既有 `fill` 时序波动：三次运行中有一次在默认文案后追加输入，导致画布内容不同；重跑与基线一致，与本轮样式改动无关，对比采用第三次产物。

### 限制

- 只在 Chrome 验证；触屏为模拟。绿色焦点在模板库、背景库、项目页搜索上由计算样式断言；后台搜索、Textarea 与数字输入组共享同一类和规则，但没有额外的逐控件浏览器断言。
- 下拉菜单、弹窗与快捷键行为沿用前轮验证，本轮未重新采集真实 iOS Safari / 读屏器结果。
