import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Status } from "./index";

function rootTag(html: string): string {
  const match = /<div[^>]*>/.exec(html);
  expect(match, "no status element rendered").not.toBeNull();
  return match![0];
}

function classListOf(html: string): string[] {
  const match = /class="([^"]*)"/.exec(rootTag(html));
  return match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
}

describe("Status contract", () => {
  it("announces failures as an alert and the rest as a live status", () => {
    const error = renderToStaticMarkup(
      createElement(Status, { tone: "error", children: "保存失败" }),
    );
    expect(error).toContain('role="alert"');
    const info = renderToStaticMarkup(
      createElement(Status, { children: "正在加载作品…" }),
    );
    expect(info).toContain('role="status"');
  });

  it("keeps the tone hooks the pages select on and adds the antd type", () => {
    const classes = classListOf(
      renderToStaticMarkup(createElement(Status, { tone: "error", children: "已断开" })),
    );
    expect(classes).toContain("status-error");
    expect(classes).toContain("ant-alert-error");
  });

  it("states success without an icon that would duplicate the words", () => {
    const html = renderToStaticMarkup(
      createElement(Status, { tone: "success", children: "已保存" }),
    );
    expect(html).toContain("已保存");
    expect(classListOf(html)).toContain("ant-alert-no-icon");
  });
});
