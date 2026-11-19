import { Transform } from "@tiptap/pm/transform";
import type {
  FontRef,
  InlineStyle,
  PosterDocument,
  RichMark,
  RichNode,
  TextBlock,
} from "@fastposter/poster-schema";
import { fontWeightBounds, type FontSource } from "@fastposter/poster-renderer";
import { documentFontSources } from "./catalog";
import {
  canonicalRichText,
  effectiveInlineStyle,
  firstTargetStyle,
  richTextSchema as schema,
  type FontTarget,
  type InlineStylePatch,
  type TextTarget,
} from "../text/selection";

export type FontChoiceIntent = "family" | "weight";

export type FontChangeOptions = {
  cursorStyle?: InlineStyle;
  cursorItalic?: boolean;
  intent?: FontChoiceIntent;
  /** Continuous weight requested by the slider, independent of face.weight. */
  requestedWeight?: number;
};

export type PreparedFontChange = {
  nextDocument: PosterDocument;
  probeDocument: PosterDocument;
  target: FontTarget;
  insertionStyle: InlineStylePatch;
  removeItalic: boolean;
  removeBold: boolean;
  adjustments: string[];
};

function faceAt(
  faces: FontSource[],
  weight: number,
  style: FontSource["style"] = "normal",
) {
  const matching = faces.filter((face) => {
    if (face.style !== style) return false;
    const bounds = fontWeightBounds(face);
    return bounds
      ? weight >= bounds.minWeight && weight <= bounds.maxWeight
      : face.weight === weight;
  });
  return matching.find((face) => face.weight === weight) ?? matching[0];
}

export function fontTargetIds(
  block: TextBlock,
  target: TextTarget,
  cursorFontId?: string,
) {
  if (target.kind === "cursor")
    return [cursorFontId ?? block.defaultStyle.fontId];
  const ids = new Set<string>();
  const node = schema.nodeFromJSON(block.content);
  const whole = target.kind === "block";
  if (whole) ids.add(block.defaultStyle.fontId);
  node.nodesBetween(
    whole ? 0 : target.from,
    whole ? node.content.size : target.to,
    (child) => {
      if (child.isText)
        ids.add(effectiveInlineStyle(child.marks, block.defaultStyle).fontId);
    },
  );
  return [...ids];
}

function toRef(source: FontSource): FontRef {
  const { assetId, version, family, weight, style } = source;
  return { assetId, version, family, weight, style };
}

function collectFontIds(node: RichNode, ids: Set<string>) {
  for (const child of node.content ?? []) collectFontIds(child, ids);
  for (const mark of node.marks ?? [])
    if (mark.type === "textStyle" && typeof mark.attrs?.fontId === "string")
      ids.add(mark.attrs.fontId);
}

type FaceNeed = {
  family: string;
  weight: number;
  style: "normal" | "italic";
};

function collectFaceNeeds(
  node: RichNode,
  base: InlineStyle,
  families: Map<string, string>,
  needs: Map<string, FaceNeed>,
) {
  if (node.type === "text") {
    const attrs =
      node.marks?.find((mark) => mark.type === "textStyle")?.attrs ?? {};
    const fontId =
      typeof attrs.fontId === "string" ? attrs.fontId : base.fontId;
    const family = families.get(fontId);
    if (family) {
      const weight =
        (node.marks?.some((mark) => mark.type === "bold") ?? false)
          ? 700
          : typeof attrs.fontWeight === "number"
            ? attrs.fontWeight
            : base.fontWeight;
      const style = (
        (node.marks?.some((mark) => mark.type === "italic") ?? false)
          ? "italic"
          : "normal"
      ) as FaceNeed["style"];
      needs.set(`${family}\u0000${weight}\u0000${style}`, {
        family,
        weight,
        style,
      });
    }
  }
  for (const child of node.content ?? [])
    collectFaceNeeds(child, base, families, needs);
}

