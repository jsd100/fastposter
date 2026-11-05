import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ProjectDeletionStatus,
  deletionConfirmDisabled,
  type ProjectDeletionStatusProps,
} from "./index";

type Deletion = ProjectDeletionStatusProps["deletion"];

const base: Deletion = {
  id: "task-1",
  projectId: "p1",
  state: "pending",
};

function task(patch: Partial<Deletion>): Deletion {
  return { ...base, ...patch };
}

function status(patch: Partial<Deletion>): string {
  const props: ProjectDeletionStatusProps = {
    deletion: task(patch),
    onRetry: () => {},
    busy: false,
  };
  return renderToStaticMarkup(createElement(ProjectDeletionStatus, props));
}

describe("ProjectDeletionStatus", () => {
  it("shows background cleanup without restore or delete actions", () => {
    const html = status({ state: "running" });
    expect(html).toContain("正在清理相关文件");
    expect(html).toContain("作品已不可恢复");
    expect(html).not.toContain("恢复作品");
    expect(html).not.toContain("彻底删除");
  });

  it("offers only a safe retry after cleanup failure", () => {
    const html = status({ state: "retry_wait", errorCode: "CLEANUP_FAILED" });
    expect(html).toContain("部分文件尚未清理");
    expect(html).toContain("重试清理");
    expect(html).not.toContain("CLEANUP_FAILED");
    expect(html).not.toContain("internal_error");
  });

  it("reports completed cleanup with the agreed wording", () => {
    const html = status({
      state: "completed",
    });
    expect(html).toContain("作品及独占资源已彻底删除，共享资源已保留。");
  });
});

describe("deletionConfirmDisabled", () => {
  it("requires an admin acknowledgement before confirmation", () => {
    expect(deletionConfirmDisabled(true, false, false)).toBe(true);
    expect(deletionConfirmDisabled(true, true, false)).toBe(false);
    expect(deletionConfirmDisabled(false, false, false)).toBe(false);
  });

  it("blocks confirmation while a request is in flight", () => {
    expect(deletionConfirmDisabled(false, true, true)).toBe(true);
    expect(deletionConfirmDisabled(true, true, true)).toBe(true);
    expect(deletionConfirmDisabled(false, false, true)).toBe(true);
  });
});
