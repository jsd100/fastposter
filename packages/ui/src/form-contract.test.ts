import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, FormField, IconButton, UIProvider } from "./index";

function classListOf(html: string, tag: RegExp): string[] {
  const match = tag.exec(html);
  expect(match, `${tag.source} did not render`).not.toBeNull();
  const classes = /class="([^"]*)"/.exec(match![0]);
  return classes ? classes[1].trim().split(/\s+/).filter(Boolean) : [];
}

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

  it("uses an antd loading component while busy without an English announcement", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { busy: true }, "保存中"),
    );
    // A busy control must show an antd loading component, but its icon cannot
    // be antd's native role="img" aria-label="loading": that would append
    // English noise to every accessible name. The antd Spin stays hidden and
    // the button keeps its antd loading class and aria-busy semantics.
    expect(html).toContain("ant-spin");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-label="loading"');
    expect(classListOf(html, /<button[^>]*>/)).toContain("ant-btn-loading");
  });

  it("maps variants onto antd colors and keeps the page hook classes", () => {
    const primary = classListOf(
      renderToStaticMarkup(
        createElement(Button, { variant: "primary" }, "导出"),
      ),
      /<button[^>]*>/,
    );
    expect(primary).toContain("ant-btn-color-primary");
    expect(primary).toContain("ant-btn-variant-solid");
    expect(primary).toContain("button-primary");
    const ghost = classListOf(
      renderToStaticMarkup(createElement(Button, { variant: "ghost" }, "更多")),
      /<button[^>]*>/,
    );
    expect(ghost).toContain("ant-btn-variant-text");
    const danger = classListOf(
      renderToStaticMarkup(
        createElement(Button, { variant: "danger" }, "删除"),
      ),
      /<button[^>]*>/,
    );
    expect(danger).toContain("ant-btn-color-dangerous");
    expect(danger).toContain("button-danger");
  });

  it("shrinks a compact button without dropping the compact hook", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { density: "compact" }, "撤销"),
    );
    expect(classListOf(html, /<button[^>]*>/)).toContain("ant-btn-sm");
  });

  it("keeps a two-character label exact so names stay addressable", () => {
    const html = renderToStaticMarkup(
      createElement(UIProvider, null, createElement(Button, null, "取消")),
    );
    expect(html).toContain(">取消<");
    expect(html).not.toContain("取 消");
  });

  it("exposes an icon-only button that still needs an accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(IconButton, { "aria-label": "关闭" }, "×"),
    );
    expect(html).toContain('aria-label="关闭"');
    expect(html).toContain('type="button"');
    expect(classListOf(html, /<button[^>]*>/)).toContain("icon-button");
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

  it("paints the error state with the control token, not a page override", () => {
    const html = renderToStaticMarkup(
      createElement(FormField, {
        label: "密码",
        id: "pw2",
        error: "密码不正确",
      }),
    );
    // antd drives the red frame through its status; the page keeps no border
    // override of its own, so the status class is the visible contract.
    expect(classListOf(html, /<input[^>]*>/)).toContain(
      "ant-input-status-error",
    );
    expect(html).toContain('aria-invalid="true"');
  });
});
