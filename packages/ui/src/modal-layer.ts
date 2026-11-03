let layers: HTMLElement[] = [];
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

export function subscribeModalLayers(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function topModalLayer() {
  return layers[layers.length - 1] ?? null;
}
