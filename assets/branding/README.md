# FastPoster 纯图案图标 · 莫兰迪浅色版

图标采用三片折纸旋转组合，不含文字、字母或缩写。在用户认可的纯图案造型基础上，仅将颜色调整为莫兰迪浅色系：暖灰白背景、雾粉、浅杏与灰蓝，保留折角和构图。

通过内置 imagegen 生成及改色，最终原图为 `fastposter-icon-source.png`。

- `packages/ui/src/brand/fastposter-icon.png`：256 × 256，供共享 `BrandIcon` 使用。
- `packages/ui/public/brand/favicon-morandi.png`：32 × 32，浏览器图标。
- `packages/ui/public/brand/apple-touch-icon-morandi.png`：180 × 180，主屏幕图标。

衍生尺寸通过 ImageMagick 等比缩小并去除元数据。页面圆角由 CSS 控制。三个前端通过 Vite 的 `publicDir` 共用静态资源，由 Vite 按应用 base 处理 HTML 中的 `/brand/` 路径。静态图标使用新的 morandi 文件名，避免继续使用旧版缓存。

## 原始图案生成提示词

```text
Use case: logo-brand.
Asset type: one finished square app icon for a poster creation tool, pure pictorial symbol.
Primary request: invent a fresh, distinctive abstract paper-composition emblem, entirely independent of any wordmark. Three broad folded paper shapes interlock in a compact playful pinwheel, evoking arranging colored sheets on a creative canvas. Use an asymmetrical but precisely balanced silhouette and generous negative space. Bold, immediately recognizable, professional design-studio identity.
Style: exceptionally clean flat geometric graphic, crisp edges, solid color fills. Warm coral, soft apricot, and warm ivory paper shapes on a full-bleed vivid ultramarine blue square background. Center the emblem, occupying roughly 70 percent of the square, with balanced clear margin. A subtle sense of folded planes comes solely from contrasting flat shapes, never lighting or realistic shadows.
Constraints: strictly a pure graphic icon, no lettering of any kind, no letters hidden in negative space, no initials, no monogram, no numbers, no typography, no wordmark. No photo, no mockup, no border, no tiny decorative detail, no gradients, no texture, no drop shadow. Do not draw a generic document with text lines. Do not draw a pencil or paintbrush. No rounded outer corners; UI applies the rounding. Must remain readable as a 32-pixel favicon. Deliver just ONE icon, not a sheet of options. Square high-resolution output.
```

## 莫兰迪改色提示词

```text
Use case: logo-brand, precise color-only edit. Edit the provided abstract three-sheet folded-paper pinwheel app icon. Preserve EXACTLY its silhouette, all polygon vertices, paper positions, folds, overlaps, orientation, center negative space, framing, proportions and edge quality. Change ONLY the colors to a light, desaturated Morandi palette. Replace the vivid ultramarine background with solid light warm gray/off-white #F0EDE7. Replace the coral-red sheet and matching fold with dusty muted rose #C4A1A0. Replace the orange/apricot sheet with soft muted sand/apricot #D8C5AD. Replace the ivory sheet and matching folds with light dusty gray-blue #A7B9BF. Keep enough difference between the shapes and background for favicon readability. Overall gentle, airy, refined, muted pastel paper composition. Keep broad clean flat solid-color planes, no added texture, no shadows or gradients. No new objects. Absolutely no text, no letters, no monograms, no numbers. Output the same single square full-bleed icon, no external rounded corners, no mockup, no border. This is a recolor of the provided composition, not a redesign.
```
