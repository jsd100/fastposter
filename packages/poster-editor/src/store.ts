import type {
  FontRef,
  PosterDocument,
  TextBlock,
} from "@fastposter/poster-schema";
import type { NumberDraftSnapshot } from "@fastposter/ui";
import { DocumentHistory } from "./history";
import type { ViewTransform } from "./geometry";
export type EditorMode = "select" | "edit";

/**
 * One edit gesture owns exactly one open history transaction. The handle
 * carries the session generation, the edit target and a unique id, so a late
 * callback (an old debounce timer, a stale blur) can never finish a newer
 * transaction or one belonging to another page/account (FP-08).
 */
export type TransactionOwner = "richtext" | "control";
export type TransactionHandle = {
  session: number;
  target: string;
  id: number;
  owner: TransactionOwner;
};

/**
 * A suspended number draft is scoped by work/template, text block, property
 * and edit target, and remembers the transaction that owns its gesture.
 */
export type DraftScope = {
  work: string;
  blockId: string;
  field: string;
  target: string;
};
export type DraftRecord = {
  scope: DraftScope;
  snapshot: NumberDraftSnapshot;
  handle: TransactionHandle | null;
  /** History depth when this input session began, for a scoped cancel. */
  sessionDepth: number;
};
export class NumberDraftSession {
  private records = new Map<string, DraftRecord>();
  private generation = 0;
  private key(scope: DraftScope) {
    return JSON.stringify([
      this.generation,
      scope.work,
      scope.blockId,
      scope.field,
      scope.target,
    ]);
  }
  read(scope: DraftScope): NumberDraftSnapshot | undefined {
    return this.records.get(this.key(scope))?.snapshot;
  }
  handleOf(scope: DraftScope): TransactionHandle | null {
    return this.records.get(this.key(scope))?.handle ?? null;
  }
  depthOf(scope: DraftScope): number | undefined {
    return this.records.get(this.key(scope))?.sessionDepth;
  }
  write(
    scope: DraftScope,
    snapshot: NumberDraftSnapshot,
    handle: TransactionHandle | null,
    sessionDepth = 0,
  ) {
    const existing = this.records.get(this.key(scope));
    this.records.set(this.key(scope), {
      scope,
      snapshot,
      handle,
      // A suspended draft keeps the depth of the session that opened it
      // across remounts; a fresh record adopts the caller's current depth.
      sessionDepth: existing?.sessionDepth ?? sessionDepth,
    });
  }
  clear(scope: DraftScope) {
    this.records.delete(this.key(scope));
  }
  /** Both delete entries clear every draft of the removed block. */
  discardBlock(blockId: string) {
    for (const [key, record] of Array.from(this.records))
      if (record.scope.blockId === blockId) this.records.delete(key);
  }
  /**
   * An active target switch folds the unfinished strings of the block/target
   * being left back to their last valid value, like a deliberate blur. Drafts
   * of other blocks, other fields on another target or another work keep
   * their suspended raw string, so switching selection never discards input
   * the user has not acted on (FP-08 scope contract).
   */
  tidy(scope: Pick<DraftScope, "work" | "blockId" | "target">) {
    for (const [key, record] of Array.from(this.records)) {
      if (
        record.scope.work !== scope.work ||
        record.scope.blockId !== scope.blockId ||
        record.scope.target !== scope.target
      )
        continue;
      const { raw, baseline, lastValid } = record.snapshot;
      const settledRaw = lastValid == null ? "" : String(lastValid);
      if (raw === settledRaw) continue;
      this.records.set(key, {
        ...record,
        snapshot: { raw: settledRaw, baseline, lastValid },
      });
    }
  }
  /** Page / edit target / account invalidation ends the old draft session. */
  invalidate() {
    this.generation += 1;
    this.records.clear();
  }
}
export type EditorState = {
  document: PosterDocument;
  selectedId: string | null;
  mode: EditorMode;
  view: ViewTransform;
  canUndo: boolean;
  canRedo: boolean;
  overflow: boolean;
  inTransaction: boolean;
};
export function createEditorStore(
  initial: PosterDocument,
  onChange?: (doc: PosterDocument) => void,
) {
  const history = new DocumentHistory(initial);
  // The edit session is the only owner of gesture transactions. Handles are
  // matched against both this registry and the history token, so a stale
  // callback can never commit a transaction started after it.
  let sessionGeneration = 0;
  let nextTransactionId = 0;
  let activeHandle: TransactionHandle | null = null;
  const drafts = new NumberDraftSession();
  let state: EditorState = {
    document: history.value,
    selectedId: null,
    mode: "select",
    view: { x: 40, y: 40, scale: 0.5 },
    canUndo: false,
    canRedo: false,
    overflow: false,
    inTransaction: false,
  };
  const listeners = new Set<() => void>();
  function emit(docChanged = false) {
    state = {
      ...state,
      document: history.value,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      inTransaction: history.inTransaction,
    };
    for (const listener of listeners) listener();
    if (docChanged) onChange?.(state.document);
  }
  const store = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    history,
    drafts,
    /**
     * Begin (or continue) one gesture's transaction. A second acquire for the
     * same owner+target merges into the open transaction; a different gesture
     * first finalises the previous one. A bare, token-less transaction is
     * finalised too, so the session always owns the transaction it opens.
     */
    acquire: (owner: TransactionOwner, target: string): TransactionHandle => {
      if (activeHandle && !history.matches(activeHandle)) activeHandle = null;
      if (activeHandle && activeHandle.session === sessionGeneration) {
        if (activeHandle.owner === owner && activeHandle.target === target)
          return activeHandle;
        history.commit();
        activeHandle = null;
      } else if (history.inTransaction) {
        history.commit();
        activeHandle = null;
      }
      const handle: TransactionHandle = {
        session: sessionGeneration,
        owner,
        target,
        id: ++nextTransactionId,
      };
      history.begin(handle);
      activeHandle = handle;
      emit();
      return handle;
    },
    /**
     * Finish only the transaction that still matches this handle. Old
     * timers / blur / closed targets are ignored, and a cancelled gesture
     * reverts the document without adding a history entry.
     */
    finish: (
      handle: TransactionHandle,
      action: "commit" | "cancel",
    ): boolean => {
      if (
        !activeHandle ||
        activeHandle.id !== handle.id ||
        activeHandle.session !== sessionGeneration ||
        !history.matches(handle)
      ) {
        if (activeHandle && !history.matches(activeHandle)) activeHandle = null;
        return false;
      }
      activeHandle = null;
      if (action === "commit") history.commit();
      else history.cancel();
      emit(action === "cancel");
      return true;
    },
    activeTransaction: (): TransactionHandle | null =>
      activeHandle && history.matches(activeHandle) ? activeHandle : null,
    /** "external" marks a bare transaction owned outside the session. */
    transactionOwner: (): TransactionOwner | "external" | null => {
      if (activeHandle && history.matches(activeHandle))
        return activeHandle.owner;
      if (history.inTransaction) return "external";
      return null;
    },
    /** History depth at the start of a bound number input session. */
    historyDepth: () => history.depth,
    /**
     * Cancel a committed bound-number input session. The restore is a
     * transaction rollback of every commit since `depth`, not a fresh write,
     * so Escape adds no undo entry and leaves no redo entry; autosave then
     * persists the restored value through the normal change callback.
     */
    cancelNumberSession: (depth: number) => {
      history.rollbackTo(depth);
      emit(true);
    },
    /** Page / account / remote-deletion invalidation ends the old session. */
    invalidateSession: () => {
      if (activeHandle) {
        history.commit();
        activeHandle = null;
      }
      sessionGeneration += 1;
      drafts.invalidate();
      emit();
    },
    select: (id: string | null, mode: EditorMode = "select") => {
      history.commit();
      state = { ...state, selectedId: id, mode };
      emit();
    },
    setMode: (mode: EditorMode) => {
      history.commit();
      state = { ...state, mode };
      emit();
    },
    setView: (view: ViewTransform) => {
      state = { ...state, view };
      emit();
    },
    setOverflow: (overflow: boolean) => {
      if (state.overflow !== overflow) {
        state = { ...state, overflow };
        emit();
      }
    },
    begin: () => {
      history.begin();
      emit();
    },
    update: (doc: PosterDocument) => {
      history.update(doc);
      emit(true);
    },
    commit: () => {
      history.commit();
      emit();
    },
    cancel: () => {
      history.cancel();
      emit(true);
    },
    transact: (change: (doc: PosterDocument) => PosterDocument) => {
      history.commit();
      history.begin();
      history.update(change(history.value));
      history.commit();
      emit(true);
    },
    updateBlock: (id: string, change: (block: TextBlock) => TextBlock) => {
      history.update({
        ...history.value,
        textBlocks: history.value.textBlocks.map((b) =>
          b.id === id ? change(b) : b,
        ),
      });
      emit(true);
    },
    undo: () => {
      const before = new Set(history.value.textBlocks.map((b) => b.id));
      history.undo();
      const restored = history.value.textBlocks.find((b) => !before.has(b.id));
      if (restored) state = { ...state, selectedId: restored.id };
      state = { ...state, mode: "select" };
      if (!history.value.textBlocks.some((b) => b.id === state.selectedId))
        state = { ...state, selectedId: null };
      emit(true);
    },
    redo: () => {
      history.redo();
      state = { ...state, mode: "select" };
      if (!history.value.textBlocks.some((b) => b.id === state.selectedId))
        state = { ...state, selectedId: null };
      emit(true);
    },
    reset: (doc: PosterDocument) => {
      history.reset(doc);
      state = { ...state, selectedId: null, mode: "select" };
      emit();
    },
    addText: (fonts: FontRef[], text?: string) => {
      const d = history.value,
        font =
          fonts.find(
            (f) =>
              f.family === "Noto Sans SC" &&
              f.weight === 400 &&
              f.style === "normal",
          ) ??
          fonts.find((f) => f.weight === 400 && f.style === "normal") ??
          fonts[0];
      if (!font || d.textBlocks.length >= 100) return;
      const id = crypto.randomUUID();
      const size = Math.max(
        1,
        Math.min(64, Math.round(d.canvas.width * 0.055)),
      );
      const width = Math.min(
        d.canvas.width,
        Math.max(1, d.canvas.width * 0.65),
      );
      const x = (d.canvas.width - width) / 2,
        y = Math.min(d.canvas.height - 1, d.canvas.height * 0.3);
      const lines = (text ?? "把喜欢的风景，写成自己的故事。").split(/\r?\n/);
      const block: TextBlock = {
        id,
        x,
        y,
        width,
        zIndex: d.textBlocks.length,
        defaultStyle: {
          fontId: font.assetId,
          fontSize: size,
          color: "#284632",
          fontWeight: font.weight,
        },
        paragraphStyle: { align: "left", lineHeight: 1.4, letterSpacing: 0 },
        effects: {
          opacity: 1,
          padding: 0,
          backgroundColor: "#00000000",
          strokeWidth: 0,
          strokeColor: "#000000",
          shadowColor: "#00000000",
          shadowBlur: 0,
          shadowX: 0,
          shadowY: 0,
        },
        content: {
          type: "doc",
          content: lines.map((line) => ({
            type: "paragraph",
            content: line ? [{ type: "text", text: line }] : [],
          })),
        },
      };
      store.transact((doc) => ({
        ...doc,
        fonts: [
          ...doc.fonts,
          ...fonts
            .filter(
              (f) =>
                f.family === font.family &&
                !doc.fonts.some((existing) => existing.assetId === f.assetId),
            )
            .map(({ assetId, version, family, weight, style }) => ({
              assetId,
              version,
              family,
              weight,
              style,
            })),
        ],
        textBlocks: [...doc.textBlocks, block],
      }));
      store.select(id);
    },
    deleteSelected: () => {
      if (!state.selectedId) return;
      store.transact((doc) => ({
        ...doc,
        textBlocks: doc.textBlocks.filter((b) => b.id !== state.selectedId),
      }));
      store.select(null);
    },
    duplicateSelected: () => {
      const b = history.value.textBlocks.find((b) => b.id === state.selectedId);
      if (!b || history.value.textBlocks.length >= 100) return;
      const id = crypto.randomUUID();
      store.transact((doc) => ({
        ...doc,
        textBlocks: [
          ...doc.textBlocks,
          {
            ...structuredClone(b),
            id,
            x: Math.min(doc.canvas.width - b.width, b.x + 20),
            y: Math.min(doc.canvas.height - 1, b.y + 20),
            zIndex: doc.textBlocks.length,
          },
        ],
      }));
      store.select(id);
    },
    reorderSelected: (direction: -1 | 1) => {
      store.transact((doc) => {
        const ordered = [...doc.textBlocks].sort((a, b) => a.zIndex - b.zIndex);
        const from = ordered.findIndex((b) => b.id === state.selectedId),
          to = from + direction;
        if (from < 0 || to < 0 || to >= ordered.length) return doc;
        [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
        return {
          ...doc,
          textBlocks: ordered.map((b, zIndex) => ({ ...b, zIndex })),
        };
      });
    },
  };
  return store;
}
export type EditorStore = ReturnType<typeof createEditorStore>;
