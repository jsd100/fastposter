import { z } from "zod";
import type {
  InlineStyle,
  LinearGradient,
  PosterDocument,
  RadialGradient,
  RichNode,
  TextColor,
} from "./types";
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const color = z.string().regex(/^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/);
const offset = z.number().min(0).max(100);
const stop = z.object({ color, offset }).strict();
const stops = z.array(stop).min(2).max(8);
const linear = z
  .object({
    type: z.literal("linear"),
    rangeId: id,
    angle: z.number().finite(),
    stops,
  })
  .strict();
const radial = z
  .object({
    type: z.literal("radial"),
    rangeId: id,
    centerX: offset,
    centerY: offset,
    stops,
  })
  .strict();
const textColor = z.union([color, linear, radial]);
const inline = z
  .object({
    fontId: id,
    fontSize: z.number().positive().max(4096),
    color: textColor,
    fontWeight: z.number().int().min(100).max(900),
  })
  .strict();
const shape = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    canvas: z
      .object({
        width: z.number().int().positive().max(8192),
        height: z.number().int().positive().max(8192),
      })
      .strict(),
    background: z
      .object({ assetId: id, version: z.string().regex(/^\d+$/) })
      .strict(),
    fonts: z
      .array(
        z
          .object({
            assetId: id,
            version: z.string().regex(/^\d+$/),
            family: z.string().min(1).max(128),
            weight: z.number().int().min(100).max(900),
            style: z.enum(["normal", "italic"]),
          })
          .strict(),
      )
      .max(100),
    textBlocks: z
      .array(
        z
          .object({
            id,
            x: z.number().min(0),
            y: z.number().min(0),
            width: z.number().positive(),
            zIndex: z.number().int().min(0).max(100000),
            defaultStyle: inline,
            paragraphStyle: z
              .object({
                align: z.enum(["left", "center", "right"]),
                lineHeight: z.number().min(0.5).max(5),
                letterSpacing: z.number().min(-100).max(1000),
              })
              .strict(),
            effects: z
              .object({
                opacity: z.number().min(0).max(1),
                padding: z.number().min(0).max(4096),
                backgroundColor: color,
                strokeWidth: z.number().min(0).max(100),
                strokeColor: color,
                shadowColor: color,
                shadowBlur: z.number().min(0).max(500),
                shadowX: z.number().min(-8192).max(8192),
                shadowY: z.number().min(-8192).max(8192),
              })
              .strict(),
            content: z.unknown(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
function assertRich(
  node: unknown,
  expected: string,
  fonts: Set<string>,
): number {
  if (!node || typeof node !== "object") throw Error("Invalid rich text node");
  const n = node as RichNode;
  if (n.type !== expected) throw Error("Unsupported rich text node");
  if (
    Object.keys(n).some(
      (k) => !["type", "content", "text", "marks"].includes(k),
    )
  )
    throw Error("Unsupported node attribute");
  if (expected === "doc" || expected === "paragraph") {
    if (
      n.text !== undefined ||
      n.marks !== undefined ||
      !Array.isArray(n.content)
    )
      throw Error("Invalid container");
    return n.content.reduce(
      (sum, c) =>
        sum +
        assertRich(
          c,
          expected === "doc"
            ? "paragraph"
            : c.type === "hardBreak"
              ? "hardBreak"
              : "text",
          fonts,
        ),
      0,
    );
  }
  if (n.content !== undefined) throw Error("Leaf node cannot have children");
  if (expected === "hardBreak") {
    if (n.text !== undefined || n.marks !== undefined)
      throw Error("Invalid hard break");
    return 1;
  }
  if (typeof n.text !== "string" || n.text.length === 0)
    throw Error("Text must be non-empty");
  for (const m of n.marks ?? []) {
    if (
      !["textStyle", "bold", "italic", "underline", "strike"].includes(m.type)
    )
      throw Error("Unsupported text mark");
    if (Object.keys(m).some((k) => !["type", "attrs"].includes(k)))
      throw Error("Unsupported mark property");
    if (m.type === "textStyle") {
      const a = inline.partial().parse(m.attrs ?? {});
      if (a.fontId && !fonts.has(a.fontId))
        throw Error("Missing font reference");
    } else if (m.attrs !== undefined) throw Error("Unexpected mark attributes");
  }
  return Array.from(n.text).length;
}
type Gradient = LinearGradient | RadialGradient;
function isGradient(color: TextColor): color is Gradient {
  return typeof color === "object" && color !== null;
}
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
function gradientConfigKey(gradient: Gradient): string {
  const stops = gradient.stops.map((s) => `${s.color}@${s.offset}`).join(",");
  return gradient.type === "linear"
    ? `linear|${normalizeAngle(gradient.angle)}|${stops}`
    : `radial|${gradient.centerX},${gradient.centerY}|${stops}`;
}
function visitMarkStyles(
  node: RichNode,
  visit: (attrs: Partial<InlineStyle>) => void,
): void {
  for (const mark of node.marks ?? []) {
    if (mark.type === "textStyle" && mark.attrs) visit(mark.attrs);
  }
  for (const child of node.content ?? []) visitMarkStyles(child, visit);
}
export function parseDocument(input: unknown): PosterDocument {
  if (
    new TextEncoder().encode(JSON.stringify(input)).byteLength >
    2 * 1024 * 1024
  )
    throw Error("Document exceeds 2 MiB");
  const d = shape.parse(input) as PosterDocument;
  if (d.canvas.width * d.canvas.height > 40_000_000)
    throw Error("Canvas exceeds 40 megapixels");
  const fonts = new Set(d.fonts.map((f) => f.assetId));
  if (fonts.size !== d.fonts.length) throw Error("Duplicate font");
  const blocks = new Set<string>();
  for (const b of d.textBlocks) {
    if (blocks.has(b.id)) throw Error("Duplicate block");
    blocks.add(b.id);
    if (
      b.x + b.width > d.canvas.width ||
      b.y >= d.canvas.height ||
      b.effects.padding * 2 >= b.width
    )
      throw Error("Block outside canvas or no content width");
    if (!fonts.has(b.defaultStyle.fontId))
      throw Error("Missing font reference");
    if (assertRich(b.content, "doc", fonts) > 10000)
      throw Error("Block exceeds 10000 characters");

    // v1 documents must stay solid, and one block-local rangeId always shares a
    // single normalized config. Whether a deployment accepts gradient writes is
    // decided at the server write boundary, not by this schema.
    const ranges = new Map<string, string>();
    const checkColor = (color: TextColor): TextColor => {
      if (!isGradient(color)) return color;
      if (d.schemaVersion === 1) throw Error("Gradient requires schema v2");
      const normalized: Gradient =
        color.type === "linear"
          ? { ...color, angle: normalizeAngle(color.angle) }
          : color;
      const key = gradientConfigKey(normalized);
      const previous = ranges.get(normalized.rangeId);
      if (previous !== undefined && previous !== key)
        throw Error("Conflicting gradient range configuration");
      ranges.set(normalized.rangeId, key);
      return normalized;
    };
    b.defaultStyle.color = checkColor(b.defaultStyle.color);
    visitMarkStyles(b.content, (attrs) => {
      if (attrs.color !== undefined) attrs.color = checkColor(attrs.color);
    });
  }
  return d;
}
export function migrateDocument(input: unknown): PosterDocument {
  return parseDocument(input);
}
