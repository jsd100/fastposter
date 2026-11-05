import { afterEach, expect, it, vi } from "vitest";
import { DraftStore, type Draft } from "./drafts";

class FakeDatabase {
  onversionchange: (() => void) | null = null;
  constructor(private indexed: FakeIndexedDB) {}
  close() {}
  createObjectStore() {
    return { createIndex() {} };
  }
  transaction() {
    return new FakeTransaction(this.indexed);
  }
}

class FakeTransaction {
  oncomplete?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  private operations: Array<() => void> = [];
  constructor(private indexed: FakeIndexedDB) {
    queueMicrotask(() => {
      for (const operation of this.operations) operation();
      this.oncomplete?.();
    });
  }
  objectStore() {
    return {
      put: (draft: Draft) => {
        this.operations.push(() => {
          this.indexed.writes.push(`${draft.userId}/${draft.projectId}`);
          this.indexed.rows.set(
            `${draft.userId}/${draft.projectId}`,
            structuredClone(draft),
          );
        });
      },
      delete: ([userId, projectId]: [string, string]) => {
        this.operations.push(() => {
          this.indexed.rows.delete(`${userId}/${projectId}`);
        });
      },
      get: ([userId, projectId]: [string, string]) => {
        const request = {
          result: undefined as Draft | undefined,
          onsuccess: undefined as (() => void) | undefined,
          onerror: undefined as (() => void) | undefined,
        };
        queueMicrotask(() => {
          request.result = this.indexed.rows.get(`${userId}/${projectId}`);
          request.onsuccess?.();
        });
        return request;
      },
    };
  }
}

class FakeIndexedDB {
  rows = new Map<string, Draft>();
  writes: string[] = [];
  holdNextOpen = false;
  private releaseOpenGate?: () => void;
  open() {
    const request = {
      result: undefined as FakeDatabase | undefined,
      onupgradeneeded: undefined as (() => void) | undefined,
      onsuccess: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      onblocked: undefined as (() => void) | undefined,
    };
    const gate = this.holdNextOpen
      ? new Promise<void>((resolve) => {
          this.releaseOpenGate = resolve;
        })
      : Promise.resolve();
    this.holdNextOpen = false;
    void gate.then(() => {
      request.result = new FakeDatabase(this);
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }
  release() {
    this.releaseOpenGate?.();
    this.releaseOpenGate = undefined;
  }
  has(userId: string, projectId: string) {
    return this.rows.has(`${userId}/${projectId}`);
  }
}

function draft(userId: string, projectId: string, title: string): Draft {
  return {
    userId,
    projectId,
    title,
    document: {} as Draft["document"],
    baseRevision: "1",
    updatedAt: Date.now(),
    pendingFiles: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

it("does not let a delayed draft write revive a permanently deleted project", async () => {
  const fake = new FakeIndexedDB();
  fake.rows.set("u1/p1", draft("u1", "p1", "old"));
  fake.holdNextOpen = true;
  vi.stubGlobal("indexedDB", fake as unknown as IDBFactory);
  const store = new DraftStore();
  const put = store.put(draft("u1", "p1", "late"));
  const blocked = store.blockProject("u1", "p1");
  fake.release();
  await Promise.all([put, blocked]);
  expect(fake.writes).toEqual([]);
  expect(fake.has("u1", "p1")).toBe(false);
});

it("blocks only the deleted project, not other drafts of the same user", async () => {
  const fake = new FakeIndexedDB();
  vi.stubGlobal("indexedDB", fake as unknown as IDBFactory);
  const store = new DraftStore();
  await store.put(draft("u1", "p1", "old"));
  await store.blockProject("u1", "p1");
  await store.put(draft("u1", "p2", "other"));
  expect(fake.writes).toEqual(["u1/p1", "u1/p2"]);
  expect(fake.has("u1", "p1")).toBe(false);
  expect(fake.has("u1", "p2")).toBe(true);
});
