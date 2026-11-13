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

  it("shares the data hook across every text-like control", () => {
    // antd adds its own classes, and CSS-module names are hashed, so the
    // attribute is the stable hook the package owns and the pages target.
    const controls = [
      renderToStaticMarkup(
        createElement(NumberField, {
          "aria-label": "模板排序",
          value: 3,
          onValueChange: () => {},
        }),
      ),
      renderToStaticMarkup(createElement(TextInput, { variant: "bare" })),
      renderToStaticMarkup(createElement(TextInput)),
      renderToStaticMarkup(createElement(Textarea, { variant: "bare" })),
      renderToStaticMarkup(createElement(Textarea)),
    ];
    for (const html of controls) expect(inputTag(html)).toContain('data-fp-input=""');
  });

  it("marks every text control, including the bare variant", () => {
    for (const variant of ["field", "bare"] as const) {
      expect(
        inputTag(renderToStaticMarkup(createElement(TextInput, { variant }))),
      ).toContain('data-fp-input=""');
      expect(
        inputTag(renderToStaticMarkup(createElement(Textarea, { variant }))),
      ).toContain('data-fp-input=""');
    }
  });

  it("lets antd frame the field and drop the frame for bare controls", () => {
    expect(classListOf(renderToStaticMarkup(createElement(TextInput)))).toContain(
      "ant-input-outlined",
    );
    expect(
      classListOf(renderToStaticMarkup(createElement(TextInput, { variant: "bare" }))),
    ).toContain("ant-input-borderless");
    expect(
      classListOf(renderToStaticMarkup(createElement(Textarea))),
    ).toContain("ant-input-outlined");
    expect(
      classListOf(renderToStaticMarkup(createElement(Textarea, { variant: "bare" }))),
    ).toContain("ant-input-borderless");
  });

  it("keeps the caller class name on every variant", () => {
    for (const variant of ["field", "bare"] as const) {
      expect(
        classListOf(
          renderToStaticMarkup(
            createElement(TextInput, { variant, className: "page-owned" }),
          ),
        ),
      ).toContain("page-owned");
      expect(
        classListOf(
          renderToStaticMarkup(
            createElement(Textarea, { variant, className: "page-owned" }),
          ),
        ),
      ).toContain("page-owned");
    }
  });
});
