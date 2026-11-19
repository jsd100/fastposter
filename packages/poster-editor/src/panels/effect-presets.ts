import type { TextBlock } from "@fastposter/poster-schema";

type EffectPatch = Partial<TextBlock["effects"]>;

export type EffectPreset = {
  value: string;
  label: string;
  patch: EffectPatch;
};

export const CUSTOM_EFFECT_PRESET = "custom";

/** Values are design defaults from spec §2; colors stay in document hex form. */
export const shadowPresets: readonly EffectPreset[] = [
  {
    value: "none",
    label: "无",
    patch: {
      shadowColor: "#00000000",
      shadowX: 0,
      shadowY: 0,
      shadowBlur: 0,
    },
  },
  {
    value: "soft",
    label: "柔和投影",
    patch: {
      shadowColor: "#00000073",
      shadowX: 2,
      shadowY: 3,
      shadowBlur: 6,
    },
  },
  {
    value: "hard",
    label: "硬边投影",
    patch: {
      shadowColor: "#000000B3",
      shadowX: 3,
      shadowY: 3,
      shadowBlur: 0,
    },
  },
  {
    value: "glow",
    label: "发光",
    patch: {
      shadowColor: "#FFFFFFCC",
      shadowX: 0,
      shadowY: 0,
      shadowBlur: 6,
    },
  },
] as const;

export const strokePresets: readonly EffectPreset[] = [
  {
    value: "none",
    label: "无",
    // Turning stroke off keeps the current color so it can be restored.
    patch: { strokeWidth: 0 },
  },
  {
    value: "light",
    label: "亮色细描边",
    patch: { strokeColor: "#FFFFFF", strokeWidth: 1 },
  },
  {
    value: "dark",
    label: "暗色细描边",
    patch: { strokeColor: "#151515", strokeWidth: 1 },
  },
  {
    value: "bold",
    label: "粗描边",
    patch: { strokeColor: "#151515", strokeWidth: 3 },
  },
] as const;

const sameColor = (a: string | undefined, b: string | undefined) =>
  a?.toLowerCase() === b?.toLowerCase();

function matches(
  effects: TextBlock["effects"],
  patch: EffectPatch,
  keys: readonly (keyof EffectPatch)[],
): boolean {
  return keys.every((key) => {
    const expected = patch[key];
    const actual = effects[key];
    return typeof expected === "string"
      ? sameColor(actual as string, expected)
      : actual === expected;
  });
}

const shadowKeys = ["shadowColor", "shadowX", "shadowY", "shadowBlur"] as const;

export function matchShadowPreset(
  effects: TextBlock["effects"],
): EffectPreset | undefined {
  return shadowPresets.find((preset) =>
    matches(effects, preset.patch, shadowKeys),
  );
}

export function matchStrokePreset(
  effects: TextBlock["effects"],
): EffectPreset | undefined {
  // The off preset deliberately ignores strokeColor.
  if (effects.strokeWidth === 0) return strokePresets[0];
  return strokePresets
    .slice(1)
    .find((preset) =>
      matches(effects, preset.patch, ["strokeColor", "strokeWidth"]),
    );
}

export const initialShadowPatch = shadowPresets[1].patch;
export const initialStrokePatch = strokePresets[2].patch;
