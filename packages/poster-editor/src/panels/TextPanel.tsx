import { colorPresets } from "./color-presets";
import { richTextSchema } from "../text/selection";
import { fontUnavailableReason } from "../fonts/catalog";
import { fontWeights } from "./font-options";
import type { Editor } from "@tiptap/react";
import type { TextBlock, InlineStyle } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import {
  Button,
  NumberField,
  Select,
  ToggleButton,
  type NumberDraftBinding,
} from "@fastposter/ui";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";
import { selectionStyle, type InlineStylePatch } from "../text/selection";
import type { FontChoiceIntent } from "../fonts/prepare-change";
import { FontPicker } from "../fonts/FontPicker";
import { ColorField } from "./ColorField";
import { ParagraphPanel } from "./ParagraphPanel";
import { StylePanel } from "./StylePanel";
import type { InspectorGroup } from "./EditorInspector";
export type TextPanelProps = {
  block: TextBlock;
  editor: Editor | null;
  fonts: FontSource[];
  apply: (patch: InlineStylePatch) => void;
  chooseFont: (font: FontSource, intent?: FontChoiceIntent) => void;
  fontPending: boolean;
  sizeBase?: number;
  onNumericStart: () => void;
  onNumericEnd: (action: "commit" | "cancel") => void;
  update: (change: (block: TextBlock) => TextBlock) => void;
  draft: (field: string) => NumberDraftBinding;
  editing: boolean;
  onToggleEdit: () => void;
};
/**
 * The inspector keeps one property group mounted at a time. Splitting the
 * groups here instead of stacking every control keeps the phone sheet short,
 * while the owner keeps the selection and draft strings across the swap.
 */
export function TextPanel({
  group,
  block,
  editor,
  fonts,
  apply,
  chooseFont,
  fontPending,
  sizeBase,
  onNumericStart,
  onNumericEnd,
  update,
  draft,
  editing,
  onToggleEdit,
}: TextPanelProps & { group: InspectorGroup }) {
  if (group === "paragraph")
    return (
      <div className="text-panel">
        <p className="style-target">整块文字的段落格式</p>
        <ParagraphPanel
          block={block}
          update={update}
          onNumericStart={onNumericStart}
          onNumericEnd={onNumericEnd}
          draft={draft}
        />
      </div>
    );
  if (group === "effects")
    return (
      <div className="text-panel">
        <p className="style-target">整块文字的外观效果</p>
        <StylePanel
          block={block}
          update={update}
          onNumericStart={onNumericStart}
          onNumericEnd={onNumericEnd}
          draft={draft}
        />
      </div>
    );
  if (group === "position") return null;
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
  const activeFamily = fonts.find((f) => f.assetId === current.fontId)?.family;
  const italicAvailable = fonts.some(
    (f) => f.family === activeFamily && f.style === "italic",
  );
  const selectedText =
    editor && selection && !selection.empty
      ? editor.state.doc.textBetween(selection.from, selection.to, " ")
      : "";
  const targetText = editor
    ? selectedText
    : richTextSchema.nodeFromJSON(block.content).textContent;
  const restrictedLatin = !!fontUnavailableReason("Inter", targetText);
  const sample = (selectedText || "海报字体预览 Aa 123").slice(0, 12);
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
        <FontPicker
          fonts={fonts}
          value={current.fontId ?? ""}
          sample={sample}
          targetText={targetText}
          disabled={fontPending}
          onChoose={chooseFont}
        />
      </label>
      {restrictedLatin && (
        <p className="property-hint">
          当前文字包含中文，西文字体暂不可选；仅选中英文后即可使用 Inter。
        </p>
      )}
      <label className="panel-field">
        字重
        <Select
          aria-label="文字字重"
          disabled={fontPending}
          value={current.fontWeight == null ? "" : String(current.fontWeight)}
          onValueChange={(weight) => {
            const face = fontWeights(fonts, activeFamily).find(
              (f) => String(f.weight) === weight,
            );
            if (face) chooseFont(face, "weight");
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
            variant="stepper"
            unit="px"
            min={1}
            max={4096}
            step={1}
            stepBase={sizeBase}
            value={current.fontSize ?? null}
            placeholder="混合"
            {...draft("fontSize")}
            onInteractionStart={onNumericStart}
            onInteractionEnd={onNumericEnd}
            onValueChange={(fontSize) => apply({ fontSize })}
          />
        </label>
        <label className="panel-field">
          颜色
          <ColorField
            label="文字颜色"
            value={current.color ?? "#000000"}
            onChange={(color) => apply({ color })}
            onInteractionStart={onNumericStart}
            onInteractionEnd={onNumericEnd}
          />
          {current.color === null && <small>混合</small>}
        </label>
      </div>
      <label className="panel-field">
        预设文字颜色
        <Select
          aria-label="预设文字颜色"
          value={current.color ?? ""}
          valueLabel={
            colorPresets.some((option) => option.value === current.color)
              ? undefined
              : current.color === null
                ? "混合颜色"
                : "自定义颜色"
          }
          options={colorPresets}
          onValueChange={(color) => apply({ color })}
        />
      </label>
      <div className="format-buttons">
        {(
          [
            {
              mark: "bold",
              label: "粗体",
              icon: Bold,
              disabled: !fonts.some(
                (f) =>
                  f.family === activeFamily &&
                  f.weight === 700 &&
                  f.style === "normal",
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
      <Button className="edit-content" onClick={onToggleEdit}>
        {editing ? "完成文字编辑" : "编辑文字"}
      </Button>
    </div>
  );
}
