import { subscribeModalLayers, topModalLayer } from "./modal-layer";

let layer: HTMLDivElement | null = null;

function attach() {
  if (!layer || typeof document === "undefined") return;
  const parent = topModalLayer() ?? document.body;
  if (layer.parentElement !== parent) parent.appendChild(layer);
}

/**
 * One stable node hosts every Ant Design message. It moves into the topmost
 * modal while one is open so notices stay reachable, and returns to the page
 * before that modal is removed.
 */
export function noticeLayer(): HTMLElement {
  if (!layer) {
    layer = document.createElement("div");
    layer.setAttribute("data-fp-notice-layer", "");
    subscribeModalLayers(attach);
    attach();
  }
  return layer;
}
