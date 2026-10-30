import type { PosterDocument, TextBlock } from "@fastposter/poster-schema";
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type ViewTransform = Point & { scale: number };
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
