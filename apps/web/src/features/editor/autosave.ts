export function documentSignature(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
export type SaveStatus =
  | "saved"
  | "dirty"
  | "saving"
  | "blocked"
  | "offline"
  | "conflict"
  | "error"
  | "deleted";
export type DraftSnapshot<T> = {
  document: T;
  baseRevision: string;
  updatedAt: number;
};
export type AutosaveState<T> = {
  document: T;
  revision: string;
  status: SaveStatus;
  error?: unknown;
};
type Options<T> = {
  initial: T;
  revision: string;
  save: (
    document: T,
    revision: string,
  ) => Promise<{ document: T; revision: string }>;
  persist: (draft: DraftSnapshot<T>) => Promise<void>;
  onSaved?: (document: T, revision: string) => Promise<void> | void;
};
export class Autosave<T> {
  private state: AutosaveState<T>;
  private acknowledged: string;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private inFlight: Promise<{ document: T; revision: string }> | null = null;
  private blocked = false;
  private deleted = false;
  private disposed = false;
  private editedAt = 0;
  private persistence: Promise<void> = Promise.resolve();
  constructor(private options: Options<T>) {
    this.state = {
      document: structuredClone(options.initial),
      revision: options.revision,
      status: "saved",
    };
    this.acknowledged = documentSignature(options.initial);
  }
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<AutosaveState<T>>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private dirty() {
    return documentSignature(this.state.document) !== this.acknowledged;
  }
  private persist() {
    if (this.deleted) return Promise.resolve();
    const snapshot = {
      document: structuredClone(this.state.document),
      baseRevision: this.state.revision,
      updatedAt: Date.now(),
    };
    const operation = this.options.persist(snapshot);
    this.persistence = Promise.all([
      this.persistence.catch(() => {}),
      operation,
    ]).then(() => {});
    this.persistence.catch((error) => this.emit({ status: "error", error }));
    return this.persistence;
  }
  update(document: T) {
    if (this.disposed || this.deleted) return;
    this.generation++;
    this.editedAt = Date.now();
    const dirty = documentSignature(document) !== this.acknowledged;
    this.emit({
      document,
      status:
        this.state.status === "conflict"
          ? "conflict"
          : this.blocked
            ? "blocked"
            : dirty
              ? "dirty"
              : "saved",
      error: undefined,
    });
    this.persist();
    this.schedule();
  }
  setBlocked(blocked: boolean) {
    if (this.deleted || this.blocked === blocked) return;
    this.blocked = blocked;
    if (this.state.status !== "conflict")
      this.emit({
        status: blocked ? "blocked" : this.dirty() ? "dirty" : "saved",
      });
    this.schedule();
  }
  stopDeleted() {
    if (this.deleted) return;
    this.deleted = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.emit({ status: "deleted", error: undefined });
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (
      this.disposed ||
      this.deleted ||
      this.blocked ||
      this.inFlight ||
      !this.dirty() ||
      this.state.status === "conflict"
    )
      return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        this.flush(false).catch(() => {});
      },
      Math.max(0, this.editedAt + 1000 - Date.now()),
    );
  }
  async flush(drain = true): Promise<{ document: T; revision: string }> {
    if (this.disposed) throw Error("保存已停止");
    if (this.deleted)
      throw Object.assign(Error("作品已删除，无法继续保存到原作品"), {
        code: "PROJECT_DELETED",
      });
    if (this.blocked) throw Error("请等待上传或文字编辑事务完成");
    if (this.state.status === "conflict")
      throw Object.assign(new Error("请先处理版本冲突"), {
        code: "REVISION_CONFLICT",
      });
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.inFlight) {
      await this.inFlight;
      return drain
        ? this.flush()
        : { document: this.state.document, revision: this.state.revision };
    }
    if (!this.dirty())
      return { document: this.state.document, revision: this.state.revision };
    const generation = this.generation,
      document = structuredClone(this.state.document),
      revision = this.state.revision;
    this.emit({ status: "saving", error: undefined });
    const operation = (async () => {
      try {
        await this.persistence;
        const result = await this.options.save(document, revision);
        if (this.deleted)
          throw Object.assign(Error("作品已删除，无法继续保存到原作品"), {
            code: "PROJECT_DELETED",
          });
        this.acknowledged = documentSignature(document);
        this.emit({
          revision: result.revision,
          status: this.blocked
            ? "blocked"
            : generation === this.generation
              ? "saved"
              : "dirty",
        });
        // Persist the latest local document against the newly acknowledged cloud revision.
        if (!this.disposed) await this.persist();
        await this.options.onSaved?.(document, result.revision);
        return result;
      } catch (error) {
        if (this.deleted) throw error;
        const code = (error as { code?: string })?.code;
        if (code === "NOT_FOUND") {
          this.stopDeleted();
          throw error;
        }
        this.emit({
          status:
            code === "REVISION_CONFLICT"
              ? "conflict"
              : error instanceof TypeError
                ? "offline"
                : "error",
          error,
        });
        throw error;
      } finally {
        this.inFlight = null;
        if (
          !this.disposed &&
          !this.deleted &&
          this.state.status !== "conflict" &&
          this.state.status !== "error" &&
          this.state.status !== "offline"
        )
          this.schedule();
      }
    })();
    this.inFlight = operation;
    const result = await operation;
    if (this.dirty() && !this.blocked && drain) return this.flush();
    return result;
  }
  reset(document: T, revision: string) {
    if (this.deleted) throw Error("作品已删除，无法继续保存到原作品");
    if (this.inFlight) throw Error("保存进行中，暂不能替换文档");
    this.generation++;
    this.acknowledged = documentSignature(document);
    this.emit({
      document: structuredClone(document),
      revision,
      status: "saved",
      error: undefined,
    });
    return this.persist();
  }
  restore(document: T, baseRevision: string) {
    if (this.deleted) throw Error("作品已删除，无法继续保存到原作品");
    if (this.inFlight) throw Error("保存进行中");
    this.generation++;
    this.editedAt = Date.now();
    const conflict = baseRevision !== this.state.revision;
    this.emit({
      document: structuredClone(document),
      revision: baseRevision,
      status: conflict ? "conflict" : this.blocked ? "blocked" : "dirty",
    });
    if (this.state.status !== "conflict") this.schedule();
    return this.persist();
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
    return this.persistence.catch(() => {});
  }
}
