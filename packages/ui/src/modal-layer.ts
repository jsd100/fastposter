let layers: { element: HTMLElement; blocksShortcuts: boolean }[] = [];
let popupLayers = 0;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

/**
 * Put a floating container on top of the stack. Notices route into the topmost
 * layer and, unless `blocksShortcuts` is false, the layer owns the keyboard.
 *
 * A container that *hosts* the editor — the template workspace — is registered
 * with `blocksShortcuts: false`: it should still receive notices, but undo,
 * redo and delete belong to the canvas inside it.
 */
export function registerModalLayer(
  element: HTMLElement,
  options?: { blocksShortcuts?: boolean },
) {
  const blocks = options?.blocksShortcuts ?? true;
  layers = [
    ...layers.filter((item) => item.element !== element),
    { element, blocksShortcuts: blocks },
  ];
  publish();
  return () => {
    layers = layers.filter((item) => item.element !== element);
    publish();
  };
}

/**
 * Tracks a non-modal floating layer such as a select menu. The editor uses it
 * to pause canvas shortcuts while the menu owns the keyboard.
 */
export function registerPopupLayer() {
  popupLayers += 1;
  publish();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    popupLayers = Math.max(0, popupLayers - 1);
    publish();
  };
}

export function subscribeModalLayers(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function topModalLayer() {
  return layers[layers.length - 1]?.element ?? null;
}

export function hasPopupLayer() {
  return popupLayers > 0;
}

/**
 * antd keeps a closed dropdown mounted with `display: none`, so a DOM marker
 * alone would keep shortcuts blocked forever. Only a popup that still occupies
 * layout owns the keyboard.
 */
export function hasVisiblePopup() {
  if (typeof document === "undefined") return false;
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-fp-popup]"),
  ).some((popup) => popup.getClientRects().length > 0);
}

/**
 * Whether the keyboard belongs to something other than the canvas. A workbench
 * layer sits on the stack but does not claim the keystrokes, because the editor
 * it hosts still answers undo, redo and delete.
 */
export function hasBlockingOverlay() {
  return layers.some((layer) => layer.blocksShortcuts) || popupLayers > 0;
}
