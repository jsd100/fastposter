import type { TextBlock } from "@fastposter/poster-schema";
import { Button, NumberField } from "@fastposter/ui";
export function StylePanel({
  block,
  update,
  onNumericStart,
  onNumericEnd,
}: {
  block: TextBlock;
  update: (change: (b: TextBlock) => TextBlock) => void;
  onNumericStart: () => void;
  onNumericEnd: () => void;
}) {
  const fields = [
    ["padding", "内边距", 0, Math.max(0, block.width / 2 - 0.001), 1],
    ["strokeWidth", "描边宽度", 0, 40, 1],
    ["shadowBlur", "阴影模糊", 0, 200, 1],
    ["shadowX", "阴影 X", -500, 500, 1],
    ["shadowY", "阴影 Y", -500, 500, 1],
  ] as const;
  return (
    <details className="effect-panel">
      <summary>文字效果</summary>
      <div className="panel-row">
        <label className="panel-field">
          透明度
          <NumberField
            aria-label="透明度"
            variant="stepper"
            unit="%"
            value={Math.round(block.effects.opacity * 100)}
            min={0}
            max={100}
            step={5}
            onInteractionStart={onNumericStart}
            onInteractionEnd={onNumericEnd}
            onValueChange={(value) =>
              update((b) => ({
                ...b,
                effects: { ...b.effects, opacity: value / 100 },
              }))
            }
          />
        </label>
        {fields.map(([key, label, min, max, step]) => (
          <label key={key} className="panel-field">
            {label}
            <NumberField
              aria-label={label}
              variant="stepper"
              unit="px"
              value={block.effects[key]}
              min={min}
              max={max}
              step={step}
              onInteractionStart={onNumericStart}
              onInteractionEnd={onNumericEnd}
              onValueChange={(value) =>
                update((b) => ({
                  ...b,
                  effects: { ...b.effects, [key]: value },
                }))
              }
            />
          </label>
        ))}
      </div>
      {(["backgroundColor", "strokeColor", "shadowColor"] as const).map(
        (key, i) => (
          <label key={key} className="panel-field">
            {["文字背景色", "描边颜色", "阴影颜色"][i]}
            <input
              type="color"
              aria-label={["文字背景色", "描边颜色", "阴影颜色"][i]}
              value={block.effects[key].slice(0, 7)}
              onChange={(e) =>
                update((b) => ({
                  ...b,
                  effects: { ...b.effects, [key]: e.target.value },
                }))
              }
            />
            {key !== "strokeColor" && (
              <Button
                variant="ghost"
                className="clear-effect"
                onClick={() =>
                  update((b) => ({
                    ...b,
                    effects: { ...b.effects, [key]: "#00000000" },
                  }))
                }
              >
                设为透明
              </Button>
            )}
          </label>
        ),
      )}
    </details>
  );
}
