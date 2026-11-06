import type { TextBlock } from "@fastposter/poster-schema";
import {
  NumberField,
  ToggleButton,
  type NumberDraftBinding,
} from "@fastposter/ui";
export function ParagraphPanel({
  block,
  update,
  onNumericStart,
  onNumericEnd,
  draft,
}: {
  block: TextBlock;
  update: (change: (b: TextBlock) => TextBlock) => void;
  onNumericStart: () => void;
  onNumericEnd: () => void;
  draft: (field: string) => NumberDraftBinding;
}) {
  return (
    <div className="paragraph-panel">
      <div className="format-buttons">
        {(["left", "center", "right"] as const).map((align, i) => (
          <ToggleButton
            key={align}
            aria-label={["左对齐", "居中对齐", "右对齐"][i]}
            pressed={block.paragraphStyle.align === align}
            onPointerDown={(e) => e.preventDefault()}
            onPressedChange={() =>
              update((b) => ({
                ...b,
                paragraphStyle: { ...b.paragraphStyle, align },
              }))
            }
          >
            {["左对齐", "居中", "右对齐"][i]}
          </ToggleButton>
        ))}
      </div>
      <div className="panel-row">
        {(["lineHeight", "letterSpacing"] as const).map((key) => (
          <label className="panel-field" key={key}>
            {key === "lineHeight" ? "行高" : "字距"}
            <NumberField
              aria-label={key === "lineHeight" ? "文字行高" : "文字字距"}
              variant="stepper"
              unit={key === "lineHeight" ? "倍" : "px"}
              step={key === "lineHeight" ? 0.1 : 1}
              min={key === "lineHeight" ? 0.5 : -100}
              max={key === "lineHeight" ? 5 : 1000}
              value={block.paragraphStyle[key]}
              {...draft(key)}
              onInteractionStart={onNumericStart}
              onInteractionEnd={onNumericEnd}
              onValueChange={(n) =>
                update((b) => ({
                  ...b,
                  paragraphStyle: { ...b.paragraphStyle, [key]: n },
                }))
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
