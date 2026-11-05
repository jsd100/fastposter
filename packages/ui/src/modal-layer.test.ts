import { describe, expect, it, vi } from "vitest";
import {
  hasActiveOverlay,
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
    expect(hasActiveOverlay()).toBe(true);

    releaseSecond();
    expect(topModalLayer()).toBe(first);
    releaseFirst();
    expect(topModalLayer()).toBeNull();
    expect(hasActiveOverlay()).toBe(false);
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

  it("treats a popup as an active overlay without a modal", () => {
    const release = registerPopupLayer();
    expect(hasActiveOverlay()).toBe(true);
    release();
    expect(hasActiveOverlay()).toBe(false);
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
