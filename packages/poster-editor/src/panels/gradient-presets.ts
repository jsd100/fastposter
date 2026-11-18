import type { LinearGradient, RadialGradient } from "@fastposter/poster-schema";

export type GradientPreset = {
  label: string;
  value: LinearGradient | RadialGradient;
};

const stops = (from: string, to: string) => [
  { color: from, offset: 0 },
  { color: to, offset: 100 },
];

export const gradientPresets: GradientPreset[] = [
  {
    label: "暖阳 · 横向",
    value: {
      type: "linear",
      rangeId: "preset",
      angle: 90,
      stops: stops("#FFB75E", "#ED8F03"),
    },
  },
  {
    label: "冷海 · 横向",
    value: {
      type: "linear",
      rangeId: "preset",
      angle: 90,
      stops: stops("#4FACFE", "#00F2FE"),
    },
  },
  {
    label: "森林 · 斜向",
    value: {
      type: "linear",
      rangeId: "preset",
      angle: 45,
      stops: stops("#11998E", "#38EF7D"),
    },
  },
  {
    label: "霞光 · 中心扩散",
    value: {
      type: "radial",
      rangeId: "preset",
      centerX: 50,
      centerY: 50,
      stops: stops("#FF9A9E", "#FECFEF"),
    },
  },
];
