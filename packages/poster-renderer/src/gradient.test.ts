import { describe, it, expect } from "vitest";
import type { PosterDocument } from "@fastposter/poster-schema";
import {
  gradientCSS,
  gradientValueKey,
  isGradientColor,
  nextGradientRangeId,
  layoutGradientRanges,
} from "./gradient";

const linear = {
  type: "linear" as const,
  rangeId: "range-a",
  angle: 45,
  stops: [
    { color: "#ff0000", offset: 0 },
    { color: "#00ff00", offset: 100 },
  ],
};
const radial = {
  type: "radial" as const,
  rangeId: "range-b",
  centerX: 25,
  centerY: 75,
  stops: [
    { color: "#ffff00", offset: 0 },
    { color: "#00ffff", offset: 100 },
  ],
};

describe("gradient CSS and value identity", () => {
  it("maps document gradients to CSS with the same angle and stop convention", () => {
    expect(gradientCSS(linear)).toBe(
      "linear-gradient(45deg, #ff0000 0%, #00ff00 100%)",
    );
    expect(gradientCSS(radial)).toBe(
      "radial-gradient(circle at 25% 75%, #ffff00 0%, #00ffff 100%)",
    );
  });
  it("compares colors by value, ignoring the grouping rangeId", () => {
    expect(gradientValueKey(linear)).toBe(
      gradientValueKey({ ...linear, rangeId: "range-z" }),
    );
    expect(gradientValueKey(linear)).not.toBe(gradientValueKey(radial));
    expect(gradientValueKey(linear)).not.toBe(
      gradientValueKey({ ...linear, angle: 90 }),
    );
    expect(gradientValueKey("#ff0000")).toBe("solid:#ff0000");
    expect(isGradientColor(linear)).toBe(true);
    expect(isGradientColor("#ff0000")).toBe(false);
  });
});

describe("gradient range identity", () => {
  const document = {
    textBlocks: [
      {
        id: "block",
        defaultStyle: { color: "#000000" },
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [
                    {
                      type: "textStyle",
                      attrs: { color: { ...linear, rangeId: "range-1" } },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  } as unknown as PosterDocument;
  it("allocates an unused block-local id", () => {
    expect(nextGradientRangeId(document, "block")).toBe("range-2");
  });
  it("gives two identical applications separate ids", () => {
    const twice = {
      textBlocks: [
        {
          id: "block",
          defaultStyle: { color: "#000000" },
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "A",
                    marks: [
                      {
                        type: "textStyle",
                        attrs: { color: { ...linear, rangeId: "range-1" } },
                      },
                    ],
                  },
                  {
                    type: "text",
                    text: "B",
                    marks: [
                      {
                        type: "textStyle",
                        attrs: { color: { ...linear, rangeId: "range-2" } },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    } as unknown as PosterDocument;
    expect(nextGradientRangeId(twice, "block")).toBe("range-3");
  });
});

describe("shared coordinate layout", () => {
  function span(rangeId: string, rect: [number, number, number, number]) {
    return {
      style: {} as Record<string, string>,
      getAttribute: (name: string) =>
        name === "data-gradient-range" ? rangeId : null,
      getBoundingClientRect: () => ({
        left: rect[0],
        top: rect[1],
        right: rect[2],
        bottom: rect[3],
      }),
    } as unknown as HTMLElement;
  }
  it("sizes every fragment to the union and offsets it by its own origin", () => {
    const first = span("A", [10, 20, 110, 60]);
    const second = span("A", [30, 70, 130, 110]);
    const other = span("B", [200, 20, 260, 60]);
    const root = {
      querySelectorAll: () => [first, second, other],
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    } as unknown as ParentNode;
    layoutGradientRanges(root);
    expect(first.style.backgroundSize).toBe("120px 90px");
    expect(first.style.backgroundPosition).toBe("0px 0px");
    expect(second.style.backgroundPosition).toBe("-20px -50px");
    expect(other.style.backgroundSize).toBe("60px 40px");
  });
});
