# UI 组件迁移验收记录

日期：2026-11-02。设计：`docs/superpowers/specs/2026-11-02-ui-components-design.md`。计划：`docs/superpowers/plans/2026-11-02-ui-components-implementation.md`。

本文件记录组件迁移前后的真实基线与最终验证。截图与构建统计运行产物位于被 Git 忽略的 `test-results/ui-components/`，不随文档提交。

## 采集方法

- 采集驱动：`tests/e2e/ui-baseline.spec.ts`（临时脚本，只负责截图，不做断言式产品验证）。
- 运行环境：现有 Playwright 隔离测试栈（`playwright.config.ts` 的 webServer 调 `python3 tools/test-integration.py -run TestBrowserStack`），用户站 `http://127.0.0.1:15173`，后台 `http://127.0.0.1:15174`，本机 Google Chrome。
- 视口：桌面 1440×1000（`deviceScaleFactor` 默认 1），移动 390×844（`hasTouch: true`，`deviceScaleFactor: 2`）。
- 固定数据：后台账号 `admin-e2e` 发布共享背景 `共享风景`、模板 `夏日特惠`、一级分类 `旅行的意义` 下的文案 `山海之间` 与 `春日来信`；用户账号 `ui_baseline` 用 `tests/fixtures/images/editor.png` 建一个作品，重命名为 `旅行日记`，复制后再把副本改名为 `春日明信片`；编辑面板固定输入 `你好风景世界` 并选中 `风景` 两个字。
- 稳定性处理：截图前注入 `transition/animation: none`，等待 `document.fonts.ready` 与所有未完成的 `<img>` 解码，再等 200ms；Playwright 默认 `animations: disabled`。
- 已知非确定项：作品卡片上的“更新”时间取服务端时间，两次运行必然不同；比较时只看布局、配色、字号与控件形态，不看这一行文字。

## 构建基线（迁移前）

统计方法：对 `apps/<app>/dist/assets` 下全部 `.js`（或 `.css`）文件做字节求和，再对同一拼接结果执行 `gzip -9`。构建命令 `pnpm build --force`，即 Turbo 全量重建，8/8 任务成功。

| 应用 | JS 文件数 | JS 原始 | JS gzip | CSS 文件数 | CSS 原始 | CSS gzip |
| --- | --- | --- | --- | --- | --- | --- |
| @fastposter/web | 1 | 845,735 B | 259,175 B | 1 | 27,249 B | 6,595 B |
| @fastposter/admin | 1 | 846,172 B | 256,586 B | 1 | 38,913 B | 8,636 B |
| @fastposter/renderer | 1 | 311,445 B | 93,740 B | 0 | — | — |

迁移前后必须使用同一目录、同一扩展名集合与同一压缩方式比较；renderer 无独立 CSS 产物，样式随 JS 注入。

## 自动化基线（迁移前）

在采集当次运行，仓库既有验证全部通过：`pnpm typecheck` 退出 0；`pnpm test` 9 个文件 31 个用例全部通过；`pnpm build --force` 8/8 成功；`go test -count=1 ./server/... ./tools/...` 全部包 ok。

## 迁移前截图清单

桌面 1440×1000（`test-results/ui-components/before/`）：

| 文件 | 页面/操作 | 画面内容 |
| --- | --- | --- |
| `d-01-login.png` | 直接访问 `/login` | 登录页表单与主按钮 |
| `d-02-projects.png` | 登录后刷新 `/projects` | 两张作品卡片：`旅行日记`、`春日明信片`，含模板库/新建海报入口与搜索框 |
| `d-03-template-picker.png` | 点击 `模板库` | 模板库弹窗，含 `夏日特惠` |
| `d-04-editor-panel.png` | `编辑 春日明信片` → `添加文字` → `编辑文字` → 输入并选中 `风景` | 编辑侧栏：字体/字重/缩放选择器、字号与文本框宽度、段落、效果、格式按钮 |
| `d-05-background-picker.png` | 编辑器内点击 `背景库` | 背景库弹窗，含 `共享风景` |
| `d-06-copy-picker.png` | 编辑器内点击 `文案` | 文案库弹窗：搜索框、`全部分类` 一级分类选择器、`春日来信` 与 `山海之间` 两条文案卡片 |
| `d-07-admin-login.png` | 访问 `/admin/login` | 后台登录页 |
| `d-08-admin-background-form.png` | 后台 `背景库` → `添加背景`，名称填 `晨雾山谷` | 后台素材表单：名称、文件、排序、发布开关 |

移动 390×844：

