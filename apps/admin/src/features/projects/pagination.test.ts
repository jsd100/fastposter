import { expect, it } from "vitest";
import {
  pageAfterShrink,
  adminPageIdentity,
  canCorrectAdminPage,
} from "./pagination";

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

/* FP-09 / Ruling 106. Admin lists share the same rule: only a successful,
   settled result for the current query identity may correct the page. */
it("builds one identity from the admin query dimensions", () => {
  expect(adminPageIdentity(["background", 2, "风景", "cat1"])).toBe(
    "background|2|风景|cat1",
  );
  expect(adminPageIdentity(["template", 1, "", ""])).toBe("template|1||");
});

it("allows an admin correction only for a settled success of the current identity", () => {
  const identity = adminPageIdentity(["copy", 2, "", "cat1"]);
  const settled = {
    isSuccess: true,
    isError: false,
    fetchStatus: "idle" as const,
    resultIdentity: identity,
    viewIdentity: identity,
  };
  expect(canCorrectAdminPage(settled)).toBe(true);
  // A failed refetch keeps the old `data`; the error must veto the correction.
  expect(canCorrectAdminPage({ ...settled, isError: true })).toBe(false);
  expect(
    canCorrectAdminPage({ ...settled, isSuccess: false, isError: true }),
  ).toBe(false);
  // A reply still in flight is not finished data.
  expect(canCorrectAdminPage({ ...settled, fetchStatus: "fetching" })).toBe(
    false,
  );
  expect(canCorrectAdminPage({ ...settled, isSuccess: false })).toBe(false);
  // A late reply from an old filter/page must not move the position.
  expect(
    canCorrectAdminPage({ ...settled, resultIdentity: "copy|1||cat1" }),
  ).toBe(false);
});
