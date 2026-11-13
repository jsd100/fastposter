import { describe, expect, it } from "vitest";
import {
  isDeletionComplete,
  mergeDeletionStatus,
  replaceDeletionTask,
  type ProjectDeletionDTO,
} from "./index";

const base: ProjectDeletionDTO = {
  id: "task-1",
  projectId: "p1",
  ownerId: "u1",
  state: "pending",
  createdAt: "2026-11-04T00:00:00Z",
};

function task(patch: Partial<ProjectDeletionDTO>): ProjectDeletionDTO {
  return { ...base, ...patch };
}

describe("project deletion helpers", () => {
  it("treats only completed cleanup as complete", () => {
    expect(isDeletionComplete(task({ state: "completed" }))).toBe(true);
    for (const state of ["pending", "running", "retry_wait"]) {
      expect(isDeletionComplete(task({ state }))).toBe(false);
    }
  });

  it("never regresses a completed task with a late running response", () => {
    const completed = task({
      state: "completed",
      completedAt: "2026-11-04T01:00:00Z",
    });
    const late = task({ state: "running" });
    expect(mergeDeletionStatus(completed, late)).toBe(completed);
    expect(mergeDeletionStatus(completed, late).state).toBe("completed");
    expect(mergeDeletionStatus(late, completed).state).toBe("completed");
  });

  it("does not merge different task identities", () => {
    const first = task({ id: "task-1", state: "retry_wait" });
    const second = task({ id: "task-2", state: "running" });
    expect(mergeDeletionStatus(first, second)).toBe(second);
  });

  it("replaces only the matching task when one item is retried", () => {
    const first = task({ id: "task-1", state: "retry_wait", title: "第一件" });
    const second = task({ id: "task-2", state: "pending", title: "第二件" });
    const updated = task({ id: "task-1", state: "pending" });
    const list = replaceDeletionTask([first, second], updated);
    expect(list.map((item) => item.id)).toEqual(["task-1", "task-2"]);
    expect(list[0].state).toBe("pending");
    expect(list[1]).toBe(second);
    expect(list[1].title).toBe("第二件");
  });
});
