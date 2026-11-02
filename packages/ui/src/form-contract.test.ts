import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, FormField, IconButton } from "./index";

function describedByIds(html: string): string[] {
  const match = /<input[^>]*\saria-describedby="([^"]*)"/.exec(html);
  return match ? match[1].trim().split(/\s+/) : [];
}

function hasElementWithId(html: string, id: string, text: string): boolean {
  return new RegExp(`id="${id}"[^>]*>[^<]*${text}`).test(html);
}

describe("Button contract", () => {
  it("defaults to type button so it never submits an enclosing form", () => {
    const html = renderToStaticMarkup(
      createElement("form", null, createElement(Button, null, "取消")),
    );
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });

  it("keeps an explicit submit type for real form actions", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { type: "submit" }, "更新密码"),
    );
    expect(html).toContain('type="submit"');
  });

  it("marks a busy button as disabled and aria-busy", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { busy: true }, "保存中"),
    );
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
  });

  it("exposes an icon-only button that still needs an accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(IconButton, { "aria-label": "关闭" }, "×"),
    );
    expect(html).toContain('aria-label="关闭"');
    expect(html).toContain('type="button"');
  });
});

describe("FormField contract", () => {
  it("keeps a caller supplied id instead of overwriting it", () => {
    const html = renderToStaticMarkup(
      createElement(FormField, { label: "作品名称", id: "project-name" }),
    );
    expect(html).toContain('for="project-name"');
    expect(html).toContain('id="project-name"');
  });

  it("links both the hint and the error text to the input", () => {
    const html = renderToStaticMarkup(
      createElement(FormField, {
        label: "密码",
        id: "pw",
        hint: "至少八个字符",
        error: "密码不正确",
      }),
    );
    const ids = describedByIds(html);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(html).toMatch(new RegExp(`id="${id}"`));
    expect(ids.some((id) => hasElementWithId(html, id, "至少八个字符"))).toBe(
      true,
    );
    expect(ids.some((id) => hasElementWithId(html, id, "密码不正确"))).toBe(
      true,
    );
    expect(html).toContain('aria-invalid="true"');
  });

  it("describes only the hint while there is no error", () => {
    const html = renderToStaticMarkup(
      createElement(FormField, {
        label: "用户名",
        id: "u",
        hint: "至少两个字符",
      }),
    );
    expect(describedByIds(html)).toHaveLength(1);
    expect(html).not.toContain("aria-invalid");
  });
});
