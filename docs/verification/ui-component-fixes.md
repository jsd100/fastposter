# UI 组件复审问题修复验证

日期：2026-11-03。基线：`bf4a203`。对应本次复审确认的 4 项 P2 问题；不更改页面主题、布局、API 或服务端。

## 修复

1. Select List 在 Popup 内伸展到可用宽度，让短标签选项的整行均可点击，包含菜单右侧。
2. NumberField 将原始文本草稿与生效数值分开。Escape 使用聚焦时保存的快照，逐字输入不覆盖该快照；Enter 确认后更新取消基准。
3. 对原始草稿先分类，`0.`、`1.`、空串与未完成负数不写入海报；有效数字仍即时预览。
4. Enter 与失焦共用验证/恢复逻辑，越界或未完成草稿恢复到最后有效数值。

另外保留 `.5`、`-.5`、全角数字与 Unicode 负号的输入能力。接管字符编辑时绕过依赖旧格式化值的内部字符过滤，保留数字步进；方向键到达上下限仍会规范化显示，Ctrl+Home 等光标导航不清除草稿。组合输入的 Enter（含 keyCode/which 229）不提前确认。

## 测试先失败后通过

新增四个真实浏览器用例，修复前分别失败于：菜单仍打开、Escape 得到 12 而非 8、`0.` 已令字距变 0、Enter 后仍显示 4097。对应路径：`tests/e2e/ui-controls.spec.ts`。

独立代码审阅提出内部键盘状态风险后，另用真实按键复现清空后 `-.5` 变成 `5`、上限步进仍显示非法草稿；输入法确认键和 Ctrl+Home 的草稿保护也分别先失败后修复。`.5`/`-.5`、全角与 Unicode 负号的四个单测同样有失败记录。

原数字测试在输入 -2.5 后明确失焦，以表达“已完成一次编辑，再开始 40 的新编辑”；避免将同一次编辑中上一次按键的值误当取消基准。

## 验证结果

- `pnpm typecheck`：退出 0。
- `pnpm test`：14 个文件、84 个用例通过。
- `pnpm build --force`：8/8 成功，0 缓存命中。既有 web/admin 单 chunk 超过 500KB 的警告仍存在。
- 功能 E2E 共 38 个，按以下互不重叠分组顺序运行，全部通过；最后调整光标导航保护后，受影响的第一组 7 个用例再次通过。
- `git diff --check`：通过。

分组 A：ui-controls 的 password form、catalog selects、editor number fields，以及四个新增用例，7/7。

分组 B：ui-controls 其余弹窗/提示/快捷键用例，7/7。

分组 C：editor-mobile、editor-richtext、projects、session-sync，10/10。

分组 D：autosave、export、full-flow，9/9。

分组 E：copy、templates、editor-geometry、admin-catalog，5/5。

各组使用 `pnpm exec playwright test`，输出隔离在 `/tmp/fastposter-fix-final-{a,b,c,d,e}`，以避免并行运行的端口/trace 冲突；分组重建隔离测试栈以避开注册 IP 限流。最后的控件重跑产物在 `/tmp/fastposter-fix-final-number-regression`。两个 opt-in 基线截图采集用例未运行，不计入上述功能用例。

浏览器实测为本机 Chrome；移动端是 Playwright 视口/触摸模拟，输入法 229 是模拟事件断言。未在真实 iOS Safari、Android 或读屏器上验证。
