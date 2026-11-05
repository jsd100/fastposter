import { describe, expect, it } from "vitest";
import {
  isDeletionComplete,
  mergeDeletionStatus,
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
});
