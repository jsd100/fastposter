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

export function hasActiveOverlay() {
  return layers.length > 0 || popupLayers > 0;
}
