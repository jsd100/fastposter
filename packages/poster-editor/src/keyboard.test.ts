import { describe, expect, it } from "vitest";
import { isEditorShortcutBlocked, type ShortcutContext } from "./keyboard";

const quiet: ShortcutContext = {
  defaultPrevented: false,
  isComposing: false,
  editableTarget: false,
  interactiveTarget: false,
  overlayOpen: false,
};

describe("isEditorShortcutBlocked", () => {
  it("lets the shortcut through when nothing claims the keystroke", () => {
    expect(isEditorShortcutBlocked(quiet)).toBe(false);
  });

  it.each(Object.keys(quiet) as (keyof ShortcutContext)[])(
    "blocks the shortcut when %s is set",
    (flag) => {
      expect(isEditorShortcutBlocked({ ...quiet, [flag]: true })).toBe(true);
    },
  );
});
