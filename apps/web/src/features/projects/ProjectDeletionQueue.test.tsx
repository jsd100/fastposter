import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectDeletionDTO } from "@fastposter/api-client";
import { ProjectDeletionQueue } from "./ProjectDeletionQueue";

const base: ProjectDeletionDTO = {
  id: "task-1",
  projectId: "p1",
  ownerId: "u1",
  state: "pending",
  createdAt: "2026-11-03T10:00:00Z",
  title: "旧海报",
  width: 1200,
  height: 1600,
  deletedAt: "2026-11-03T10:00:00Z",
};

function task(patch: Partial<ProjectDeletionDTO>): ProjectDeletionDTO {
  return { ...base, ...patch };
}

function render(
  tasks: ProjectDeletionDTO[],
  total = tasks.length,
  page = 1,
): string {
  return renderToStaticMarkup(
    <ProjectDeletionQueue
      tasks={tasks}
      total={total}
      page={page}
      onPage={() => {}}
      onRetry={() => {}}
      busy={false}
    />,
  );
}

describe("ProjectDeletionQueue", () => {
  it("renders task metadata without a document and without restore", () => {
    const html = render([task({})]);
    expect(html).toContain("待清理作品");
    expect(html).toContain("旧海报");
    expect(html).toContain("1200 × 1600");
    expect(html).toContain("正在清理相关文件");
    expect(html).not.toContain("恢复作品");
    expect(html).not.toContain("undefined");
  });

  it("falls back to a safe title when the project name was cleared", () => {
    const html = render([task({ title: undefined })]);
    expect(html).toContain("已删除作品");
  });

  it("shows a retry action for retry_wait without offering restore", () => {
    const html = render([
      task({ id: "task-1" }),
      task({ id: "task-2", state: "retry_wait", title: "另一张" }),
    ]);
    expect(html).toContain("重试清理");
    expect(html).not.toContain("恢复作品");
  });

  it("paginates the pending queue independently", () => {
    const html = render([task({})], 30, 2);
    expect(html).toContain('aria-label="待清理作品分页"');
    expect(html).toMatch(/aria-current="page"[^>]*>2</);
    expect(html).not.toMatch(/aria-current="page"[^>]*>1</);
  });
});
