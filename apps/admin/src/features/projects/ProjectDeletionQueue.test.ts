import { expect, it } from "vitest";
import { deletionConfirmDisabled } from "@fastposter/ui";
import { canPermanentlyDelete } from "./ProjectDeletionQueue";

it("requires the ownership acknowledgement before an admin can confirm", () => {
  expect(deletionConfirmDisabled(true, false, false)).toBe(true);
  expect(deletionConfirmDisabled(true, true, false)).toBe(false);
});

it("only offers permanent deletion for projects in the recycle bin", () => {
  expect(canPermanentlyDelete({ deletedAt: "2026-11-04T00:00:00Z" })).toBe(
    true,
  );
  expect(canPermanentlyDelete({})).toBe(false);
});
