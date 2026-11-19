import {
  canApplyFontMark,
  effectiveInlineStyle,
  richTextSchema,
} from "../text/selection";
import { documentFontSources, fontUnavailableReason } from "../fonts/catalog";
import {
  familySupportsWeight,
  fontWeights,
  fontWeightRange,
} from "./font-options";
import type { Editor } from "@tiptap/react";
import { Slider } from "antd";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TextBlock, FontRef } from "@fastposter/poster-schema";
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
import { fontTargetIds, type FontChoiceIntent } from "../fonts/prepare-change";
import { FontPicker } from "../fonts/FontPicker";
import { TextColorField } from "./TextColorField";
import {
  fontWeightRevision,
  subscribeFontWeights,
} from "@fastposter/poster-renderer";
import { ColorField } from "./ColorField";
import { ParagraphPanel } from "./ParagraphPanel";
import { StylePanel } from "./StylePanel";
import type { InspectorGroup } from "./EditorInspector";
export type TextPanelProps = {
  block: TextBlock;
  editor: Editor | null;
  fonts: FontSource[];
  fontRefs: readonly FontRef[];
  previewWeight?: (weight: number | null) => void;
  apply: (patch: InlineStylePatch) => void;
  chooseFont: (
    font: FontSource,
    intent?: FontChoiceIntent,
    requestedWeight?: number,
  ) => void;
  fontPending: boolean;
  phone: boolean;
  sizeBase?: number;
  onNumericStart: () => void;
  onNumericEnd: (action: "commit" | "cancel") => void;
  onColorStart: () => void;
  onColorEnd: (action: "commit" | "cancel") => void;
  update: (change: (block: TextBlock) => TextBlock) => void;
  draft: (field: string) => NumberDraftBinding;
  editing: boolean;
  onToggleEdit: () => void;
};

