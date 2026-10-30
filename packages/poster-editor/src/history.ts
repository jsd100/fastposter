const clone = <T>(value: T): T => structuredClone(value);
export class DocumentHistory<T> {
  private current: T;
  private past: T[] = [];
  private future: T[] = [];
  private pending: T | undefined;
  private active = false;
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
  get inTransaction() {
    return this.active;
  }
  begin() {
    if (!this.active) {
      this.pending = clone(this.current);
      this.active = true;
    }
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
  }
  cancel() {
    if (this.active) {
      this.current = this.pending as T;
      this.pending = undefined;
      this.active = false;
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
  }
}
