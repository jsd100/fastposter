import { afterEach, it, expect, vi } from "vitest";
import { Autosave } from "./autosave";
afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
it("saves once 1000ms after the last edit", async () => {
  vi.useFakeTimers();
  const save = vi.fn(async (document: { text: string }, revision: string) => ({
    document,
    revision: String(Number(revision) + 1),
  }));
  const autosave = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist: async () => {},
  });
  autosave.update({ text: "b" });
  await vi.advanceTimersByTimeAsync(700);
  autosave.update({ text: "c" });
  await vi.advanceTimersByTimeAsync(999);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0]).toEqual([{ text: "c" }, "1"]);
  expect(autosave.getState().status).toBe("saved");
  autosave.dispose();
});
it("blocks drag and pending uploads without acknowledging saved", async () => {
  vi.useFakeTimers();
  const save = vi.fn(async (document: { text: string }) => ({
    document,
    revision: "2",
  }));
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist: async () => {},
  });
  controller.setBlocked(true);
  controller.update({ text: "b" });
  await vi.advanceTimersByTimeAsync(2000);
  expect(save).not.toHaveBeenCalled();
  expect(controller.getState().status).toBe("blocked");
  controller.setBlocked(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(save).toHaveBeenCalledTimes(1);
  controller.dispose();
});
it("late response never marks a newer document saved and serializes revisions", async () => {
  vi.useFakeTimers();
  const first = deferred<{ document: { text: string }; revision: string }>();
  const save = vi
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(async (document) => ({ document, revision: "3" }));
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist: async () => {},
  });
  controller.update({ text: "b" });
  await vi.advanceTimersByTimeAsync(1000);
  controller.update({ text: "c" });
  first.resolve({ document: { text: "b" }, revision: "2" });
  await vi.advanceTimersByTimeAsync(0);
  expect(controller.getState().document).toEqual({ text: "c" });
  expect(controller.getState().status).not.toBe("saved");
  await controller.flush();
  expect(save.mock.calls[1]).toEqual([{ text: "c" }, "2"]);
  expect(controller.getState().status).toBe("saved");
  controller.dispose();
});
it("conflictPreservesLocalDraft and stops retries until explicit resolution", async () => {
  vi.useFakeTimers();
  const drafts: unknown[] = [];
  const save = vi.fn(async () => {
    throw Object.assign(new Error("conflict"), { code: "REVISION_CONFLICT" });
  });
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist: async (draft) => {
      drafts.push(draft);
    },
  });
  controller.update({ text: "local" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(controller.getState().status).toBe("conflict");
  expect(controller.getState().document).toEqual({ text: "local" });
  expect(drafts.at(-1)).toMatchObject({
    document: { text: "local" },
    baseRevision: "1",
  });
  await vi.advanceTimersByTimeAsync(10000);
  expect(save).toHaveBeenCalledTimes(1);
  controller.dispose();
});
it("unresolved restored conflict keeps its original draft revision across another refresh", async () => {
  const drafts: unknown[] = [];
  const controller = new Autosave({
    initial: { text: "cloud" },
    revision: "2",
    save: async (document) => ({ document, revision: "3" }),
    persist: async (draft) => {
      drafts.push(draft);
    },
  });
  await controller.restore({ text: "local" }, "1");
  expect(controller.getState().status).toBe("conflict");
  expect(drafts.at(-1)).toMatchObject({
    baseRevision: "1",
    document: { text: "local" },
  });
  controller.dispose();
});
it("compares documents by values rather than JSON property order", () => {
  const save = vi.fn();
  const controller = new Autosave({
    initial: { color: "#ff0000", fontSize: 80 },
    revision: "1",
    save,
    persist: async () => {},
  });
  controller.update({ fontSize: 80, color: "#ff0000" });
  expect(controller.getState().status).toBe("saved");
  expect(save).not.toHaveBeenCalled();
  controller.dispose();
});
it("cannot be revived after the project is permanently deleted", async () => {
  vi.useFakeTimers();
  const save = vi.fn(async (document: { text: string }) => ({
    document,
    revision: "2",
  }));
  const persist = vi.fn(async () => {});
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist,
  });
  controller.stopDeleted();
  controller.setBlocked(false);
  controller.update({ text: "b" });
  await vi.advanceTimersByTimeAsync(5000);
  expect(save).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
  expect(controller.getState().status).toBe("deleted");
  controller.dispose();
  await vi.advanceTimersByTimeAsync(5000);
  expect(save).not.toHaveBeenCalled();
});
it("an in-flight save settling after deletion cannot revive the document", async () => {
  vi.useFakeTimers();
  const pending = deferred<{ document: { text: string }; revision: string }>();
  const persist = vi.fn(async () => {});
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save: () => pending.promise,
    persist,
  });
  controller.update({ text: "b" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(persist).toHaveBeenCalledTimes(1);
  controller.stopDeleted();
  pending.resolve({ document: { text: "b" }, revision: "2" });
  await vi.advanceTimersByTimeAsync(0);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(controller.getState().status).toBe("deleted");
  controller.dispose();
});
it("stops permanently when saving reports the project is gone", async () => {
  vi.useFakeTimers();
  const save = vi.fn(async () => {
    throw Object.assign(new Error("作品不存在或无权访问"), {
      code: "NOT_FOUND",
    });
  });
  const persist = vi.fn(async () => {});
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist,
  });
  controller.update({ text: "b" });
  await expect(controller.flush()).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(controller.getState().status).toBe("deleted");
  const persisted = persist.mock.calls.length;
  controller.setBlocked(false);
  controller.update({ text: "c" });
  await vi.advanceTimersByTimeAsync(5000);
  expect(save).toHaveBeenCalledTimes(1);
  expect(persist).toHaveBeenCalledTimes(persisted);
  controller.dispose();
});
it("keeps other save failures retryable", async () => {
  const save = vi.fn(async () => {
    throw Error("网络中断");
  });
  const controller = new Autosave({
    initial: { text: "a" },
    revision: "1",
    save,
    persist: async () => {},
  });
  controller.update({ text: "b" });
  await expect(controller.flush()).rejects.toThrow("网络中断");
  expect(controller.getState().status).toBe("error");
  controller.update({ text: "c" });
  expect(controller.getState().status).toBe("dirty");
  controller.dispose();
});