| 文件 | 页面/操作 | 画面内容 |
| --- | --- | --- |
| `m-01-login.png` | `/login` | 窄屏登录页 |
| `m-02-projects.png` | 登录后 `/projects` | 单列作品卡片与顶部动作 |
| `m-03-template-picker.png` | 点击 `模板库` | 窄屏模板弹窗 |
| `m-04-editor.png` | 编辑 `春日明信片`，选中 `风景` | 窄屏画布与命令条 |
| `m-05-editor-sheet.png` | 点击 `文字设置` | 底部设置面板（BottomSheet）内的选择器与数字输入 |
| `m-06-background-picker.png` | 点击 `背景库` | 窄屏背景库弹窗 |
| `m-07-copy-picker.png` | 点击 `文案` | 窄屏文案库弹窗 |
| `m-08-admin-background-form.png` | 后台 `添加背景`，名称填 `晨雾山谷` | 窄屏后台素材表单 |

## 基线中可见的迁移目标

从 `d-04`、`d-06`、`m-05` 可以直接读出本次要改的细节：字体、字重、缩放、分类与文案筛选都是原生 `select`，收起态已按项目样式定制（淡绿边框 `#dde5d5`、6px 圆角、`#fbfdf8` 底），展开面板与勾选标记由系统决定；主按钮为森林绿 `#335b40`，弹窗 12px 圆角，页面底色 `#f7f8f5`；格式按钮 B/I/U/S 与对齐按钮已有选中态底色；移动端底部面板内输入文字为 16px、点击目标不低于 44px。这些数值是 Task 7 对照时必须保持不变的基准。

## 迁移后对照

采集条件与“采集方法”完全一致：同一 `tests/e2e/ui-baseline.spec.ts`、同一视口（桌面 1440×1000、移动 390×844）、同一固定数据、同一注入（关闭动画、等待字体与图片）。`after/` 取自迁移分支最终提交，`before/` 取自基线提交 `48740bd`。

对照工具：`magick compare -metric AE -fuzz 12% before/X.png after/X.png out.png`，差异像素占该图总像素的百分比：

| 文件 | 差异像素占比 | 结论 |
| --- | --- | --- |
| `d-01-login.png` | 0.000% | 一致 |
| `d-02-projects.png` | 0.000% | 一致 |
| `d-03-template-picker.png` | 0.005% | 一致 |
| `d-04-editor-panel.png` | 0.008% | 一致 |
| `d-05-background-picker.png` | 0.005% | 一致 |
| `d-06-copy-picker.png` | 0.005% | 一致 |
| `d-07-admin-login.png` | 0.000% | 一致 |
| `d-08-admin-background-form.png` | 0.001% | 一致 |
| `m-01-login.png` | 0.000% | 一致 |
| `m-02-projects.png` | 0.001% | 一致 |
| `m-03-template-picker.png` | 0.109% | 弹窗盒子逐像素一致，残余为下拉箭头线宽 |
| `m-04-editor.png` | 0.036% | 同上，箭头所在行 |
| `m-05-editor-sheet.png` | 0.006% | 一致 |
| `m-06-background-picker.png` | 0.027% | 同上，箭头所在行 |
| `m-07-copy-picker.png` | 0.004% | 一致 |
| `m-08-admin-background-form.png` | 0.004% | 一致 |

逐张核对布局、颜色、字体、留白与海报尺寸均与基线相同；允许的变化只有三类：弹出面板（Select 的 listbox、Tooltip、对话框阴影层）由库接管、焦点/悬停反馈、以及微交互（150ms 背景过渡）。

为达成这个结果补回的度量（原生控件由浏览器提供、Portal 之后消失）：

- `.dialog` 恢复 `<dialog>` 的 UA 宽度钳制 `max-width: calc(100% - 6px - 2em)`，`.center` 恢复 `height: fit-content`；单这两项把 `m-03` 从 1.175% 降到 0.109%。
- `[data-fp-overlay].bottom-sheet { max-height: min(65dvh, 550px) }` 替代原来的 `.poster-editor .bottom-sheet` 祖先选择器——弹层被 Portal 移到 `body` 后祖先规则不再命中，面板曾高出 59px。
- Select 的 `.value` 保留原生 menulist 约 14px 的文字缩进，`.icon` 用 `margin-inline-end: -6px` 让箭头贴回控件边框，并继承字段墨色（原来被写死成 `--fp-icon-ink`，比页面文字浅一档）。

