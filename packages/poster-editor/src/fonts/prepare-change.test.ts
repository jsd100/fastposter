import { it, expect } from "vitest";
import {
  parseDocument,
  type PosterDocument,
  type RichMark,
  type RichNode,
  type TextBlock,
} from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import { prepareFontChange } from "./prepare-change";

const effects = {
  opacity: 1,
  padding: 0,
  backgroundColor: "#00000000",
  strokeWidth: 0,
  strokeColor: "#000000",
  shadowColor: "#00000000",
  shadowBlur: 0,
  shadowX: 0,
  shadowY: 0,
};
const paragraphStyle = { align: "left" as const, lineHeight: 1.4, letterSpacing: 0 };
const source = (
  assetId: string,
  family: string,
  weight: number,
  style: "normal" | "italic" = "normal",
): FontSource => ({
  assetId,
  family,
  version: "1",
  weight,
  style,
  url: `/api/assets/${assetId}/versions/1`,
});
const ref = ({ assetId, family, weight, style }: FontSource) => ({
  assetId,
  version: "1",
  family,
  weight,
  style,
});
const sans400 = source("sans-400", "Noto Sans SC", 400);
const sans700 = source("sans-700", "Noto Sans SC", 700);
const serif400 = source("serif-400", "Noto Serif SC", 400);
const serif900 = source("serif-900", "Noto Serif SC", 900);
const lxgw400 = source("lxgw-400", "LXGW WenKai", 400);
const kuaile400 = source("kuaile-400", "ZCOOL KuaiLe", 400);
const available = [sans400, sans700, serif400, serif900, lxgw400, kuaile400];
const bundled = [sans400, sans700, serif400, serif900, lxgw400];

function block(id: string, content: RichNode): TextBlock {
  return {
    id,
    x: 0,
    y: 0,
    width: 1200,
    zIndex: 0,
    defaultStyle: {
      fontId: "sans-400",
      fontSize: 64,
      color: "#284632",
      fontWeight: 400,
    },
    paragraphStyle,
    effects,
    content,
  };
}
function documentWith(
  textBlocks: TextBlock[],
  fonts: FontSource[] = bundled,
): PosterDocument {
  return parseDocument({
    schemaVersion: 1,
    canvas: { width: 1200, height: 1600 },
    background: { assetId: "bg", version: "1" },
    fonts: fonts.map(ref),
    textBlocks,
  });
}
function styleMark(
  fontId: string,
  fontSize: number,
  color: string,
  fontWeight: number,
): RichMark {
  return { type: "textStyle", attrs: { fontId, fontSize, color, fontWeight } };
}
function plainText(node: RichNode): string {
  return node.text ?? node.content?.map(plainText).join("") ?? "";
}

const mainContent: RichNode = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "你好",
          marks: [styleMark("serif-900", 80, "#112233", 900)],
        },
        {
          type: "text",
          text: "风景",
          marks: [styleMark("sans-400", 64, "#284632", 400)],
        },
        {
          type: "text",
          text: "世界",
          marks: [styleMark("serif-400", 72, "#445566", 400)],
        },
      ],
    },
  ],
};

it("changes only 风景 to the chosen family and keeps outer marks", () => {
  const doc = documentWith([block("block", mainContent)]);
  const change = prepareFontChange(
    doc,
    { blockId: "block", target: { kind: "range", from: 3, to: 5 } },
    kuaile400,
    available,
  );
  expect(change.nextDocument.textBlocks[0].content.content![0].content).toEqual([
    {
      type: "text",
      text: "你好",
      marks: [
        {
          type: "textStyle",
          attrs: {
            fontId: "serif-900",
            fontSize: 80,
            color: "#112233",
            fontWeight: 900,
          },
        },
      ],
    },
    {
      type: "text",
      text: "风景",
      marks: [
        {
          type: "textStyle",
          attrs: {
            fontId: "kuaile-400",
            fontSize: 64,
            color: "#284632",
            fontWeight: 400,
          },
        },
      ],
    },
    {
      type: "text",
      text: "世界",
      marks: [
        {
          type: "textStyle",
          attrs: {
            fontId: "serif-400",
            fontSize: 72,
            color: "#445566",
            fontWeight: 400,
          },
        },
      ],
    },
  ]);
  expect(change.nextDocument.textBlocks[0].defaultStyle).toEqual(
    doc.textBlocks[0].defaultStyle,
  );
  expect(change.nextDocument.fonts.map((f) => f.assetId)).toEqual([
    "sans-400",
    "sans-700",
    "serif-400",
    "serif-900",
    "lxgw-400",
    "kuaile-400",
  ]);
  expect(change.insertionStyle).toEqual({
    fontId: "kuaile-400",
    fontWeight: 400,
  });
  expect(change.adjustments).toEqual([]);
  expect(change.removeItalic).toBe(false);
  expect(() => parseDocument(change.nextDocument)).not.toThrow();
  expect(doc.textBlocks[0].content).toEqual(mainContent);
});

