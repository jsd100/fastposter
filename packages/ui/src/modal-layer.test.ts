import { describe, expect, it, vi } from "vitest";
import {
  hasBlockingOverlay,
  hasPopupLayer,
  hasVisiblePopup,
  registerModalLayer,
  registerPopupLayer,
  subscribeModalLayers,
  topModalLayer,
} from "./modal-layer";

function element(name: string): HTMLElement {
  return { name } as unknown as HTMLElement;
}

describe("modal layer registry", () => {
  it("exposes the topmost modal and restores the one below it", () => {
    const first = element("first");
    const second = element("second");
    const listener = vi.fn();
    const unsubscribe = subscribeModalLayers(listener);
    const releaseFirst = registerModalLayer(first);
    const releaseSecond = registerModalLayer(second);

    expect(topModalLayer()).toBe(second);
    expect(hasBlockingOverlay()).toBe(true);

    releaseSecond();
    expect(topModalLayer()).toBe(first);
    releaseFirst();
    expect(topModalLayer()).toBeNull();
    expect(hasBlockingOverlay()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });

  it("counts popup layers and ignores a repeated release", () => {
    expect(hasPopupLayer()).toBe(false);
    const releaseFirst = registerPopupLayer();
    const releaseSecond = registerPopupLayer();
    expect(hasPopupLayer()).toBe(true);

    releaseFirst();
    expect(hasPopupLayer()).toBe(true);
    releaseFirst();
    expect(hasPopupLayer()).toBe(true);
    releaseSecond();
    expect(hasPopupLayer()).toBe(false);
  });

  it("carries a workbench layer without letting it claim the keystrokes", () => {
    const workbench = element("workbench");
    const release = registerModalLayer(workbench, { blocksShortcuts: false });

    // The workspace still owns the notices and sits on the stack; only the
    // shortcut blocking is dropped, because the workspace hosts the editor.
    expect(topModalLayer()).toBe(workbench);
    expect(hasBlockingOverlay()).toBe(false);
    release();
    expect(topModalLayer()).toBeNull();
    expect(hasBlockingOverlay()).toBe(false);
  });

  it("keeps blocking while a dialog opens above a workbench and after it closes", () => {
    const workbench = element("workbench");
    const dialog = element("dialog");
    const releaseWorkbench = registerModalLayer(workbench, {
      blocksShortcuts: false,
    });
    const releaseDialog = registerModalLayer(dialog);

    expect(topModalLayer()).toBe(dialog);
    expect(hasBlockingOverlay()).toBe(true);

    releaseDialog();
    expect(topModalLayer()).toBe(workbench);
    expect(hasBlockingOverlay()).toBe(false);
    releaseWorkbench();
  });

  it("counts a registered popup as a blocking overlay", () => {
    const release = registerPopupLayer();
    expect(hasBlockingOverlay()).toBe(true);
    release();
    expect(hasBlockingOverlay()).toBe(false);
  });
});

describe("hasVisiblePopup", () => {
  it("only counts a popup that still occupies layout", () => {
    vi.stubGlobal("document", {
      querySelectorAll: () => [
        { getClientRects: () => [] },
        { getClientRects: () => [{}] },
      ],
    });
    expect(hasVisiblePopup()).toBe(true);
  });

  it("ignores hidden popups antd kept mounted", () => {
    vi.stubGlobal("document", {
      querySelectorAll: () => [{ getClientRects: () => [] }],
    });
    expect(hasVisiblePopup()).toBe(false);
  });
});
