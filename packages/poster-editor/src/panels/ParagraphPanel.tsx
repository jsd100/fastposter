import type { TextBlock } from "@fastposter/poster-schema";
import { Button } from "@fastposter/ui";
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
          <Button
            key={align}
            aria-label={["左对齐", "居中对齐", "右对齐"][i]}
            aria-pressed={block.paragraphStyle.align === align}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() =>
              update((b) => ({
                ...b,
                paragraphStyle: { ...b.paragraphStyle, align },
              }))
            }
          >
            {["左对齐", "居中", "右对齐"][i]}
          </Button>
        ))}
      </div>
      <div className="panel-row">
        {(["lineHeight", "letterSpacing"] as const).map((key) => (
          <label className="panel-field" key={key}>
            {key === "lineHeight" ? "行高" : "字距"}
            <input
              aria-label={key === "lineHeight" ? "文字行高" : "文字字距"}
              type="number"
              step={key === "lineHeight" ? ".1" : "1"}
              min={key === "lineHeight" ? ".5" : "-100"}
              max={key === "lineHeight" ? "5" : "1000"}
              value={block.paragraphStyle[key]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (
                  Number.isFinite(n) &&
                  n >= Number(e.target.min) &&
                  n <= Number(e.target.max)
                )
                  update((b) => ({
                    ...b,
                    paragraphStyle: { ...b.paragraphStyle, [key]: n },
                  }));
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
