import type {
  FontRef,
  PosterDocument,
  TextBlock,
} from "@fastposter/poster-schema";
import { DocumentHistory } from "./history";
import type { ViewTransform } from "./geometry";
export type EditorMode = "select" | "edit";
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
    addText: (fonts: FontRef[]) => {
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
      if (!font) return;
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
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "把喜欢的风景，写成自己的故事。" },
              ],
            },
          ],
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
