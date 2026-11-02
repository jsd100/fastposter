import { fontFamilies, fontWeights } from "./font-options";
import type { Editor } from "@tiptap/react";
import type { TextBlock, InlineStyle } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import { NumberField, Select, ToggleButton } from "@fastposter/ui";
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
        <Select
          aria-label="文字字体"
          value={families.find((f) => f.family === activeFamily)?.assetId ?? ""}
          onValueChange={(assetId) => {
            const face = fonts.find((f) => f.assetId === assetId);
            if (face) apply({ fontId: face.assetId, fontWeight: face.weight });
          }}
          options={[
            { value: "", label: "混合", disabled: true },
            ...families.map((f) => ({
              value: f.assetId,
              label: f.family === "Noto Sans SC" ? "思源黑体" : f.family,
            })),
          ]}
        />
      </label>
      <label className="panel-field">
        字重
        <Select
          aria-label="文字字重"
          value={current.fontWeight == null ? "" : String(current.fontWeight)}
          onValueChange={(weight) => {
            const face = fontWeights(fonts, activeFamily).find(
              (f) => String(f.weight) === weight,
            );
            if (face) apply({ fontId: face.assetId, fontWeight: face.weight });
          }}
          options={[
            { value: "", label: "混合", disabled: true },
            ...fontWeights(fonts, activeFamily).map((face) => ({
              value: String(face.weight),
              label: String(face.weight),
            })),
          ]}
        />
      </label>
      <div className="panel-row">
        <label className="panel-field">
          字号
          <NumberField
            aria-label="文字字号"
            min={1}
            max={4096}
            value={current.fontSize ?? null}
            placeholder="混合"
            onValueChange={(fontSize) => apply({ fontSize })}
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
          <ToggleButton
            key={mark}
            aria-label={label}
            tooltip={label}
            pressed={editor?.isActive(mark) ?? false}
            disabled={!editor || ("disabled" in extra && extra.disabled)}
            onPointerDown={(e) => e.preventDefault()}
            onPressedChange={() => {
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
          </ToggleButton>
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
