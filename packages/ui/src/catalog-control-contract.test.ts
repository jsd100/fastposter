import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckboxField, FileField, Workbench } from "./index";

function checkboxTag(html: string): string {
  const match = /<input[^>]*type="checkbox"[^>]*>/.exec(html);
  expect(match, "no checkbox input rendered").not.toBeNull();
  return match![0];
}

function fileInputTag(html: string): string {
  const tags = html.match(/<input[^>]*>/g) ?? [];
  const match = tags.find((tag) => tag.includes('type="file"'));
  expect(match, "no file input rendered").not.toBeUndefined();
  return match!;
}

describe("CheckboxField contract", () => {
  it("names the checkbox with its own text instead of a second label", () => {
    const html = renderToStaticMarkup(
      createElement(CheckboxField, {
        label: "立即发布",
        checked: false,
        onChange: () => {},
      }),
    );
    // The wrapping <label> is the accessible name, so 立即发布 is said once and
    // `getByLabel("立即发布")` still resolves to the input.
    expect(/<label[^>]*>[\s\S]*?立即发布/.test(html)).toBe(true);
    expect(checkboxTag(html)).not.toContain("aria-label");
  });

  it("keeps the checked state on the input", () => {
    const html = renderToStaticMarkup(
      createElement(CheckboxField, {
        label: "发布文案",
        checked: true,
        onChange: () => {},
      }),
    );
    expect(checkboxTag(html)).toContain("checked");
  });

  it("disables the input itself, not only the wrapper", () => {
    const html = renderToStaticMarkup(
      createElement(CheckboxField, {
        label: "发布分类",
        checked: false,
        disabled: true,
        onChange: () => {},
      }),
    );
    expect(checkboxTag(html)).toContain("disabled");
  });
});

describe("Workbench contract", () => {
  const rootTag = (html: string) => /<div[^>]*>/.exec(html)![0];

  it("is a named dialog that can take the keyboard", () => {
    const html = renderToStaticMarkup(
      createElement(Workbench, {
        label: "模板编辑器",
        className: "template-editor-overlay",
        children: "共享编辑器",
      }),
    );
    const root = rootTag(html);
    expect(root).toContain('role="dialog"');
    expect(root).toContain('aria-label="模板编辑器"');
    // Opening moves the focus here, which only works on a focusable container.
    expect(root).toContain('tabindex="-1"');
    expect(html).toContain("template-editor-overlay");
    expect(html).toContain("共享编辑器");
    // The legacy marker would hand the keystrokes to the container and silence
    // the editor it hosts.
    expect(html).not.toContain("data-fp-overlay");
  });
});

describe("FileField contract", () => {
  const pick = () => {};

  it("puts the accessible name on the file input the caller targets", () => {
    const html = renderToStaticMarkup(
      createElement(FileField, {
        "aria-label": "背景图片文件",
        label: "选择背景图片",
        accept: "image/png,image/jpeg,image/webp",
        value: null,
        onChange: pick,
      }),
    );
    const input = fileInputTag(html);
    expect(input).toContain('aria-label="背景图片文件"');
    expect(input).toContain('accept="image/png,image/jpeg,image/webp"');
  });

  it("offers a plain button as the visible trigger", () => {
    const html = renderToStaticMarkup(
      createElement(FileField, {
        "aria-label": "字体文件",
        label: "选择字体文件",
        value: null,
        onChange: pick,
      }),
    );
    expect(html).toContain("ant-upload");
    // A submit-capable trigger inside 保存素材 would upload twice.
    expect(/<button[^>]*>[\s\S]{0,120}?选择字体文件/.test(html)).toBe(true);
    expect(html).not.toContain('type="submit"');
  });

  it("keeps a picked file visible without uploading it", () => {
    const file = new File(["poster"], "共享风景.png", { type: "image/png" });
    const html = renderToStaticMarkup(
      createElement(FileField, {
        "aria-label": "背景图片文件",
        label: "选择背景图片",
        hint: "JPG / PNG / WebP · 原文件最大 40 MiB。",
        value: file,
        onChange: pick,
      }),
    );
    // Picking is a separate phase from submitting; the page uploads on save.
    expect(html).toContain("共享风景.png");
    expect(html).toContain("JPG / PNG / WebP");
  });

  it("matches the density of the row it sits in", () => {
    const html = renderToStaticMarkup(
      createElement(FileField, {
        "aria-label": "导入管理员模板包",
        label: "导入模板包",
        density: "compact",
        value: null,
        onChange: pick,
      }),
    );
    expect(html).toContain("ant-btn-sm");
  });

  it("disables the picker while an action is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(FileField, {
        "aria-label": "导入管理员模板包",
        label: "导入模板包",
        disabled: true,
        value: null,
        onChange: pick,
      }),
    );
    expect(html).toContain("ant-upload-disabled");
    expect(/<button[^>]*disabled/.test(html)).toBe(true);
  });
});