`m-03 / m-04 / m-06` 的残余差异来源确定：触控视口下 Chromium 给原生 select 画的是加粗箭头（墨迹 9.0×5.5 CSS px），桌面视口是约 7×3.5；组件用一个 7×3.5 的 SVG 精确匹配桌面，手机上的箭头因此比 UA 略细。同一张图标无法同时匹配两种，且桌面各对比项都 ≤0.008%，判定为可接受残留。

产物说明：Playwright 每次运行都会清空 `test-results/`，所以采集时 `FP_UI_BASELINE_OUT` 必须指向该目录之外；PNG 是被 Git 忽略的运行产物，不随文档提交，需要复核时按上面的命令重新采集。

## 包体增量

同一统计方法（`apps/<app>/dist/assets` 全量 `.js`/`.css` 字节求和 + 对拼接结果 `gzip -9`）、同一 `pnpm build`（8/8 任务；此前一次 `--force` 复跑 0 命中缓存），迁移后一列为最终提交上的实测字节：

| 应用 | JS 原始 | 增量 | JS gzip | 增量 | CSS 原始 | 增量 | CSS gzip | 增量 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @fastposter/web | 845,735 → 1,012,815 | +167,080 | 259,175 → 315,740 | +56,565 | 27,249 → 33,073 | +5,824 | 6,595 → 7,794 | +1,199 |
| @fastposter/admin | 846,172 → 1,013,303 | +167,131 | 256,586 → 313,351 | +56,765 | 38,913 → 44,976 | +6,063 | 8,636 → 9,877 | +1,241 |
| @fastposter/renderer | 311,445 → 311,445 | 0 | 93,740 → 93,740 | 0 | 无产物 | — | 无产物 | — |

审阅后修复（下拉项触屏尺寸）给两个应用的 CSS 各加了 88 B 原始 / 13–14 B gzip；JS 的 ±4 B 属压缩器排列噪声。

增量来源用 sourcemap 逐段归属到最小化后的字节（`@fastposter/web`）：

| 来源 | 迁移前 | 迁移后 | 增量 |
| --- | --- | --- | --- |
| `@base-ui/react` | 0 | 128,250 | +128,250 |
| `@base-ui/utils` | 0 | 13,535 | +13,535 |
| `@floating-ui/{core,dom,utils,react-dom}` | 0 | 19,803 | +19,803 |
| `packages/ui`（本项目封装） | 1,562 | 5,737 | +4,175 |
| `packages/poster-editor` | 31,016 | 31,348 | +332 |
| 其余全部包（含 `react-dom`、prosemirror、tiptap、zod） | — | — | 单包 ≤ ±235 B，属压缩排列噪声 |

只引入实际使用的库入口：产物里出现的 `@base-ui/react` 目录只有 `select`、`dialog`、`tooltip`、`number-field`、`button`、`toggle`，以及它们共享的 `internals`、`utils`、`floating-ui-react`、`merge-props`、`field`、`toolbar`、`toggle-group`；未被使用的组件族（menu、popover、autocomplete、tabs、slider 等）一个都没有进来，说明按子路径导入 + tree-shaking 生效。`fast-equals`（7,274 B）迁移前后都存在，是 `@tanstack/query-core` 既有依赖，不是本次带入。

锁文件新增条目为 `@base-ui/react@1.9.0`、`@base-ui/utils@0.5.0`、`@floating-ui/react-dom@2.1.9`（含其 core/utils 依赖）、`@babel/runtime@8.0.10`、`reselect@5.3.0`；声明层唯一的依赖变化是 `packages/ui` 增加 `@base-ui/react`，三个应用与其余包的 `package.json` 未增删依赖。

`@fastposter/renderer` 的 JS 原始与 gzip 字节都与基线逐字节相同，导出链路没有被迁移牵连：它不引用 `@fastposter/ui`，导出 PNG 的像素与尺寸仍由 `full-flow` / `export` 两个用例按 SHA-256 与 IHDR 宽高校验。


## 最终验证结果

验证对象是 `48740bd..HEAD`（本计划的 9 个提交，含审阅后的两处修复）。改动只落在 `packages/ui`、`packages/poster-editor`、`apps/web`、`apps/admin`、`tests/e2e` 与文档；`server/`、`idl/`、`packages/api-client`、`packages/poster-schema`、`packages/poster-renderer`、`apps/renderer` 在区间内零改动。API、数据库、自动保存策略与渲染导出链路没有被触碰，导出的 PNG 仍由 `full-flow` / `export` 按 SHA-256 与 IHDR 尺寸校验。

### 命令与结果

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 14 个文件 / 80 个用例全部通过 |
| `pnpm build` | 8/8 任务成功 |
| `pnpm exec playwright test`（4 个分块） | 34 通过、2 跳过 |
| `go test -count=1 ./server/... ./tools/...` | 全部 ok（服务端未改动，作为回归证据保留） |