function WeightControl({
  min,
  max,
  value,
  disabled,
  onCommit,
  onPreview,
}: {
  min: number;
  max: number;
  value: number | null;
  disabled: boolean;
  onCommit: (weight: number) => void;
  onPreview?: (weight: number | null) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const preview = useRef(onPreview);
  preview.current = onPreview;
  useEffect(() => () => preview.current?.(null), []);
  function clear() {
    pending.current = null;
    setDraft(null);
    preview.current?.(null);
  }
  const shown = draft ?? value;
  const thumb = Math.min(max, Math.max(min, shown ?? 400));
  return (
    <div
      className="weight-control"
      onPointerCancel={clear}
      onTouchCancel={clear}
    >
      <Slider
        ariaLabelForHandle="文字字重"
        ariaValueTextFormatterForHandle={() =>
          shown == null ? "混合" : String(shown)
        }
        min={min}
        max={max}
        step={1}
        value={thumb}
        disabled={disabled}
        onChange={(weight) => {
          pending.current = weight;
          setDraft(weight);
          preview.current?.(weight);
        }}
        onChangeComplete={(weight) => {
          const changed = pending.current !== null;
          clear();
          if (changed && weight !== value) onCommit(weight);
        }}
      />
      <output aria-label="当前字重">{shown ?? "混合"}</output>
    </div>
  );
}

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
  fontRefs,
  previewWeight,
  apply,
  chooseFont,
  fontPending,
  phone,
  sizeBase,
  onNumericStart,
  onNumericEnd,
  onColorStart,
  onColorEnd,
  update,
  draft,
  editing,
  onToggleEdit,
}: TextPanelProps & { group: InspectorGroup }) {
  useSyncExternalStore(subscribeFontWeights, fontWeightRevision);
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
      : selection && editor
        ? effectiveInlineStyle(
            editor.state.storedMarks ?? selection.$from.marks(),
            block.defaultStyle,
          )
        : block.defaultStyle;
  const sources = documentFontSources(fonts, fontRefs);
  const referenced = sources.filter((source) =>
    fontRefs.some((ref) => ref.assetId === source.assetId),
  );
  const target = selection
    ? {
        kind: selection.empty ? ("cursor" as const) : ("range" as const),
        from: selection.from,
        to: selection.to,
      }
    : { kind: "block" as const, from: 0, to: 0 };
  const families = [
    ...new Set(
      fontTargetIds(block, target, current.fontId ?? undefined)
        .map((id) => sources.find((font) => font.assetId === id)?.family)
        .filter((family): family is string => !!family),
    ),
  ];
  const activeFamily = families.length === 1 ? families[0] : undefined;
  const canAddMark = (mark: "bold" | "italic") =>
    !!editor &&
    (editor.isActive(mark) ||
      canApplyFontMark(editor.state, block.defaultStyle, referenced, mark));
  const italicAvailable = editor
    ? canAddMark("italic")
    : families.length > 0 &&
      families.every((family) =>
        referenced.some(
          (font) => font.family === family && font.style === "italic",
        ),
      );
  const selectedText =
    editor && selection && !selection.empty
      ? editor.state.doc.textBetween(selection.from, selection.to, " ")
      : "";
  const targetText = editor
    ? selectedText
    : richTextSchema.nodeFromJSON(block.content).textContent;
  const ranges = families.map((family) => fontWeightRange(sources, family));
  const min = Math.max(...ranges.map((range) => range?.[0] ?? Infinity));
  const max = Math.min(...ranges.map((range) => range?.[1] ?? -Infinity));
  const weightRange = families.length > 0 && min < max;
  const availableFaces = families.flatMap((family) =>
    fontWeights(sources, family),
  );
  const discreteWeights = [
    ...new Set(availableFaces.map((face) => face.weight)),
  ]
    .filter((weight) =>
      families.every((family) => familySupportsWeight(sources, family, weight)),
    )
    .sort((a, b) => a - b);
  function commitWeight(weight: number) {
    const face =
      availableFaces.find((item) => item.weight === weight) ??
      availableFaces[0];
    if (face) chooseFont(face, "weight", weight);
  }
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
          fonts={sources}
          value={
            current.fontId ??
            sources.find((font) => font.family === activeFamily)?.assetId ??
            ""
          }
          sample={sample}
          targetText={targetText}
          disabled={fontPending}
          onChoose={chooseFont}
        />
        {restrictedLatin && (
          <small className="property-hint">
            当前文字包含中文，西文字体暂不可选；仅选中英文后即可使用 Inter。
          </small>
        )}
      </label>
      <label className="panel-field">
        字重
        {weightRange ? (
          <WeightControl
            key={`${block.id}:${target.kind}:${target.from}:${target.to}:${families.join("|")}`}
            min={min}
            max={max}
            value={current.fontWeight}
            disabled={fontPending}
            onCommit={commitWeight}
            onPreview={previewWeight}
          />
        ) : (
          <Select
            aria-label="文字字重"
            disabled={fontPending || discreteWeights.length === 0}
            value={current.fontWeight == null ? "" : String(current.fontWeight)}
            onValueChange={(weight) => commitWeight(Number(weight))}
            options={[
              { value: "", label: "混合", disabled: true },
              ...discreteWeights.map((weight) => ({
                value: String(weight),
                label: String(weight),
              })),
            ]}
          />
        )}
      </label>
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
      <div className="panel-field">
        <span>文字颜色</span>
        <TextColorField
          value={current.color ?? null}
          target={`${block.id}:${target.kind}:${target.from}:${target.to}`}
          sample={targetText.trim() || "海报文字"}
          phone={phone}
          onChange={(color) => apply({ color })}
          onInteractionStart={onColorStart}
          onInteractionEnd={onColorEnd}
        />
        {current.color === null && <small>混合</small>}
      </div>
      <div className="format-buttons">
        {(
          [
            {
              mark: "bold",
              label: "粗体",
              icon: Bold,
              disabled: !canAddMark("bold"),
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
