import { fontFamilies, fontWeights } from "./font-options";
import type { Editor } from "@tiptap/react";
import type { TextBlock, InlineStyle } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import { Button } from "@fastposter/ui";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";
import { selectionStyle, type InlineStylePatch } from "../text/selection";
import { ParagraphPanel } from "./ParagraphPanel";
import { StylePanel } from "./StylePanel";
export function TextPanel({
  block,
  editor,
  fonts,
  apply,
  update,
}: {
  block: TextBlock;
  editor: Editor | null;
  fonts: FontSource[];
  apply: (patch: InlineStylePatch) => void;
  update: (change: (block: TextBlock) => TextBlock) => void;
}) {
  const selection = editor?.state.selection;
  const current =
    selection && !selection.empty
      ? selectionStyle(
          block.content,
          selection.from,
          selection.to,
          block.defaultStyle,
        )
      : ({
          ...block.defaultStyle,
          ...Object.fromEntries(
            Object.entries(editor?.getAttributes("textStyle") ?? {}).filter(
              ([, v]) => v != null,
            ),
          ),
        } as InlineStyle);
  const families = fontFamilies(fonts);
  const activeFamily = fonts.find((f) => f.assetId === current.fontId)?.family;
  const italicAvailable = fonts.some(
    (f) => f.family === activeFamily && f.style === "italic",
  );
  return (
    <div className="text-panel">
      <p className="style-target">
        {editor
          ? selection?.empty
            ? "光标样式 · 影响接下来输入的文字"
            : "选中文字 · 只修改选区"
          : "整块文字样式"}
      </p>
      <label className="panel-field">
        字体
        <select
          aria-label="文字字体"
          value={families.find((f) => f.family === activeFamily)?.assetId ?? ""}
          onChange={(e) => {
            const face = fonts.find((f) => f.assetId === e.target.value);
            if (face) apply({ fontId: face.assetId, fontWeight: face.weight });
          }}
        >
          <option value="" disabled>
            混合
          </option>
          {families.map((f) => (
            <option key={f.assetId} value={f.assetId}>
              {f.family === "Noto Sans SC" ? "思源黑体" : f.family}
            </option>
          ))}
        </select>
      </label>
      <label className="panel-field">
        字重
        <select
          aria-label="文字字重"
          value={current.fontWeight ?? ""}
          onChange={(e) => {
            const face = fontWeights(fonts, activeFamily).find(
              (f) => f.weight === Number(e.target.value),
            );
            if (face) apply({ fontId: face.assetId, fontWeight: face.weight });
          }}
        >
          <option value="" disabled>
            混合
          </option>
          {fontWeights(fonts, activeFamily).map((face) => (
            <option key={face.assetId} value={face.weight}>
              {face.weight}
            </option>
          ))}
        </select>
      </label>
      <div className="panel-row">
        <label className="panel-field">
          字号
          <input
            aria-label="文字字号"
            type="number"
            min="1"
            max="4096"
            value={current.fontSize ?? ""}
            placeholder="混合"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0 && n <= 4096) apply({ fontSize: n });
            }}
          />
        </label>
        <label className="panel-field">
          颜色
          <input
            aria-label="文字颜色"
            type="color"
            value={(current.color ?? "#000000").slice(0, 7)}
            onChange={(e) => apply({ color: e.target.value })}
          />
          {current.color === null && <small>混合</small>}
        </label>
      </div>
      <div className="format-buttons">
        {(
          [
            {
              mark: "bold",
              label: "粗体",
              icon: Bold,
              disabled: !fonts.some(
                (f) => f.family === activeFamily && f.weight === 700,
              ),
            },
            {
              mark: "italic",
              label: "斜体",
              icon: Italic,
              disabled: !italicAvailable,
            },
            { mark: "underline", label: "下划线", icon: Underline },
            { mark: "strike", label: "删除线", icon: Strikethrough },
          ] as const
        ).map(({ mark, label, icon: Icon, ...extra }) => (
          <Button
            key={mark}
            aria-label={label}
            aria-pressed={editor?.isActive(mark) || false}
            disabled={!editor || ("disabled" in extra && extra.disabled)}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!editor) return;
              const chain = editor.chain();
              if (mark === "bold") chain.toggleBold();
              if (mark === "italic") chain.toggleItalic();
              if (mark === "underline") chain.toggleUnderline();
              if (mark === "strike") chain.toggleStrike();
              chain.run();
            }}
          >
            <Icon size={15} />
          </Button>
        ))}
      </div>
      {!italicAvailable && (
        <p className="property-hint">当前字体未提供斜体字形。</p>
      )}
      <ParagraphPanel block={block} update={update} />
      <StylePanel block={block} update={update} />
    </div>
  );
}
