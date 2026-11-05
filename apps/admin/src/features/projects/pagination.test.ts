import { expect, it } from "vitest";
import { pageAfterShrink } from "./pagination";

it("falls back one page when the last remaining item disappears", () => {
  expect(pageAfterShrink(2, 24, 0, 24)).toBe(1);
});

it("falls back to the last populated page after a multi-page shrink", () => {
  expect(pageAfterShrink(3, 48, 0, 24)).toBe(2);
  expect(pageAfterShrink(3, 0, 0, 24)).toBe(1);
});

it("keeps the current page while it still has items", () => {
  expect(pageAfterShrink(2, 25, 1, 24)).toBe(2);
  expect(pageAfterShrink(1, 0, 0, 24)).toBe(1);
});
