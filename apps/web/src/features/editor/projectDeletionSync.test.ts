import { afterEach, expect, it, vi } from "vitest";
import {
  matchesProjectDeletion,
  PROJECT_DELETION_KEY,
  publishProjectDeletion,
  subscribeProjectDeletions,
} from "./projectDeletionSync";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

afterEach(() => vi.unstubAllGlobals());

it("delivers same-tab and cross-tab deletions but ignores malformed payloads", () => {
  const storage = new MemoryStorage();
  const target = new EventTarget();
  vi.stubGlobal("window", Object.assign(target, { localStorage: storage }));
  vi.stubGlobal("localStorage", storage);
  const events: unknown[] = [];
  const stop = subscribeProjectDeletions((event) => events.push(event));
  expect(PROJECT_DELETION_KEY).not.toBe("fastposter-session-event");
  publishProjectDeletion({ userId: "u1", projectId: "p1" });
  target.dispatchEvent(
    Object.assign(new Event("storage"), {
      key: PROJECT_DELETION_KEY,
      newValue: JSON.stringify({ userId: "u2", projectId: "p2" }),
    }),
  );
  target.dispatchEvent(
    Object.assign(new Event("storage"), {
      key: PROJECT_DELETION_KEY,
      newValue: "{broken",
    }),
  );
  target.dispatchEvent(
    new CustomEvent(PROJECT_DELETION_KEY, {
      detail: { userId: 1, projectId: "p2" },
    }),
  );
  expect(events).toEqual([
    { userId: "u1", projectId: "p1" },
    { userId: "u2", projectId: "p2" },
  ]);
  stop();
  publishProjectDeletion({ userId: "u1", projectId: "p3" });
  expect(events).toHaveLength(2);
});

it("only matches the signed-in owner's project", () => {
  expect(
    matchesProjectDeletion({ userId: "u1", projectId: "p1" }, "u1", "p1"),
  ).toBe(true);
  expect(
    matchesProjectDeletion({ userId: "u2", projectId: "p1" }, "u1", "p1"),
  ).toBe(false);
  expect(
    matchesProjectDeletion({ userId: "u1", projectId: "p2" }, "u1", "p1"),
  ).toBe(false);
});
