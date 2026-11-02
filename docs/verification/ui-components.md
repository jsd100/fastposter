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

待 Task 7 填写。

## 包体增量

待 Task 7 填写。

## 最终验证结果

待 Task 7 填写。
