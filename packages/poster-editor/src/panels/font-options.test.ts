import { it, expect } from "vitest";
import {
  familySupportsWeight,
  fontFamilies,
  fontWeights,
  fontWeightRange,
} from "./font-options";

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

it("checks the weight within the requested font style", () => {
  const italic = {
    assetId: "italic-400",
    version: "1",
    family: "Variable",
    weight: 400,
    style: "italic" as const,
    url: "/italic",
  };
  const fonts = [variable(), italic];
  expect(familySupportsWeight(fonts, "Variable", 700, "normal")).toBe(true);
  expect(familySupportsWeight(fonts, "Variable", 400, "italic")).toBe(true);
  expect(familySupportsWeight(fonts, "Variable", 700, "italic")).toBe(false);
});
