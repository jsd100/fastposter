import { describe, expect, it } from "vitest";
import { listState } from "./catalog-state";

describe("listState", () => {
  it("says loading while the first attempt is still in flight", () => {
    expect(listState({ pending: true, failed: false, rows: 0 })).toBe(
      "loading",
    );
  });

  it("separates a failed query from an empty one", () => {
    expect(listState({ pending: false, failed: true, rows: 0 })).toBe("failed");
  });

  it("claims an empty list only after rows actually arrived", () => {
    expect(listState({ pending: false, failed: false, rows: 0 })).toBe("empty");
  });

  it("is ready as soon as rows are on screen", () => {
    expect(listState({ pending: false, failed: false, rows: 3 })).toBe("ready");
  });
});
