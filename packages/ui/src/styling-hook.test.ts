import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NumberField, TextInput, Textarea } from "./index";

function inputTag(html: string): string {
  const match = /<(?:input|textarea)[^>]*>/.exec(html);
  expect(match, "no control element rendered").not.toBeNull();
  return match![0];
}

describe("styling hook", () => {
  it("marks the number field input so page CSS can style it", () => {
    const html = renderToStaticMarkup(
      createElement(NumberField, {
        "aria-label": "模板排序",
        value: 3,
        onValueChange: () => {},
      }),
    );
    expect(inputTag(html)).toContain('data-fp-input=""');
  });

  it("marks every text control, including the bare variant", () => {
    for (const variant of ["field", "bare"] as const) {
      expect(inputTag(renderToStaticMarkup(createElement(TextInput, { variant })))).toContain(
        'data-fp-input=""',
      );
      expect(
        inputTag(renderToStaticMarkup(createElement(Textarea, { variant }))),
      ).toContain('data-fp-input=""');
    }
  });

  it("leaves appearance to the page only in the bare variant", () => {
    function classOf(variant: "field" | "bare"): string {
      const match = /class="([^"]*)"/.exec(
        renderToStaticMarkup(
          createElement(TextInput, { variant, className: "page-owned" }),
        ),
      );
      expect(match).not.toBeNull();
      return match![1]
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
    }
    expect(classOf("bare")).toBe("page-owned");
    expect(classOf("field").split(" ")).toContain("page-owned");
    expect(classOf("field").length).toBeGreaterThan("page-owned".length);
  });
});
