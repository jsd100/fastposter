let layers: HTMLElement[] = [];
let popupLayers = 0;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

export function registerModalLayer(element: HTMLElement) {
  layers = [...layers.filter((item) => item !== element), element];
  publish();
  return () => {
    layers = layers.filter((item) => item !== element);
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
  return layers[layers.length - 1] ?? null;
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

export function hasActiveOverlay() {
  return layers.length > 0 || popupLayers > 0;
}
