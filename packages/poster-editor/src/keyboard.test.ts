import { registerModalLayer, registerPopupLayer } from "@fastposter/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isEditorShortcutBlocked,
  shouldIgnoreEditorShortcut,
  type ShortcutContext,
} from "./keyboard";

const quiet: ShortcutContext = {
  defaultPrevented: false,
  isComposing: false,
  editableTarget: false,
  pickerTarget: false,
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

function keyboardEvent(target: EventTarget | null = null): KeyboardEvent {
  return {
    target,
    defaultPrevented: false,
    isComposing: false,
    keyCode: 0,
  } as unknown as KeyboardEvent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shouldIgnoreEditorShortcut", () => {
  it("blocks canvas shortcuts while a registered modal is open and resumes after", () => {
    const release = registerModalLayer({} as HTMLElement);
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(true);
    release();
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(false);
  });

  it("treats registered popups as active layers", () => {
    const release = registerPopupLayer();
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(true);
    release();
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(false);
  });

  it("leaves canvas shortcuts alive inside a registered workbench", () => {
    // The template workspace is the editor's own host: registering it keeps
    // notices routed, but must not silence undo, redo or delete.
    const release = registerModalLayer({} as HTMLElement, {
      blocksShortcuts: false,
    });
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(false);
    release();
  });

  it("blocks shortcuts for a dialog opened above the workbench", () => {
    const releaseWorkbench = registerModalLayer({} as HTMLElement, {
      blocksShortcuts: false,
    });
    const releaseDialog = registerModalLayer({} as HTMLElement);
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(true);
    releaseDialog();
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(false);
    releaseWorkbench();
  });

  it("keeps honouring the legacy DOM markers", () => {
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === "[data-fp-overlay]" ? {} : null,
      querySelectorAll: () => [],
    });
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(true);
  });

  it("ignores a popup marker antd kept mounted but hidden", () => {
    vi.stubGlobal("document", {
      querySelector: () => null,
      querySelectorAll: (selector: string) =>
        selector === "[data-fp-popup]" ? [{ getClientRects: () => [] }] : [],
    });
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(false);
  });

  it("blocks shortcuts while a popup still occupies layout", () => {
    vi.stubGlobal("document", {
      querySelector: () => null,
      querySelectorAll: (selector: string) =>
        selector === "[data-fp-popup]" ? [{ getClientRects: () => [{}] }] : [],
    });
    expect(shouldIgnoreEditorShortcut(keyboardEvent())).toBe(true);
  });
});
