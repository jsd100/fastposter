import { it, expect } from "vitest";
import {
  parseDocument,
  type PosterDocument,
  type RichNode,
} from "@fastposter/poster-schema";
import {
  applyTextStyle,
  selectionStyle,
  canonicalRichText,
  firstTargetStyle,
} from "./selection";
const content: RichNode = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "你好风景世界" }] },
  ],
};
const defaults = {
  fontId: "font",
  fontSize: 64,
  color: "#000000",
  fontWeight: 400,
};
it("changes only 风景 in a range and preserves surrounding text", () => {
  const next = applyTextStyle(
    content,
    { kind: "range", from: 3, to: 5 },
    { color: "#ff0000", fontSize: 80 },
  );
  expect(next.content![0].content!.map((n) => n.text).join("")).toBe(
    "你好风景世界",
  );
  expect(next.content![0].content).toEqual([
    { type: "text", text: "你好" },
    {
      type: "text",
      marks: [{ type: "textStyle", attrs: { color: "#ff0000", fontSize: 80 } }],
      text: "风景",
    },
    { type: "text", text: "世界" },
  ]);
  expect(selectionStyle(next, 1, 7, defaults).color).toBe(null);
});
it("cursor styling leaves existing text unchanged", () => {
  expect(
    applyTextStyle(
      content,
      { kind: "cursor", from: 3, to: 3 },
      { fontSize: 80 },
    ),
  ).toEqual(content);
});
const styleDoc: PosterDocument = parseDocument({
  schemaVersion: 1,
  canvas: { width: 1200, height: 1600 },
  background: { assetId: "bg", version: "1" },
  fonts: [
    {
      assetId: "sans-400",
      version: "1",
      family: "Noto Sans SC",
      weight: 400,
      style: "normal",
    },
    {
      assetId: "serif-400",
      version: "1",
      family: "Noto Serif SC",
      weight: 400,
      style: "normal",
    },
  ],
  textBlocks: [
    {
      id: "block",
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
      paragraphStyle: { align: "left", lineHeight: 1.4, letterSpacing: 0 },
      effects: {
        opacity: 1,
        padding: 0,
        backgroundColor: "#00000000",
        strokeWidth: 0,
        strokeColor: "#000000",
        shadowColor: "#00000000",
        shadowBlur: 0,
        shadowX: 0,
        shadowY: 0,
      },
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "你好风景",
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
              {
                type: "text",
                text: "世界",
                marks: [
                  {
                    type: "textStyle",
                    attrs: {
                      fontId: "sans-400",
                      fontSize: 64,
                      color: "#284632",
                      fontWeight: 900,
                    },
                  },
                  { type: "bold" },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
});

it("reads the effective style at the target start", () => {
  expect(
    firstTargetStyle(styleDoc, {
      blockId: "block",
      target: { kind: "block", from: 0, to: 0 },
    }),
  ).toEqual({
    fontId: "sans-400",
    fontSize: 64,
    color: "#284632",
    fontWeight: 400,
  });
  expect(
    firstTargetStyle(styleDoc, {
      blockId: "block",
      target: { kind: "range", from: 3, to: 5 },
    }),
  ).toEqual({
    fontId: "serif-400",
    fontSize: 72,
    color: "#445566",
    fontWeight: 400,
  });
  expect(
    firstTargetStyle(styleDoc, {
      blockId: "block",
      target: { kind: "cursor", from: 7, to: 7 },
    }),
  ).toEqual({
    fontId: "sans-400",
    fontSize: 64,
    color: "#284632",
    fontWeight: 700,
  });
});

it("normalizes empty paragraphs and strips null mark attrs", () => {
  expect(
    canonicalRichText({ type: "doc", content: [{ type: "paragraph" }] }),
  ).toEqual({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  expect(
    canonicalRichText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "字",
              marks: [
                {
                  type: "textStyle",
                  attrs: { color: "#ff0000", fontId: null } as never,
                },
              ],
            },
          ],
        },
      ],
    }).content![0].content![0].marks![0].attrs,
  ).toEqual({ color: "#ff0000" });
});