it("switches a whole block and preserves the weights the family provides", () => {
  const content: RichNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "标题",
            marks: [styleMark("serif-900", 64, "#284632", 900)],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "正文",
            marks: [styleMark("sans-400", 64, "#284632", 400)],
          },
        ],
      },
    ],
  };
  const doc = documentWith([block("block", content)], [
    sans400,
    sans700,
    serif400,
    serif900,
  ]);
  const change = prepareFontChange(
    doc,
    { blockId: "block", target: { kind: "block", from: 0, to: 0 } },
    serif400,
    available,
  );
  const output = change.nextDocument.textBlocks[0];
  expect(output.content.content!.map(plainText)).toEqual(["标题", "正文"]);
  expect(
    output.content.content![0].content![0].marks![0].attrs,
  ).toEqual({
    fontId: "serif-900",
    fontSize: 64,
    color: "#284632",
    fontWeight: 900,
  });
  expect(
    output.content.content![1].content![0].marks![0].attrs,
  ).toEqual({
    fontId: "serif-400",
    fontSize: 64,
    color: "#284632",
    fontWeight: 400,
  });
  expect(output.defaultStyle).toEqual({
    fontId: "serif-400",
    fontSize: 64,
    color: "#284632",
    fontWeight: 400,
  });
  expect(change.insertionStyle).toEqual({
    fontId: "serif-400",
    fontWeight: 400,
  });
  expect(change.adjustments).toEqual([]);
  expect(change.nextDocument.fonts.map((f) => f.assetId)).toEqual([
    "sans-400",
    "sans-700",
    "serif-400",
    "serif-900",
  ]);
});

it("an empty cursor only prepares the insertion style and references", () => {
  const doc = documentWith([block("block", mainContent)]);
  const change = prepareFontChange(
    doc,
    { blockId: "block", target: { kind: "cursor", from: 7, to: 7 } },
    kuaile400,
    available,
  );
  expect(change.nextDocument.textBlocks[0].content).toEqual(
    doc.textBlocks[0].content,
  );
  expect(change.nextDocument.textBlocks[0].defaultStyle).toEqual(
    doc.textBlocks[0].defaultStyle,
  );
  expect(change.insertionStyle).toEqual({
    fontId: "kuaile-400",
    fontWeight: 400,
  });
  expect(change.nextDocument.fonts.map((f) => f.assetId)).toEqual([
    "sans-400",
    "sans-700",
    "serif-400",
    "serif-900",
    "lxgw-400",
    "kuaile-400",
  ]);
  expect(change.removeItalic).toBe(false);
  expect(change.adjustments).toEqual([]);
  expect(() => parseDocument(change.nextDocument)).not.toThrow();
  expect(plainText(change.probeDocument.textBlocks[0].content)).toBe("");
});

it("drops unsupported bold and italic only inside the target range", () => {
  const content: RichNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "粗斜",
            marks: [
              styleMark("sans-700", 64, "#000000", 700),
              { type: "bold" },
              { type: "italic" },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "外侧",
            marks: [styleMark("sans-700", 64, "#000000", 700), { type: "italic" }],
          },
        ],
      },
    ],
  };
  const doc = documentWith([block("block", content)], [sans400, sans700]);
  const change = prepareFontChange(
    doc,
    { blockId: "block", target: { kind: "range", from: 1, to: 3 } },
    kuaile400,
    available,
  );
  const paragraphs = change.nextDocument.textBlocks[0].content.content!;
  expect(paragraphs[0].content).toEqual([
    {
      type: "text",
      text: "粗斜",
      marks: [
        {
          type: "textStyle",
          attrs: {
            fontId: "kuaile-400",
            fontSize: 64,
            color: "#000000",
            fontWeight: 400,
          },
        },
      ],
    },
  ]);
  expect(paragraphs[1].content).toEqual([
    {
      type: "text",
      text: "外侧",
      marks: [
        styleMark("sans-700", 64, "#000000", 700),
        { type: "italic" },
      ],
    },
  ]);
  expect(change.removeItalic).toBe(true);
  expect(change.adjustments).toEqual([
    "新字体没有 700 字重，已使用 400",
    "新字体没有斜体，已取消斜体",
  ]);
  expect(() => parseDocument(change.nextDocument)).not.toThrow();
});

it("builds a probe document with only the target text and needed references", () => {
  const otherContent: RichNode = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "另一块",
            marks: [styleMark("lxgw-400", 64, "#284632", 400)],
          },
        ],
      },
    ],
  };
  const other = { ...block("other", otherContent), y: 200, zIndex: 1 };
  const doc = documentWith([block("block", mainContent), other]);
  const change = prepareFontChange(
    doc,
    { blockId: "block", target: { kind: "range", from: 3, to: 5 } },
    kuaile400,
    available,
  );
  expect(change.probeDocument.textBlocks).toHaveLength(1);
  expect(change.probeDocument.textBlocks[0].id).toBe("block");
  expect(plainText(change.probeDocument.textBlocks[0].content)).toBe("风景");
  expect(change.probeDocument.fonts.map((f) => f.assetId)).toEqual([
    "kuaile-400",
  ]);
  expect(() => parseDocument(change.probeDocument)).not.toThrow();
});
