export type BlockBounds = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type LayoutReport = {
  width: number;
  height: number;
  blocks: BlockBounds[];
  overflow?: boolean;
};
export function hasOverflow(report: LayoutReport): boolean {
  return report.blocks.some(
    (b) =>
      b.x < 0 ||
      b.y < 0 ||
      b.x + b.width > report.width + 0.01 ||
      b.y + b.height > report.height + 0.01,
  );
}
export function measureLayout(root: HTMLElement): LayoutReport {
  const scale = root.getBoundingClientRect().width / Number(root.dataset.width);
  if (!Number.isFinite(scale) || scale <= 0)
    throw Error("Canvas is not measurable");
  const report: LayoutReport = {
    width: Number(root.dataset.width),
    height: Number(root.dataset.height),
    blocks: Array.from(
      root.querySelectorAll<HTMLElement>("[data-text-block]"),
    ).map((el) => ({
      id: el.dataset.textBlock!,
      x: Number(el.dataset.x),
      y: Number(el.dataset.y),
      width: el.getBoundingClientRect().width / scale,
      height: el.getBoundingClientRect().height / scale,
    })),
  };
  report.overflow = hasOverflow(report);
  return report;
}
