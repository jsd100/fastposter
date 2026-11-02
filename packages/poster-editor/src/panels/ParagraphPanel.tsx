import type { TextBlock } from "@fastposter/poster-schema";
import { NumberField, ToggleButton } from "@fastposter/ui";
export function ParagraphPanel({
  block,
  update,
}: {
  block: TextBlock;
  update: (change: (b: TextBlock) => TextBlock) => void;
}) {
  return (
    <section>
      <h3>段落</h3>
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
              step={key === "lineHeight" ? 0.1 : 1}
              min={key === "lineHeight" ? 0.5 : -100}
              max={key === "lineHeight" ? 5 : 1000}
              value={block.paragraphStyle[key]}
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
    </section>
  );
}
