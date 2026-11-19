import type { RefSelectProps } from "antd";
import type { RefObject } from "react";
import type { TextColor } from "@fastposter/poster-schema";
import { gradientCSS, isGradientColor } from "@fastposter/poster-renderer";
import { Select } from "@fastposter/ui";
import { colorPresets, presetHexKey } from "./color-presets";
import { gradientPresets, matchGradientPreset } from "./gradient-presets";
import styles from "./TextColorField.module.css";

const solidOptions = colorPresets.map((preset) => ({
  ...preset,
  group: preset.label.split(" · ", 1)[0],
}));
const solidValues = new Map(
  solidOptions.map(({ value }) => [presetHexKey(value), value]),
);
const gradientsById = new Map(
  gradientPresets.map((preset) => [preset.id, preset]),
);
const gradientOptions = {
  linear: makeGradientOptions("linear"),
  radial: makeGradientOptions("radial"),
};

function makeGradientOptions(type: "linear" | "radial") {
  return gradientPresets
    .filter((preset) => preset.value.type === type)
    .map((preset) => ({
      value: preset.id,
      label: preset.label,
      group: preset.group,
      preview: (
        <span
          className={
            type === "linear" ? styles.linearSwatch : styles.radialSwatch
          }
          style={{ backgroundImage: gradientCSS(preset.value) }}
        />
      ),
    }));
}

export function TextColorPresetSelect({
  value,
  open,
  selectRef,
  onOpenChange,
  getPopupContainer,
  onChange,
}: {
  value: TextColor | null;
  open: boolean;
  selectRef: RefObject<RefSelectProps | null>;
  onOpenChange: (open: boolean) => void;
  getPopupContainer: (node: HTMLElement) => HTMLElement;
  onChange: (value: TextColor) => void;
}) {
  const gradient = isGradientColor(value) ? value : null;
  const label =
    gradient?.type === "linear"
      ? "线性渐变预设"
      : gradient?.type === "radial"
        ? "径向渐变预设"
        : "预设文字颜色";
  const selected = gradient
    ? matchGradientPreset(gradient)?.id
    : typeof value === "string"
      ? solidValues.get(presetHexKey(value))
      : undefined;

  return (
    <div className={styles.presetField}>
      <span>{label}</span>
      <Select
        key={label}
        ref={selectRef}
        aria-label={label}
        value={selected ?? ""}
        valueLabel={
          selected
            ? undefined
            : gradient
              ? "自定义渐变"
              : value
                ? "自定义颜色"
                : "混合颜色"
        }
        options={gradient ? gradientOptions[gradient.type] : solidOptions}
        searchable={!gradient}
        showSelectedPreview={!!gradient}
        open={open}
        getPopupContainer={getPopupContainer}
        onOpenChange={onOpenChange}
        onValueChange={(next) => {
          if (!gradient) {
            onChange(next);
            return;
          }
          const preset = gradientsById.get(next);
          if (preset?.value.type === gradient.type)
            onChange({ ...preset.value, rangeId: gradient.rangeId });
        }}
      />
    </div>
  );
}
