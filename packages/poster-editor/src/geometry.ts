import type { PosterDocument, TextBlock } from "@fastposter/poster-schema";
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type ViewTransform = Point & { scale: number };
export type Rect = Point & Size;
export type BackgroundAsset = Size & { id: string; version: string };
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function screenToDocument(point: Point, view: ViewTransform): Point {
  return {
    x: (point.x - view.x) / view.scale,
    y: (point.y - view.y) / view.scale,
  };
}
export function resizeTextWidth(
  block: TextBlock,
  edge: "left" | "right",
  deltaPx: number,
  canvas: Size,
): TextBlock {
  const min = Math.min(
    canvas.width,
    Math.max(1, block.effects.padding * 2 + 1),
  );
  if (edge === "right")
    return {
      ...block,
      width: clamp(block.width + deltaPx, min, canvas.width - block.x),
    };
  const right = block.x + block.width,
    x = clamp(block.x + deltaPx, 0, right - min);
  return { ...block, x, width: right - x };
}
export function moveTextBlock(
  block: TextBlock,
  point: Point,
  canvas: Size,
  height = 0,
): TextBlock {
  return {
    ...block,
    x: clamp(point.x, 0, canvas.width - block.width),
    y: clamp(point.y, 0, Math.max(0, canvas.height - Math.max(1, height))),
  };
}
export function replaceBackground(
  doc: PosterDocument,
  asset: BackgroundAsset,
): PosterDocument {
  const sx = asset.width / doc.canvas.width,
    sy = asset.height / doc.canvas.height;
  return {
    ...doc,
    canvas: { width: asset.width, height: asset.height },
    background: { assetId: asset.id, version: asset.version },
    textBlocks: doc.textBlocks.map((b) => {
      const x = clamp(b.x * sx, 0, asset.width - 1),
        y = clamp(b.y * sy, 0, asset.height - 0.001);
      const width = Math.min(asset.width - x, Math.max(1, b.width * sx));
      return {
        ...b,
        x,
        y,
        width,
        effects: {
          ...b.effects,
          padding: Math.min(b.effects.padding, Math.max(0, (width - 1) / 2)),
        },
      };
    }),
  };
}
/**
 * Pure view math for the phone inspector. `bounds` is a selection in document
 * pixels while `viewport` is the visible band of the stage in stage-local
 * pixels, so the selection is projected through the view before comparing.
 * Translation is preferred; the zoom only shrinks when the selection cannot
 * fit at the current scale. No document or history state is touched.
 */
export function fitSelectionIntoViewport(
  view: ViewTransform,
  bounds: Rect,
  viewport: Rect,
): ViewTransform {
  const pad = 8;
  const left = viewport.x + pad,
    top = viewport.y + pad,
    right = viewport.x + viewport.width - pad,
    bottom = viewport.y + viewport.height - pad;
  const availWidth = Math.max(1, right - left),
    availHeight = Math.max(1, bottom - top);
  const scale = clamp(
    Math.min(
      view.scale,
      availWidth / Math.max(1, bounds.width),
      availHeight / Math.max(1, bounds.height),
    ),
    0.02,
    3,
  );
  const x = view.x + bounds.x * scale,
    y = view.y + bounds.y * scale,
    width = bounds.width * scale,
    height = bounds.height * scale;
  // A selection larger than the band keeps its leading edge (the line being
  // edited) on screen instead of being aligned to the unreachable bottom.
  const shift = (start: number, size: number, min: number, max: number) =>
    size > max - min
      ? min - start
      : start < min
        ? min - start
        : start + size > max
          ? max - (start + size)
          : 0;
  return {
    scale,
    x: view.x + shift(x, width, left, right),
    y: view.y + shift(y, height, top, bottom),
  };
}
export function pinchView(
  view: ViewTransform,
  startA: Point,
  startB: Point,
  currentA: Point,
  currentB: Point,
): ViewTransform {
  const startDistance = Math.hypot(startB.x - startA.x, startB.y - startA.y);
  if (startDistance < 1) return view;
  const scale = clamp(
    (view.scale *
      Math.hypot(currentB.x - currentA.x, currentB.y - currentA.y)) /
      startDistance,
    0.02,
    3,
  );
  const start = { x: (startA.x + startB.x) / 2, y: (startA.y + startB.y) / 2 },
    current = {
      x: (currentA.x + currentB.x) / 2,
      y: (currentA.y + currentB.y) / 2,
    };
  return {
    scale,
    x: current.x - ((start.x - view.x) * scale) / view.scale,
    y: current.y - ((start.y - view.y) * scale) / view.scale,
  };
}
