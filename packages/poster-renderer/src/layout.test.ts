import { it, expect } from "vitest";
import { hasOverflow } from "./layout";
import { fontFamily } from "./FontRegistry";
it("keeps distinct asset ids in distinct CSS font families", () =>
  expect(fontFamily("font-1")).not.toBe(fontFamily("font_1")));
it("allows text inside and detects natural height below canvas", () => {
  expect(
    hasOverflow({
      width: 100,
      height: 100,
      blocks: [{ id: "a", x: 10, y: 10, width: 80, height: 80 }],
    }),
  ).toBe(false);
  expect(
    hasOverflow({
      width: 100,
      height: 100,
      blocks: [{ id: "a", x: 10, y: 10, width: 80, height: 91 }],
    }),
  ).toBe(true);
});
