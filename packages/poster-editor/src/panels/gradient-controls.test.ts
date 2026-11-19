import { describe, expect, it } from "vitest";
import {
  addGradientStop,
  angleFromPoint,
  initialGradientStops,
  normalizeGradientAngle,
} from "./gradient-controls";

describe("gradient controls", () => {
  it("uses CSS clock coordinates and wraps past north", () => {
    expect(angleFromPoint(0, -10)).toBe(0);
    expect(angleFromPoint(10, 0)).toBe(90);
    expect(angleFromPoint(0, 10)).toBe(180);
    expect(angleFromPoint(-10, 0)).toBe(270);
    expect(angleFromPoint(1, 1)).toBeNull();
    expect(normalizeGradientAngle(-0.5)).toBe(359.5);
    expect(normalizeGradientAngle(360)).toBe(0);
  });

  it("keeps the current solid color and alpha in the initial gradient", () => {
    expect(initialGradientStops("#00000080")).toEqual([
      { color: "#00000080", offset: 0 },
      { color: "#59595980", offset: 100 },
    ]);
    expect(initialGradientStops(null)[0].color).toBe("#FFB75E");
  });

  it("adds an interpolated stop in the first widest interval", () => {
    const result = addGradientStop([
      { color: "#ffffff", offset: 0 },
      { color: "#00000080", offset: 40 },
      { color: "#ffffff00", offset: 100 },
    ]);
    expect(result.index).toBe(2);
    expect(result.stops[2]).toEqual({ color: "#00000040", offset: 70 });
  });

  it("keeps both colors when the existing stops have the same offset", () => {
    const { index, stops } = addGradientStop([
      { color: "#ff0000", offset: 50 },
      { color: "#0000ff", offset: 50 },
    ]);
    expect(index).toBe(1);
    expect(stops.map((stop) => [stop.offset, stop.color])).toEqual([
      [50, "#ff0000"],
      [50, "#ff0000"],
      [50, "#0000ff"],
    ]);
  });
});
