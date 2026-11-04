import { Transform } from "@tiptap/pm/transform";
import type {
  FontRef,
  InlineStyle,
  PosterDocument,
  RichMark,
  RichNode,
  TextBlock,
} from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
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
  intent?: FontChoiceIntent;
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

const normalFaces = (faces: FontSource[]) =>
  faces.filter((face) => face.style === "normal");

function faceAt(faces: FontSource[], weight: number): FontSource | undefined {
  const normal = normalFaces(faces);
  return (
    normal.find((face) => face.weight === weight) ??
    normal.find((face) => face.weight === 400) ??
    normal[0] ??
    faces[0]
  );
}

function familyFaces(fonts: FontSource[], chosen: FontSource): FontSource[] {
  const faces = fonts.filter((face) => face.family === chosen.family);
  if (!faces.some((face) => face.assetId === chosen.assetId))
    faces.push(chosen);
  return faces;
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
        node.marks?.some((mark) => mark.type === "bold") ?? false
          ? 700
          : typeof attrs.fontWeight === "number"
            ? attrs.fontWeight
            : base.fontWeight;
      const style = (
        node.marks?.some((mark) => mark.type === "italic") ?? false
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
  const faces = familyFaces(fonts, chosen);
  const weights = [...new Set(normalFaces(faces).map((face) => face.weight))];
  const fallback = weights.includes(400)
    ? 400
    : weights.includes(chosen.weight)
      ? chosen.weight
      : (weights[0] ?? chosen.weight);
  const families = new Map<string, string>();
  for (const font of doc.fonts) families.set(font.assetId, font.family);
  for (const font of fonts)
    if (!families.has(font.assetId)) families.set(font.assetId, font.family);
  const resolveWeight = (current: number) => {
    if (intent === "weight" && weights.includes(chosen.weight))
      return chosen.weight;
    return weights.includes(current) ? current : fallback;
  };
  const italicFace = faces.find((face) => face.style === "italic");
  const used = new Set<string>();
  const missing = new Set<number>();
  const node = schema.nodeFromJSON(block.content);
  const from = target.target.kind === "block" ? 0 : target.target.from;
  const to =
    target.target.kind === "block" ? node.content.size : target.target.to;
  let targetHasItalic = false;
  node.nodesBetween(from, to, (child) => {
    if (child.isText && child.marks.some((mark) => mark.type.name === "italic"))
      targetHasItalic = true;
  });
  const targetItalic = target.target.kind !== "cursor" && targetHasItalic;
  const removeItalic = targetItalic && !italicFace;
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
        Object.entries(existing?.attrs ?? {}).filter(([, value]) => value != null),
      ) as Partial<InlineStyle>;
      const current = effectiveInlineStyle(child.marks, block.defaultStyle);
      const weight = resolveWeight(current.fontWeight);
      const face = faceAt(faces, weight) ?? chosen;
      if (intent === "family" && !weights.includes(current.fontWeight))
        missing.add(current.fontWeight);
      tr.removeMark(begin, end, schema.marks.textStyle);
      if (
        weight !== 700 &&
        child.marks.some((mark) => mark.type.name === "bold")
      )
        tr.removeMark(begin, end, schema.marks.bold);
      if (removeItalic) tr.removeMark(begin, end, schema.marks.italic);
      tr.addMark(
        begin,
        end,
        schema.marks.textStyle.create({
          ...attrs,
          fontId: face.assetId,
          fontWeight: weight,
        }),
      );
      used.add(face.assetId);
    });
    content = canonicalRichText(tr.doc.toJSON());
  }
  const defaultWeight =
    target.target.kind === "block"
      ? resolveWeight(block.defaultStyle.fontWeight)
      : block.defaultStyle.fontWeight;
  const defaultFace = faceAt(faces, defaultWeight) ?? chosen;
  if (target.target.kind === "block") {
    if (intent === "family" && !weights.includes(block.defaultStyle.fontWeight))
      missing.add(block.defaultStyle.fontWeight);
    used.add(defaultFace.assetId);
  }
  const insertionWeight = resolveWeight(start.fontWeight);
  const insertionFace = faceAt(faces, insertionWeight) ?? chosen;
  const insertionStyle: InlineStylePatch = {
    fontId: insertionFace.assetId,
    fontWeight: insertionWeight,
  };
  if (
    target.target.kind === "cursor" &&
    intent === "family" &&
    !weights.includes(start.fontWeight)
  )
    missing.add(start.fontWeight);
  used.add(insertionFace.assetId);
  if (targetItalic && italicFace) used.add(italicFace.assetId);
  const adjustments: string[] = [];
  for (const weight of missing)
    adjustments.push(`新字体没有 ${weight} 字重，已使用 ${fallback}`);
  if (removeItalic) adjustments.push("新字体没有斜体，已取消斜体");
  const removeBold =
    target.target.kind === "cursor" &&
    start.fontWeight === 700 &&
    insertionWeight !== 700;
  const nextBlock: TextBlock =
    target.target.kind === "block"
      ? {
          ...block,
          defaultStyle: {
            ...block.defaultStyle,
            fontId: defaultFace.assetId,
            fontWeight: defaultWeight,
          },
          content,
        }
      : { ...block, content };
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
  const needs = new Map<string, FaceNeed>();
  collectFaceNeeds(probeContent, probeBlock.defaultStyle, families, needs);
  for (const need of needs.values()) {
    const face = fonts.find(
      (item) =>
        item.family === need.family &&
        item.weight === need.weight &&
        item.style === need.style,
    );
    if (face) {
      used.add(face.assetId);
      probeIds.add(face.assetId);
    }
  }
  const refs = [...doc.fonts];
  const known = new Set(refs.map((ref) => ref.assetId));
  for (const id of used) {
    if (known.has(id)) continue;
    const face = faces.find((item) => item.assetId === id);
    if (!face) continue;
    refs.push(toRef(face));
    known.add(id);
  }
  if (refs.length > 100) throw Error("字体引用已达上限");
  const nextDocument: PosterDocument = {
    ...doc,
    fonts: refs,
    textBlocks: doc.textBlocks.map((item) =>
      item.id === target.blockId ? nextBlock : item,
    ),
  };
  const probeFonts: FontRef[] = [];
  for (const id of probeIds) {
    const ref = refs.find((item) => item.assetId === id);
    const source = ref
      ? undefined
      : fonts.find((item) => item.assetId === id);
    if (!ref && !source) throw Error("缺少字体引用");
    probeFonts.push(ref ?? toRef(source as FontSource));
  }
  return {
    nextDocument,
    probeDocument: { ...doc, fonts: probeFonts, textBlocks: [probeBlock] },
    target,
    insertionStyle,
    removeItalic,
    removeBold,
    adjustments,
  };
}
