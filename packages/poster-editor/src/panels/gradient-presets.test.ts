import { describe, expect, it } from "vitest";
import { parseTextColor } from "@fastposter/poster-schema";
import { gradientPresets, matchGradientPreset } from "./gradient-presets";

describe("gradient presets", () => {
  it("offers twelve valid, unique presets per gradient type", () => {
    for (const type of ["linear", "radial"] as const) {
      const presets = gradientPresets.filter(
        (preset) => preset.value.type === type,
      );
      expect(presets).toHaveLength(12);
      expect(new Set(presets.map((preset) => preset.id)).size).toBe(12);
      for (const preset of presets) {
        expect(parseTextColor(preset.value)).toEqual(preset.value);
        expect(matchGradientPreset(preset.value)?.id).toBe(preset.id);
      }
    }
  });

  it("matches saved equivalents and treats parameter changes as custom", () => {
    const linear = gradientPresets.find(
      (preset) => preset.id === "cool-sea",
    )!.value;
    if (linear.type !== "linear") throw Error("Expected the linear variant");
    const saved = {
      ...linear,
      rangeId: "existing-mark",
      stops: linear.stops.map((stop) => ({
        ...stop,
        color: `${stop.color.toLowerCase()}ff`,
      })),
    };
    expect(matchGradientPreset(saved)?.id).toBe("cool-sea");
    expect(matchGradientPreset({ ...saved, angle: 91 })).toBeUndefined();
  });
});
