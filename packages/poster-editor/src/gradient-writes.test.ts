import { describe, expect, it } from "vitest";
import { gradientWritesEnabled } from "./gradient-writes";

describe("gradientWritesEnabled", () => {
  it("is closed unless the deployment opts in", () => {
    expect(gradientWritesEnabled({})).toBe(false);
    expect(gradientWritesEnabled({ VITE_GRADIENT_WRITES: "0" })).toBe(false);
    expect(gradientWritesEnabled({ VITE_GRADIENT_WRITES: "true" })).toBe(false);
  });

  it("opens only on the exact opt-in value", () => {
    expect(gradientWritesEnabled({ VITE_GRADIENT_WRITES: "1" })).toBe(true);
  });
});
