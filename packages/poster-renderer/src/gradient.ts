import type {
  LinearGradient,
  PosterDocument,
  RadialGradient,
  RichNode,
  TextBlock,
  TextColor,
} from "@fastposter/poster-schema";

export type TextGradient = LinearGradient | RadialGradient;
export const GRADIENT_RANGE_ATTRIBUTE = "data-gradient-range";

export function isGradientColor(
  color: TextColor | null | undefined,
): color is TextGradient {
  return typeof color === "object" && color !== null;
}

export function richTextHasGradient(node: RichNode): boolean {
  return (
    (node.marks ?? []).some(
      (mark) =>
        mark.type === "textStyle" &&
        isGradientColor(mark.attrs?.color as TextColor | undefined),
    ) || (node.content ?? []).some(richTextHasGradient)
  );
}

export function blockHasGradient(block: TextBlock): boolean {
  return (
    isGradientColor(block.defaultStyle.color) ||
    richTextHasGradient(block.content)
  );
}

/** CSS uses the same angle convention and percentage stops as the document. */
export function gradientCSS(gradient: TextGradient): string {
  const stops = gradient.stops
    .map((stop) => `${stop.color} ${stop.offset}%`)
    .join(", ");
  return gradient.type === "linear"
    ? `linear-gradient(${gradient.angle}deg, ${stops})`
    : `radial-gradient(circle at ${gradient.centerX}% ${gradient.centerY}%, ${stops})`;
}

/**
 * Value identity ignores rangeId: the id only groups coordinates at render
 * time, while mixed-style detection compares what the user actually sees.
 */
export function gradientValueKey(color: TextColor): string {
  if (!isGradientColor(color)) return `solid:${color}`;
  if (color.type === "linear")
    return `linear:${color.angle}:${color.stops
      .map((s) => `${s.color}@${s.offset}`)
      .join(",")}`;
  return `radial:${color.centerX}:${color.centerY}:${color.stops
    .map((s) => `${s.color}@${s.offset}`)
    .join(",")}`;
}

function usedRangeIds(document: PosterDocument, blockId: string): Set<string> {
  const used = new Set<string>();
  const block = document.textBlocks.find((b) => b.id === blockId);
  if (!block) return used;
  const collect = (color: TextColor | undefined) => {
    if (isGradientColor(color)) used.add(color.rangeId);
  };
  collect(block.defaultStyle.color);
  const walk = (n: {
    marks?: { type: string; attrs?: Record<string, unknown> }[];
    content?: unknown[];
  }) => {
    for (const mark of n.marks ?? [])
      if (mark.type === "textStyle")
        collect(mark.attrs?.color as TextColor | undefined);
    for (const child of n.content ?? []) walk(child as typeof n);
  };
  walk(block.content);
  return used;
}

/** Each application gets its own block-local id, even for identical values. */
export function nextGradientRangeId(
  document: PosterDocument,
  blockId: string,
): string {
  const used = usedRangeIds(document, blockId);
  let n = 1;
  while (used.has(`range-${n}`)) n += 1;
  return `range-${n}`;
}
