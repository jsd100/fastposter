import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { ProjectListView } from "./ProjectList";
describe("project list states", () => {
  it("offers an accessible first upload from empty workspace", () => {
    const html = renderToStaticMarkup(
      <ProjectListView
        projects={[]}
        loading={false}
        trash={false}
        onAction={() => {}}
        onUpload={() => {}}
      />,
    );
    expect(html).toContain("从一张图片开始");
    expect(html).toContain("导入背景图");
  });
  it("shows recovery actions in trash without editing deleted projects", () => {
    const html = renderToStaticMarkup(
      <ProjectListView
        projects={[
          {
            id: "p1",
            title: "旧海报",
            document: "{}",
            revision: "1",
            width: 1200,
            height: 1600,
            updatedAt: "2026-10-30T00:00:00Z",
            deletedAt: "2026-10-30T00:00:00Z",
          },
        ]}
        loading={false}
        trash
        onAction={() => {}}
        onUpload={() => {}}
      />,
    );
    expect(html).toContain("恢复作品");
    expect(html).not.toContain("/projects/p1/edit");
  });
});