function sliceContent(content: RichNode, target: TextTarget): RichNode {
  const node = schema.nodeFromJSON(content);
  const children: RichNode[] = [];
  node.nodesBetween(target.from, target.to, (child, pos) => {
    if (!child.isText) return;
    const from = Math.max(target.from, pos);
    const to = Math.min(target.to, pos + child.nodeSize);
    if (from >= to) return;
    const text = child.text?.slice(from - pos, to - pos) ?? "";
    if (!text) return;
    const marks = child.marks.map((mark) => mark.toJSON() as RichMark);
    children.push(
      marks.length ? { type: "text", text, marks } : { type: "text", text },
    );
  });
  return canonicalRichText({
    type: "doc",
    content: [{ type: "paragraph", content: children }],
  });
}

export function prepareFontChange(
  doc: PosterDocument,
  target: FontTarget,
  chosen: FontSource,
  fonts: FontSource[],
  options: FontChangeOptions = {},
): PreparedFontChange {
  const block = doc.textBlocks.find((b) => b.id === target.blockId);
  if (!block) throw Error("文字块不存在");
  const intent = options.intent ?? "family";
  const start =
    target.target.kind === "cursor" && options.cursorStyle
      ? options.cursorStyle
      : firstTargetStyle(doc, target);
  const sources = documentFontSources([...fonts, chosen], doc.fonts);
  const families = new Map(sources.map((font) => [font.assetId, font.family]));
  const adjustments = new Set<string>();
  const requestedWeight = options.requestedWeight ?? chosen.weight;
  const used = new Map<string, FontSource>();
  let removedItalic = false;
  function resolveStyle(current: InlineStyle, italic = false) {
    const family =
      intent === "family"
        ? chosen.family
        : (families.get(current.fontId) ?? chosen.family);
    const faces = sources.filter((face) => face.family === family);
    const requested =
      intent === "weight" ? requestedWeight : current.fontWeight;
    const requestedFace = faceAt(faces, requested);
    const fallback = faceAt(faces, 400);
    const face =
      requestedFace ??
      fallback ??
      faces.find((item) => item.style === "normal") ??
      chosen;
    const weight = requestedFace ? requested : fallback ? 400 : face.weight;
    if (weight !== requested)
      adjustments.add(`新字体没有 ${requested} 字重，已使用 ${weight}`);
    const italicFace = italic ? faceAt(faces, weight, "italic") : undefined;
    if (italic && !italicFace) {
      removedItalic = true;
      adjustments.add("新字体没有斜体，已取消斜体");
    }
    used.set(face.assetId, face);
    if (italicFace) used.set(italicFace.assetId, italicFace);
    return { fontId: face.assetId, fontWeight: weight, italicFace };
  }

  const node = schema.nodeFromJSON(block.content);
  const from = target.target.kind === "block" ? 0 : target.target.from;
  const to =
    target.target.kind === "block" ? node.content.size : target.target.to;
  let content: RichNode;
  if (target.target.kind === "cursor") {
    content = canonicalRichText(block.content);
  } else {
    const tr = new Transform(node);
    node.nodesBetween(from, to, (child, pos) => {
      if (!child.isText) return;
      const begin = Math.max(from, pos);
      const end = Math.min(to, pos + child.nodeSize);
      if (begin >= end) return;
      const existing = child.marks.find(
        (mark) => mark.type.name === "textStyle",
      );
      const attrs = Object.fromEntries(
        Object.entries(existing?.attrs ?? {}).filter(
          ([, value]) => value != null,
        ),
      ) as Partial<InlineStyle>;
      const current = effectiveInlineStyle(child.marks, block.defaultStyle);
      const italic = child.marks.some((mark) => mark.type.name === "italic");
      const { fontId, fontWeight, italicFace } = resolveStyle(current, italic);
      tr.removeMark(begin, end, schema.marks.textStyle);
      if (intent === "weight" || fontWeight !== 700)
        tr.removeMark(begin, end, schema.marks.bold);
      if (italic && !italicFace) tr.removeMark(begin, end, schema.marks.italic);
      tr.addMark(
        begin,
        end,
        schema.marks.textStyle.create({
          ...attrs,
          fontId,
          fontWeight,
        }),
      );
    });
    content = canonicalRichText(tr.doc.toJSON());
  }
  const cursor = target.target.kind === "cursor";
  const { italicFace, ...insertionStyle } = resolveStyle(
    start,
    cursor && options.cursorItalic,
  );
  const removeBold =
    cursor &&
    start.fontWeight === 700 &&
    (intent === "weight" || insertionStyle.fontWeight !== 700);
  const nextBlock: TextBlock = {
    ...block,
    defaultStyle:
      target.target.kind === "block"
        ? { ...block.defaultStyle, ...insertionStyle }
        : block.defaultStyle,
    content,
  };
  const probeContent =
    target.target.kind === "cursor"
      ? ({
          type: "doc",
          content: [{ type: "paragraph", content: [] }],
        } satisfies RichNode)
      : target.target.kind === "block"
        ? content
        : sliceContent(content, target.target);
  const probeBlock: TextBlock = {
    ...nextBlock,
    x: 0,
    y: 0,
    zIndex: 0,
    defaultStyle: { ...nextBlock.defaultStyle, ...insertionStyle },
    content: probeContent,
  };
  const probeIds = new Set<string>([probeBlock.defaultStyle.fontId]);
  collectFontIds(probeContent, probeIds);
  if (italicFace) probeIds.add(italicFace.assetId);

  // Keep the immutable face selected for each implicit bold/italic run, in
  // addition to the font IDs carried by textStyle and block defaults.
  const refs = new Map(doc.fonts.map((font) => [font.assetId, font]));
  for (const [id, face] of used) if (!refs.has(id)) refs.set(id, toRef(face));

  const refsInOrder = [...refs.values()];
  const availableById = new Map(sources.map((font) => [font.assetId, font]));
  const referencedSources = refsInOrder
    .map((ref) => availableById.get(ref.assetId))
    .filter((source): source is FontSource => !!source);

  function retainImplicit(blocks: TextBlock[], ids: Set<string>) {
    const needs = new Map<string, FaceNeed>();
    for (const item of blocks)
      collectFaceNeeds(item.content, item.defaultStyle, families, needs);
    for (const { family, weight, style } of needs.values()) {
      const faces = referencedSources.filter((font) => font.family === family);
      const face = faceAt(faces, weight, style);
      if (face) ids.add(face.assetId);
      else {
        // A detached or still-loading reference may provide the needed axis.
        for (const candidate of faces)
          if (candidate.style === style) ids.add(candidate.assetId);
      }
    }
  }
  retainImplicit([probeBlock], probeIds);

  const nextBlocks = doc.textBlocks.map((item) =>
    item.id === target.blockId ? nextBlock : item,
  );
  const neededIds = new Set<string>(probeIds);
  for (const item of nextBlocks) {
    neededIds.add(item.defaultStyle.fontId);
    collectFontIds(item.content, neededIds);
  }
  retainImplicit(nextBlocks, neededIds);
  const nextFonts =
    options.requestedWeight !== undefined
      ? refsInOrder.filter((ref) => neededIds.has(ref.assetId))
      : refsInOrder;
  if (nextFonts.length > 100) throw Error("字体引用已达上限");
  const nextDocument: PosterDocument = {
    ...doc,
    fonts: nextFonts,
    textBlocks: nextBlocks,
  };
  const probeFonts = refsInOrder.filter((ref) => probeIds.has(ref.assetId));
  return {
    nextDocument,
    probeDocument: { ...doc, fonts: probeFonts, textBlocks: [probeBlock] },
    target,
    insertionStyle,
    removeItalic: removedItalic,
    removeBold,
    adjustments: [...adjustments],
  };
}
