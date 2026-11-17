import type { TextBlock } from "@fastposter/poster-schema";
import {
  Button,
  NumberField,
  Select,
  type NumberDraftBinding,
} from "@fastposter/ui";
import type { CSSProperties, ReactElement } from "react";
import { ColorField } from "./ColorField";
import {
  CUSTOM_EFFECT_PRESET,
  initialShadowPatch,
  initialStrokePatch,
  matchShadowPreset,
  matchStrokePreset,
  shadowPresets,
  strokePresets,
  type EffectPreset,
} from "./effect-presets";

type NumericEffectField =
  "opacity" | "padding" | "strokeWidth" | "shadowBlur" | "shadowX" | "shadowY";

type ColorEffectField = "backgroundColor" | "strokeColor" | "shadowColor";

function presetSample(preset: EffectPreset, kind: "shadow" | "stroke") {
  const patch = preset.patch;
  const glow = patch.shadowColor?.toLowerCase() === "#ffffffcc";
  const lightStroke = patch.strokeColor?.toLowerCase() === "#ffffff";
  const dark = kind === "shadow" ? glow : lightStroke;
  const style: CSSProperties = {
    display: "inline-block",
    minWidth: "3.5em",
    padding: "0 6px",
    borderRadius: 4,
    background: dark ? "#151515" : "#ffffff",
    color: dark ? "#ffffff" : "#151515",
    fontWeight: 600,
    paintOrder: "stroke fill",
    WebkitTextStroke: patch.strokeWidth
      ? `${patch.strokeWidth}px ${patch.strokeColor ?? "#151515"}`
      : undefined,
    textShadow:
      patch.shadowColor && patch.shadowColor !== "#00000000"
        ? `${patch.shadowX ?? 0}px ${patch.shadowY ?? 0}px ${patch.shadowBlur ?? 0}px ${patch.shadowColor}`
        : undefined,
  };
  return <span style={style}>Aa</span>;
}

function customSample(): ReactElement {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: "3.5em",
        padding: "0 6px",
        borderRadius: 4,
        background: "#f5f5f5",
        color: "#151515",
        fontWeight: 600,
      }}
    >
      Aa
    </span>
  );
}

export function StylePanel({
  block,
  update,
  onNumericStart,
  onNumericEnd,
  draft,
}: {
  block: TextBlock;
  update: (change: (b: TextBlock) => TextBlock) => void;
  onNumericStart: () => void;
  onNumericEnd: (action: "commit" | "cancel") => void;
  draft: (field: string) => NumberDraftBinding;
}) {
  function applyPatch(patch: Partial<TextBlock["effects"]>) {
    update((b) => ({ ...b, effects: { ...b.effects, ...patch } }));
  }

  function numberField(
    key: NumericEffectField,
    label: string,
    min: number,
    max: number,
    step = 1,
    unit = "px",
    scale = 1,
  ) {
    return (
      <label key={key} className="panel-field">
        {label}
        <NumberField
          aria-label={label}
          variant="stepper"
          unit={unit}
          value={block.effects[key] * scale}
          min={min}
          max={max}
          step={step}
          {...draft(key)}
          onInteractionStart={onNumericStart}
          onInteractionEnd={onNumericEnd}
          onValueChange={(value) =>
            applyPatch({ [key]: value / scale } as Partial<
              TextBlock["effects"]
            >)
          }
        />
      </label>
    );
  }

  function colorField(
    key: ColorEffectField,
    label: string,
    clearable: boolean,
  ) {
    return (
      <label key={key} className="panel-field">
        {label}
        <ColorField
          label={label}
          value={block.effects[key]}
          onChange={(color) => applyPatch({ [key]: color })}
          onInteractionStart={onNumericStart}
          onInteractionEnd={onNumericEnd}
        />
        {clearable && (
          <Button
            variant="ghost"
            className="clear-effect"
            onClick={() => applyPatch({ [key]: "#00000000" })}
          >
            设为透明
          </Button>
        )}
      </label>
    );
  }

  function applyShadow(value: string) {
    if (value === CUSTOM_EFFECT_PRESET) {
      // Opening custom controls is inert once an effect already has parameters;
      // from a fully off state it initializes with the designed default.
      if (matchShadowPreset(block.effects)?.value === "none")
        applyPatch(initialShadowPatch);
      return;
    }
    const preset = shadowPresets.find((item) => item.value === value);
    if (preset) applyPatch(preset.patch);
  }

  function applyStroke(value: string) {
    if (value === CUSTOM_EFFECT_PRESET) {
      if (matchStrokePreset(block.effects)?.value === "none")
        applyPatch(initialStrokePatch);
      return;
    }
    const preset = strokePresets.find((item) => item.value === value);
    if (preset) applyPatch(preset.patch);
  }

  const shadowOptions = [
    ...shadowPresets.map((preset) => ({
      value: preset.value,
      label: preset.label,
      preview: presetSample(preset, "shadow"),
    })),
    {
      value: CUSTOM_EFFECT_PRESET,
      label: "自定义",
      preview: customSample(),
    },
  ];
  const strokeOptions = [
    ...strokePresets.map((preset) => ({
      value: preset.value,
      label: preset.label,
      preview: presetSample(preset, "stroke"),
    })),
    {
      value: CUSTOM_EFFECT_PRESET,
      label: "自定义",
      preview: customSample(),
    },
  ];

  return (
    <div className="effect-panel">
      <div className="panel-row">
        {numberField("opacity", "透明度", 0, 100, 5, "%", 100)}
        {numberField(
          "padding",
          "内边距",
          0,
          Math.max(0, block.width / 2 - 0.001),
        )}
      </div>

      <section className="effect-preset-group" data-effect-group="shadow">
        <label className="panel-field">
          预设阴影
          <Select
            aria-label="预设阴影"
            options={shadowOptions}
            value={
              matchShadowPreset(block.effects)?.value ?? CUSTOM_EFFECT_PRESET
            }
            onValueChange={applyShadow}
          />
        </label>
        <div className="panel-row">
          {numberField("shadowX", "阴影 X", -500, 500)}
          {numberField("shadowY", "阴影 Y", -500, 500)}
          {numberField("shadowBlur", "阴影模糊", 0, 200)}
        </div>
        {colorField("shadowColor", "阴影颜色", true)}
      </section>

      <section className="effect-preset-group" data-effect-group="stroke">
        <label className="panel-field">
          预设描边
          <Select
            aria-label="预设描边"
            options={strokeOptions}
            value={
              matchStrokePreset(block.effects)?.value ?? CUSTOM_EFFECT_PRESET
            }
            onValueChange={applyStroke}
          />
        </label>
        <div className="panel-row">
          {numberField("strokeWidth", "描边宽度", 0, 40)}
        </div>
        {colorField("strokeColor", "描边颜色", false)}
      </section>

      {colorField("backgroundColor", "文字背景色", true)}
    </div>
  );
}
