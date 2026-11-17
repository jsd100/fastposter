import { it, expect } from "vitest";
import { fontFamilies, fontWeights, fontWeightRange } from "./font-options";

function variable(over: Record<string, unknown> = {}) {
  return {
    assetId: "vf",
    version: "1",
    family: "Variable",
    weight: 400,
    style: "normal" as const,
    url: "/font",
    minWeight: 100,
    maxWeight: 900,
    ...over,
  };
}
it("offers real non-400 font weights without inventing bold", () => {
  const fonts = [
    {
      assetId: "medium",
      version: "1",
      family: "Actual Medium",
      weight: 500,
      style: "normal" as const,
      url: "/font",
    },
  ];
  expect(fontFamilies(fonts)[0].assetId).toBe("medium");
  expect(fontWeights(fonts, "Actual Medium").map((f) => f.weight)).toEqual([
    500,
  ]);
});

it("clamps the continuous slider to the 100-700 product range", () => {
  expect(fontWeightRange([variable()], "Variable")).toEqual([100, 700]);
  expect(
    fontWeightRange([variable({ minWeight: 200, maxWeight: 900 })], "Variable"),
  ).toEqual([200, 700]);
});

it("keeps the discrete weight list for static fonts", () => {
  const staticFace = {
    assetId: "static",
    version: "1",
    family: "Static",
    weight: 400,
    style: "normal" as const,
    url: "/font",
  };
  expect(fontWeightRange([staticFace], "Static")).toBeNull();
});

it("does not show a slider for a family that has no matching face", () => {
  expect(fontWeightRange([variable()], "Missing")).toBeNull();
});
