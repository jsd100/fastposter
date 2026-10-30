import { it, expect } from "vitest";
import type { RichNode } from "@fastposter/poster-schema";
import { applyTextStyle, selectionStyle, canonicalRichText } from "./selection";
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
