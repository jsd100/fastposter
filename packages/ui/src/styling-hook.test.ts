import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NumberField, TextInput, Textarea } from "./index";

function inputTag(html: string): string {
  const match = /<(?:input|textarea)[^>]*>/.exec(html);
  expect(match, "no control element rendered").not.toBeNull();
  return match![0];
}

function classListOf(html: string): string[] {
  const match = /class="([^"]*)"/.exec(inputTag(html));
  return match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
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

  it("gives the number field input the shared focus class", () => {
    const numberField = classListOf(
      renderToStaticMarkup(
        createElement(NumberField, {
          "aria-label": "模板排序",
          value: 3,
          onValueChange: () => {},
        }),
      ),
    );
    const bare = classListOf(
      renderToStaticMarkup(createElement(TextInput, { variant: "bare" })),
    );
    expect(numberField).toEqual(bare);
    expect(numberField).toHaveLength(1);
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

  it("gives every variant the shared focus class but only field sets sizes", () => {
    function classOf(variant: "field" | "bare"): string[] {
      const match = /class="([^"]*)"/.exec(
        renderToStaticMarkup(
          createElement(TextInput, { variant, className: "page-owned" }),
        ),
      );
      expect(match).not.toBeNull();
      return match![1].trim().split(/\s+/).filter(Boolean);
    }
    const bare = classOf("bare");
    const field = classOf("field");
    expect(bare).toContain("page-owned");
    expect(field).toContain("page-owned");
    const shared = bare.filter((name) => name !== "page-owned");
    expect(shared).toHaveLength(1);
    expect(field).toContain(shared[0]);
    expect(field.length).toBeGreaterThan(bare.length);
  });
});
