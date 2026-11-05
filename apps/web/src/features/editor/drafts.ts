import type { PosterDocument } from "@fastposter/poster-schema";
export type Draft = {
  userId: string;
  projectId: string;
  title: string;
  document: PosterDocument;
  baseRevision: string;
  updatedAt: number;
  pendingFiles: { name: string; file: File }[];
};
export class DraftStore {
  private database: Promise<IDBDatabase> | null = null;
  private epochs = new Map<string, number>();
  private userEpochs = new Map<string, number>();
  private blocked = new Set<string>();
  private blockedUsers = new Set<string>();
  activate(userId: string) {
    this.blockedUsers.delete(userId);
  }
  private projectKey(userId: string, projectId: string) {
    return `${userId}\u0000${projectId}`;
  }
  private open() {
    if (!this.database)
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        if (!globalThis.indexedDB) {
          reject(Error("当前浏览器不能保存本地草稿"));
          return;
        }
        const request = indexedDB.open("fastposter_drafts", 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("drafts", {
            keyPath: ["userId", "projectId"],
          });
          store.createIndex("by_user", "userId");
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.database = null;
          };
          resolve(db);
        };
        request.onerror = () => {
          this.database = null;
          reject(Error("本地草稿存储不可用，请检查浏览器空间"));
        };
        request.onblocked = () =>
          reject(Error("本地草稿升级被其他页面占用，请关闭其他窗口后重试"));
      });
    return this.database;
  }
  async put(draft: Draft) {
    const key = this.projectKey(draft.userId, draft.projectId);
    const epoch = this.epochs.get(key) ?? 0;
    const userEpoch = this.userEpochs.get(draft.userId) ?? 0;
    const copy = structuredClone(draft);
    const db = await this.open();
    if (
      this.blockedUsers.has(draft.userId) ||
      this.blocked.has(key) ||
      (this.epochs.get(key) ?? 0) !== epoch ||
      (this.userEpochs.get(draft.userId) ?? 0) !== userEpoch
    )
      return;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put(copy);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(Error("本地草稿保存失败，存储空间可能不足"));
    });
  }
  async blockProject(userId: string, projectId: string) {
    const key = this.projectKey(userId, projectId);
    this.blocked.add(key);
    this.epochs.set(key, (this.epochs.get(key) ?? 0) + 1);
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").delete([userId, projectId]);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(Error("清理本地草稿失败"));
    });
  }
  async get(userId: string, projectId: string) {
    const db = await this.open();
    return new Promise<Draft | undefined>((resolve, reject) => {
      const request = db
        .transaction("drafts")
        .objectStore("drafts")
        .get([userId, projectId]);
      request.onsuccess = () => resolve(request.result as Draft | undefined);
      request.onerror = () => reject(Error("读取本地草稿失败"));
    });
  }
  async delete(userId: string, projectId: string) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").delete([userId, projectId]);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(Error("清理本地草稿失败"));
    });
  }
  async clearUser(userId: string) {
    this.blockedUsers.add(userId);
    this.userEpochs.set(userId, (this.userEpochs.get(userId) ?? 0) + 1);
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      const cursor = tx
        .objectStore("drafts")
        .index("by_user")
        .openCursor(IDBKeyRange.only(userId));
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (current) {
          current.delete();
          current.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(Error("当前账号的本地草稿清理失败"));
    });
  }
}
export const drafts = new DraftStore();
