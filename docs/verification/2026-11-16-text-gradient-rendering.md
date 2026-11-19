# 文字渐变渲染可行性验证

日期：2026-11-16　对应设计：`docs/superpowers/specs/2026-11-16-editor-gallery-features-design.md` §4.3 渲染基准

## 结论

**通过，但只采用共享坐标方案。** 在真实 Chrome 合成输出上，按「同一施加范围共用一套坐标、每个片段按自身原点切片」的方案（`shared`），可以同时满足：跨行且局部变字号的连续渐变、0°/45°/90° 方向可区分、径向圆心移动、纯色与两个独立渐变并排、阴影在轮廓外可辨、描边颜色保留、透明 PNG 字形外零泄漏、contenteditable 的选区与输入命中。

**独立 span 的 CSS `slice`（`slice`）不通过**：同一范围跨行后每个片段各自从 0% 重新起色，第二行的颜色与第一行不连续（详见采样对比）。它只能作为对照，不能作为交付方案。

因此任务的写入门仍以「使用共享坐标方案」为前置条件；后续任务按此结论选择布局实现。

## 原型来源与配置

- 对照页：`index.html`；采样脚本：`sample.mjs`、`probe.mjs`、`alpha.mjs`、`hit.mjs`（均为一次性文件，位于本任务临时工作区，不进入产品代码）。
- 渲染环境：Google Chrome（headless），页面 `file://` 加载，`document.fonts.ready` 后采样；截图用 `omitBackground` 保留真实 alpha。
- 样例结构：同一文字块内，范围 A 为「渐变跨行」+ 强制换行 + 60px「变号」（模拟跨行并局部改字号），紧邻纯色「实色」，再接独立径向范围 B「圆心」。深色用例对纯色加 `text-shadow: 2px 3px 0 #00000073` 与 `-webkit-text-stroke: 2px #151515; paint-order: stroke fill`。
- 颜色：`linear-gradient(angle, #ff3b30 0%, #ffcc00 45%, #34c759 100%)`；径向 `radial-gradient(circle at cx cy, …)`。

## 布局来源与范围分组

- **布局来源**：片段的 `getBoundingClientRect()`（相对文字块原点）。字体就绪后、每次样式/字号/换行变化后重新测量。
- **范围分组**：以文档中的范围标识分组；同标识的所有片段取矩形并集为唯一坐标系。每片段设置 `background-size = 并集宽×高`，`background-position = 并集原点 − 片段原点`，使整段渐变在世界坐标中连续。独立范围各自维护并集，互不覆盖。
- **遮罩/字形效果**：每片段 `background-clip: text; -webkit-background-clip: text; color: transparent`，渐变只绘制在字形内部；阴影与描边沿用块级 `text-shadow` / `-webkit-text-stroke`，不参与遮罩。

## 采样方式与结果

脚本在合成截图上读取像素：`samples.json`（两方案 × 0°/45°/90°/径向/深色效果/可编辑，共 12 例）、`probe.json`（径向圆心 25%↔75% 与选区命中）、`alpha.json`、`hit.json`，PNG 证据同目录。

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 跨行 + 局部字号，范围 A 连续 | shared 通过；slice 失败 | `shared-linear-90.png`：frag1 左 `[242,224,107]`、frag2 左 `[255,132,97]`，同坐标系下按并集位置取色；`slice-linear-90.png`：frag1 `[255,156,124]`、frag2 `[255,164,87]`，均各自从红色重起，第二行重置 |
| 0°/45°/90° 方向可区分 | 通过 | `samples.json` 三角度 A-frag1/frag2 首末色不同；0° 与 90° 在两片段上的色序明显区分 |
| 径向圆心移动改变颜色位置 | 通过 | `probe.json`：25%↔75% 圆心像素差 AE≈765；`shared-c25.png` / `shared-c75.png` |
| 纯色与两个独立渐变并排 | 通过 | 深色样例中「实色」保持蓝 `[63,95,207]`，范围 A/B 各取自己的渐变 |
| 阴影在轮廓外可辨 | 通过 | `alpha.json` 半透明像素 1584（阴影），透明像素 43561；`alpha-leak.png` 视觉确认 |
| 描边颜色保留 | 通过 | 深色样例描边像素 `[21,21,21]` 与 `#151515` 一致 |
| 透明 PNG 字形外不泄漏矩形 | 通过 | `alpha.json`：着色像素 2853 全部在字形范围，`x>200` 区域着色像素 0；`alpha-leak.png` |
| Tiptap 选区与输入命中 | 通过 | `hit.json`：可编辑渐变文字输入「ABC」后仍在渐变 span 内，`text=渐变文字ABC`，`gradientStillOnSpan=true`；`probe.json` 原生 Range 选中「渐变文字」 |

## 已知边界与交给后续任务的约束

1. `background-clip: text` 在 Chrome/Chromium 合成链可用；产品已有独立导出 renderer（Chrome），无需新增 canvas/skia 依赖。编辑态 Tiptap 与非编辑态可共用同一 CSS 规则。
2. 共享坐标依赖测量：保存重开、撤销、复制粘贴、跨段选择、纯色↔渐变切换后都必须重新计算并集，否则坐标与字形错位。这是任务 9 的实现约束，不是渲染方案缺陷。
3. 一次手势一条历史由编辑器 UI 层控制，与渲染方案无关。
4. 范围标识只用于分组；渲染不得按颜色值合并范围（同值独立应用需保持各自坐标）。
5. `slice` 方案仅在「单片段、不跨行、不改字号」时与 `shared` 等价；任何跨片段用例都必须走 `shared`。
