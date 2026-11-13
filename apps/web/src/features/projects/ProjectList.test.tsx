import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { ProjectListView } from "./ProjectList";
import { CARD_MENU } from "./project-menu";
describe("project list states", () => {
  it("offers both starting points from an empty workspace", () => {
    const html = renderToStaticMarkup(
      <ProjectListView
        projects={[]}
        loading={false}
        trash={false}
        onAction={() => {}}
        onUpload={() => {}}
        onBrowseTemplates={() => {}}
        onClearSearch={() => {}}
      />,
    );
    expect(html).toContain("从一张图片开始");
    expect(html).toContain("导入背景图");
    expect(html).toContain("从模板开始");
    expect(html).not.toContain("彻底删除");
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
        onBrowseTemplates={() => {}}
        onClearSearch={() => {}}
      />,
    );
    expect(html).toContain("恢复作品");
    expect(html).toContain("彻底删除");
    expect(html).not.toContain("/projects/p1/edit");
  });
  it("does not claim the trash is empty while cleanup is pending", () => {
    const html = renderToStaticMarkup(
      <ProjectListView
        projects={[]}
        loading={false}
        trash
        pendingDeletions={2}
        onAction={() => {}}
        onUpload={() => {}}
        onBrowseTemplates={() => {}}
        onClearSearch={() => {}}
      />,
    );
    expect(html).toContain("没有可恢复的作品");
    expect(html).not.toContain("回收站是空的");
  });
  it("keeps the card menu on the poster actions, never on the deleted ones", () => {
    const items = CARD_MENU.map((item) => item.text);
    expect(items).toEqual(["重命名", "复制作品", "移到回收站"]);
    expect(items).not.toContain("彻底删除");
  });
  it("names the search that matched nothing and offers to clear it", () => {
    const html = renderToStaticMarkup(
      <ProjectListView
        projects={[]}
        loading={false}
        trash={false}
        filtered
        searchTerm="画廊"
        onAction={() => {}}
        onUpload={() => {}}
        onBrowseTemplates={() => {}}
        onClearSearch={() => {}}
      />,
    );
    expect(html).toContain("画廊");
    expect(html).toContain("清除搜索");
    expect(html).not.toContain("从一张图片开始");
    expect(html).not.toContain("导入背景图");
  });
});
