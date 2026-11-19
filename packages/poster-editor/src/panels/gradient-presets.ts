import {
  gradientValueKey,
  type TextGradient,
} from "@fastposter/poster-renderer";
import { presetHexKey } from "./color-presets";

export type GradientPreset = {
  id: string;
  label: string;
  group: string;
  value: TextGradient;
};

type Palette = {
  id: string;
  name: string;
  group: string;
  stops: TextGradient["stops"];
  angle: number;
  center?: readonly [number, number];
};

const twoColors = (from: string, to: string) => [
  { color: from, offset: 0 },
  { color: to, offset: 100 },
];

const palettes: Palette[] = [
  {
    id: "warm-sun",
    name: "暖阳",
    group: "暖色",
    stops: twoColors("#FFB75E", "#ED8F03"),
    angle: 90,
  },
  {
    id: "coral",
    name: "珊瑚日落",
    group: "暖色",
    stops: [
      { color: "#FDE68A", offset: 0 },
      { color: "#FB7185", offset: 56 },
      { color: "#9D174D", offset: 100 },
    ],
    angle: 110,
    center: [65, 40],
  },
  {
    id: "glow",
    name: "霞光",
    group: "暖色",
    stops: twoColors("#FF9A9E", "#FECFEF"),
    angle: 90,
  },
  {
    id: "cherry",
    name: "樱桃",
    group: "暖色",
    stops: twoColors("#FFB4BF", "#9F1239"),
    angle: 135,
    center: [30, 30],
  },
  {
    id: "cool-sea",
    name: "冷海",
    group: "冷色",
    stops: twoColors("#4FACFE", "#00F2FE"),
    angle: 90,
  },
  {
    id: "blue-hour",
    name: "蓝调时刻",
    group: "冷色",
    stops: [
      { color: "#1E1B4B", offset: 0 },
      { color: "#4F46E5", offset: 52 },
      { color: "#67E8F9", offset: 100 },
    ],
    angle: 135,
    center: [65, 35],
  },
  {
    id: "lilac",
    name: "暮紫",
    group: "冷色",
    stops: twoColors("#6D28D9", "#F5B8FF"),
    angle: 45,
  },
  {
    id: "ink-blue",
    name: "墨蓝",
    group: "冷色",
    stops: twoColors("#0F172A", "#57739E"),
    angle: 90,
    center: [30, 36],
  },
  {
    id: "forest",
    name: "森林",
    group: "自然与中性",
    stops: twoColors("#11998E", "#38EF7D"),
    angle: 45,
  },
  {
    id: "moss",
    name: "苔绿",
    group: "自然与中性",
    stops: twoColors("#365314", "#BEF264"),
    angle: 110,
    center: [35, 45],
  },
  {
    id: "sand",
    name: "浅砂",
    group: "自然与中性",
    stops: twoColors("#F5E9DB", "#AE7D58"),
    angle: 90,
  },
  {
    id: "silver",
    name: "银雾",
    group: "自然与中性",
    stops: twoColors("#F8FAFC", "#64748B"),
    angle: 135,
    center: [40, 30],
  },
];

export const defaultGradientStops = palettes[0].stops;

export const gradientPresets = palettes.flatMap<GradientPreset>(
  ({ id, name, group, stops, angle, center }) => {
    const [centerX, centerY] = center ?? [50, 50];
    return [
      {
        id,
        label: `${name} · ${angle === 90 ? "横向" : "斜向"}`,
        group,
        value: { type: "linear", rangeId: "preset", angle, stops },
      },
      {
        id: `${id}-radial`,
        label: `${name} · ${center ? "偏心扩散" : "中心扩散"}`,
        group,
        value: { type: "radial", rangeId: "preset", centerX, centerY, stops },
      },
    ];
  },
);

function gradientPresetKey(value: TextGradient) {
  return gradientValueKey({
    ...value,
    stops: value.stops.map((stop) => ({
      ...stop,
      color: presetHexKey(stop.color),
    })),
  });
}

const presetsByValue = new Map(
  gradientPresets.map((preset) => [gradientPresetKey(preset.value), preset]),
);

export function matchGradientPreset(value: TextGradient) {
  return presetsByValue.get(gradientPresetKey(value));
}
