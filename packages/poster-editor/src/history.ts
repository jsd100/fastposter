const clone = <T>(value: T): T => structuredClone(value);
export class DocumentHistory<T> {
  private current: T;
  private past: T[] = [];
  private future: T[] = [];
  private pending: T | undefined;
  private active = false;
  /**
   * Identity of the transaction that opened `pending`. A bare `begin()` /
   * `update()` leaves it undefined; the edit session passes its handle so a
   * late timer or blur can only finish the transaction it actually owns.
   */
  private token: unknown;
  constructor(
    initial: T,
    private limit = 100,
  ) {
    this.current = clone(initial);
  }
  get value() {
    return this.current;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  /** Number of committed transactions, used to mark an input session's start. */
  get depth() {
    return this.past.length;
  }
  get inTransaction() {
    return this.active;
  }
  /**
   * Roll back every transaction committed after `depth`, restoring the
   * document to the start of an input session. An Escape cancels the session:
   * nothing is added to the undo stack and no redo entry survives, so the
   * cancellation cannot be undone back into the value just typed.
   */
  rollbackTo(depth: number) {
    this.commit();
    while (this.past.length > depth) this.current = this.past.pop() as T;
    this.future = [];
  }
  begin(token?: unknown) {
    if (!this.active) {
      this.pending = clone(this.current);
      this.active = true;
      this.token = token;
    }
  }
  /** True only while `token` is still the identity of the open transaction. */
  matches(token: unknown) {
    return this.active && this.token === token;
  }
  update(value: T) {
    if (!this.active) this.begin();
    this.current = clone(value);
  }
  commit() {
    if (!this.active) return;
    const previous = this.pending as T;
    if (JSON.stringify(previous) !== JSON.stringify(this.current)) {
      this.past.push(previous);
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
    }
    this.active = false;
    this.pending = undefined;
    this.token = undefined;
  }
  cancel() {
    if (this.active) {
      this.current = this.pending as T;
      this.pending = undefined;
      this.active = false;
      this.token = undefined;
    }
    return this.current;
  }
  undo() {
    this.commit();
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.current);
      this.current = previous;
    }
    return this.current;
  }
  redo() {
    this.commit();
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }
  reset(value: T) {
    this.current = clone(value);
    this.past = [];
    this.future = [];
    this.pending = undefined;
    this.active = false;
    this.token = undefined;
  }
}
