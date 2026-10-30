import { it, expect } from "vitest";
import { fontFamilies, fontWeights } from "./font-options";
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
