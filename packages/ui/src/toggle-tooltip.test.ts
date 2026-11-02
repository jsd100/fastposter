import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ToggleButton, Tooltip } from "./index";

function buttonCount(html: string): number {
  return (html.match(/<button/g) ?? []).length;
}

describe("ToggleButton contract", () => {
  it("exposes the pressed state and never submits an enclosing form", () => {
    const html = renderToStaticMarkup(
      createElement(
        "form",
        null,
        createElement(
          ToggleButton,
          {
            pressed: true,
            onPressedChange: () => {},
            "aria-label": "粗体",
          },
          "B",
        ),
      ),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain("button button-secondary");
    expect(html).not.toContain("onChange");
  });

  it("stays unpressed and can be disabled without losing its name", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToggleButton,
        {
          pressed: false,
          disabled: true,
          onPressedChange: () => {},
          "aria-label": "斜体",
        },
        "I",
      ),
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="斜体"');
  });

  it("keeps the shared button classes for variant and density", () => {
    const html = renderToStaticMarkup(
      createElement(
        ToggleButton,
        {
          pressed: false,
          onPressedChange: () => {},
          variant: "primary",
          density: "compact",
          "aria-label": "居中",
        },
        "居中",
      ),
    );
    expect(html).toContain("button button-primary");
    expect(html).toContain('aria-pressed="false"');
  });
});

describe("Tooltip contract", () => {
  it("keeps one button and leaves the accessible name on the trigger", () => {
    const html = renderToStaticMarkup(
      createElement(Tooltip, {
        label: "撤销 Ctrl/⌘ Z",
        children: createElement(Button, { "aria-label": "撤销" }, "U"),
      }),
    );
    expect(buttonCount(html)).toBe(1);
    expect(html).toContain('aria-label="撤销"');
  });

  it("does not render the hint while it is closed", () => {
    const html = renderToStaticMarkup(
      createElement(Tooltip, {
        label: "文字块前移一层",
        children: createElement(Button, { "aria-label": "文字块前移一层" }, "↑"),
      }),
    );
    expect(html).not.toContain("data-fp-tooltip");
  });
});