E2E 分块而非整跑的原因：注册接口按 IP 限流 10 次/分钟（`server/internal/auth/service.go:61 accountLimit`）。一次不分工号的 `pnpm test:e2e`（3.2 分钟）结果是 19 passed / 13 failed / 2 skipped，且每个失败都是 429——`error-context.md` 里写着 `alert: 注册过于频繁，请稍后重试`（`service.go:81` + `transport/hertz.go:108`），不是 UI 回归。因此以 60–75 秒间隔的 4 个分块作为覆盖证据：ui-controls 10；full-flow + export + autosave 9；copy + templates + editor-geometry + editor-mobile + editor-richtext 10；projects + admin-catalog + session-sync + ui-baseline 5 通过 2 跳过（跳过的两个是只在 `FP_UI_BASELINE=1` 下采集截图的用例）。

### 审阅后的两处修复

一次全新上下文的整分支审阅（读完整 diff 与前后代码）给出 0 Critical / 4 Important / 8 Minor，判定「With fixes」。两处是真实用户能感知的，按 TDD 修复：

1. **触屏下拉项过小**（违反计划第 19 行「触屏沿用至少 44px 的点击目标」）。新用例 `tests/e2e/editor-mobile.spec.ts` 「font menu rows keep a thumb-sized target on a touch screen」先失败：实测选项行高 32px。修复给 `packages/ui/src/Select.module.css` 增加 `@media (pointer: coarse)` 的 `.item{min-height:var(--fp-tap-target);font-size:16px}`，与包内按钮/输入框既有的触屏约定一致；桌面行高不变。顺带确认了 Playwright 上下文中 `matchMedia("(pointer: coarse)")` 只由 `hasTouch: true` 决定（`isMobile` 单独并不触发），所以这条规则确实被测到。
2. **焦点落在按钮上后快捷键失效**。`packages/poster-editor/src/keyboard.ts` 原来在任何带 `[data-fp-control]` 的元素上拦截编辑器快捷键，而 Button/IconButton/Toggle/NumberField/Select 的根节点都带这个标记，于是点一次工具栏按钮后 Delete 与 Ctrl/⌘+Z 双双失灵（迁移前的守卫只排除可编辑目标）。新用例「a click that leaves focus on a toolbar button keeps the editor shortcuts」先失败：焦点断言在「添加文字」上通过后，按 Delete 仍是 2 个文字块。修复把 `interactiveTarget` 收窄为 `pickerTarget`（只匹配 `[role="combobox"]`，即 Select 触发器实际渲染出的 ARIA 角色），保持基线里原生 `<select>` 会拦截的行为；浮层内另有 `overlayOpen` 守卫，未变。两处修复后单测 80/80、相关 E2E 分块全绿。

审阅提出的第三、四点经实测与规范判断保留原状，理由与度量记录在案：菜单没有被弹窗的滚动容器裁掉（在 390×360 灌入 26 个分类：弹窗可视区 18..342，菜单 24..226 完全在内，列表 `overflow-y:auto` 自行滚动；滚动弹窗 60px 时菜单跟随触发器同步位移，`--available-height` 由 201.6px 重算为 141.6px——是「贴着触发器」而不是「被裁掉」）；重复的字段规则两处取值相同、且当前 13 处业务用法全部走 `variant="bare"`，今天没有任何可观测差异，故降级为待清理项。

### 真实浏览器覆盖范围（已知边界）

- 全部 E2E 与截图都在本机 **Google Chrome**（`playwright.config.ts` 直接指定 `executablePath`）里跑：没有 Firefox，没有 WebKit/Safari，也没有真机 iOS 或 Android。文档里所有「移动端」结论来自 Playwright 的模拟视口 + `hasTouch`，不是真实手机验证。
- 16 对截图对照不包含任何打开的浮层或菜单，因此像素证据只支撑「静态控件外观未变」；下拉菜单、弹窗与底部面板的行为由 DOM 度量（尺寸、`--available-height`、滚动容器）和 E2E 断言支撑，而非像素。移动端下拉箭头与原生箭头的笔画差异见上一节。
- 触控目标、快捷键这类只在 `pointer: coarse` 或真实焦点顺序下才成立的性质，靠的是模拟上下文的媒体查询与键盘事件，未在无障碍读屏器上验证；无障碍相关的结论来自 CDP `Accessibility.getFullAXTree` 的节点裁剪度量，与迁移前的原生 `<dialog>` 对照过。
