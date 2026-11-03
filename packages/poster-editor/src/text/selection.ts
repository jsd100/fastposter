import { getSchema, type Editor } from "@tiptap/react";
import { Transform } from "@tiptap/pm/transform";
import type {
  InlineStyle,
  PosterDocument,
  RichNode,
  RichMark,
} from "@fastposter/poster-schema";
import { richTextExtensions } from "./extensions";
export type TextTarget = {
  kind: "range" | "cursor" | "block";
  from: number;
  to: number;
};
export type FontTarget = { blockId: string; target: TextTarget };
export type InlineStylePatch = Partial<InlineStyle>;
const schema = getSchema(richTextExtensions());
export const richTextSchema = schema;
type MarkLike = { type: { name: string }; attrs: Record<string, unknown> };
export function effectiveInlineStyle(
  marks: readonly MarkLike[],
  defaults: InlineStyle,
): InlineStyle {
  const mark = marks.find((m) => m.type.name === "textStyle");
  const attrs = Object.fromEntries(
    Object.entries(mark?.attrs ?? {}).filter(([, v]) => v != null),
  );
  const style = { ...defaults, ...attrs } as InlineStyle;
  if (marks.some((m) => m.type.name === "bold")) style.fontWeight = 700;
  return style;
}
export function canonicalRichText(value: unknown): RichNode {
  const n = value as RichNode;
  const out: RichNode = { type: n.type };
  if (n.type === "doc" || n.type === "paragraph")
    out.content = (n.content ?? []).map(canonicalRichText);
  if (n.type === "text") {
    out.text = n.text ?? "";
    const marks = (n.marks ?? [])
      .map((m) => {
        const mark: RichMark = { type: m.type };
        if (m.type === "textStyle") {
          const attrs = Object.fromEntries(
            Object.entries(m.attrs ?? {}).filter(
              ([, v]) => v !== null && v !== undefined,
            ),
          );
          if (Object.keys(attrs).length) mark.attrs = attrs;
        }
        return mark;
      })
      .filter((m) => m.type !== "textStyle" || !!m.attrs);
    if (marks.length) out.marks = marks;
  }
  return out;
}
export function applyTextStyle(
  content: RichNode,
  target: TextTarget,
  patch: InlineStylePatch,
): RichNode {
  if (target.kind === "cursor") return content;
  const doc = schema.nodeFromJSON(content),
    tr = new Transform(doc);
  const from = target.kind === "block" ? 0 : target.from,
    to = target.kind === "block" ? doc.content.size : target.to;
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const start = Math.max(from, pos),
      end = Math.min(to, pos + node.nodeSize);
    const existing = node.marks.find((m) => m.type.name === "textStyle");
    const attrs = { ...existing?.attrs, ...patch };
    tr.removeMark(start, end, schema.marks.textStyle);
    if (patch.fontWeight !== undefined)
      tr.removeMark(start, end, schema.marks.bold);
    tr.addMark(start, end, schema.marks.textStyle.create(attrs));
  });
  return canonicalRichText(tr.doc.toJSON());
}
export function selectionStyle(
  content: RichNode,
  from: number,
  to: number,
  defaults: InlineStyle,
): { [K in keyof InlineStyle]: InlineStyle[K] | null } {
  const doc = schema.nodeFromJSON(content);
  const values: InlineStyle[] = [];
  doc.nodesBetween(
    Math.max(0, from),
    Math.min(doc.content.size, to),
    (node) => {
      if (node.isText)
        values.push(effectiveInlineStyle(node.marks, defaults));
    },
  );
  if (!values.length) return { ...defaults };
  const result = { ...values[0] } as {
    [K in keyof InlineStyle]: InlineStyle[K] | null;
  };
  for (const key of ["fontId", "fontSize", "color", "fontWeight"] as const)
    if (values.some((v) => v[key] !== values[0][key]))
      (result as Record<string, unknown>)[key] = null;
  return result;
}
export function firstTargetStyle(
  doc: PosterDocument,
  target: FontTarget,
): InlineStyle {
  const block = doc.textBlocks.find((b) => b.id === target.blockId);
  if (!block) throw Error("文字块不存在");
  if (target.target.kind === "block") return { ...block.defaultStyle };
  const node = schema.nodeFromJSON(block.content);
  let found: InlineStyle | undefined;
  let previous: InlineStyle | undefined;
  node.nodesBetween(0, node.content.size, (child, pos) => {
    if (!child.isText) return;
    const style = effectiveInlineStyle(child.marks, block.defaultStyle);
    if (pos <= target.target.from && target.target.from < pos + child.nodeSize)
      found = style;
    if (pos < target.target.from) previous = style;
  });
  return found ?? previous ?? { ...block.defaultStyle };
}
export function captureSelection(editor: Editor) {
  const { from, to } = editor.state.selection;
  return { from, to };
}
export function restoreSelection(
  editor: Editor,
  selection: { from: number; to: number },
) {
  const max = editor.state.doc.content.size;
  const from = Math.min(max, selection.from),
    to = Math.min(max, selection.to);
  if (editor.state.selection.from !== from || editor.state.selection.to !== to)
    editor.commands.setTextSelection({ from, to });
}
