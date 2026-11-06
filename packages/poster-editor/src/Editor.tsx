import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { RichTextEditor } from "./text/RichTextEditor";
import { TextPanel, type TextPanelProps } from "./panels/TextPanel";
import { EditorInspector, type InspectorGroup } from "./panels/EditorInspector";
import {
  captureSelection,
  restoreSelection,
  applyTextStyle,
  effectiveInlineStyle,
  firstTargetStyle,
  type FontTarget,
  type InlineStylePatch,
} from "./text/selection";
import type { PreparedFontChange } from "./fonts/prepare-change";
import { useFontChoice } from "./fonts/useFontChoice";
import {
  BottomSheet,
  Button,
  Dialog,
  NumberField,
  Tooltip,
  useErrorNotice,
} from "@fastposter/ui";
import type {
  InlineStyle,
  PosterDocument,
  RichMark,
  RichNode,
  TextBlock,
} from "@fastposter/poster-schema";
import { shouldIgnoreEditorShortcut } from "./keyboard";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileText,
  Image,
  Layers,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { createEditorStore, type EditorStore } from "./store";
import { Stage } from "./Stage";
import {
  clamp,
  replaceBackground,
  type BackgroundAsset,
  type Rect,
  type ViewTransform,
} from "./geometry";
import type { FontSource } from "@fastposter/poster-renderer";
import "./styles.css";
export type EditorProps = {
  document: PosterDocument;
  onChange: (doc: PosterDocument) => void;
  checkFonts: (candidate: PosterDocument) => Promise<void>;
  fontCheckScope: string;
  availableFonts?: FontSource[];
  onAssetRequest?: () => Promise<BackgroundAsset | undefined>;
  onBackgroundLibraryRequest?: () => Promise<BackgroundAsset | undefined>;
  onCopyRequest?: () => Promise<string | undefined>;
  onOverflowChange?: (overflow: boolean) => void;
  onInteractionChange?: (busy: boolean) => void;
  renderEditing?: (block: TextBlock, store: EditorStore) => ReactNode;
};
export function Editor({
  document,
  onChange,
  checkFonts,
  fontCheckScope,
  availableFonts = [],
  onAssetRequest,
  onBackgroundLibraryRequest,
  onCopyRequest,
  onOverflowChange,
  onInteractionChange,
  renderEditing,
}: EditorProps) {
  const textSelection = useRef<{ from: number; to: number } | null>(null);
  const [activeEditor, setActiveEditor] = useState<TiptapEditor | null>(null);
  const [, selectionChanged] = useState(0);
  const layout = useEditorLayout();
  const [layersOpen, setLayersOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [layerDrawer, setLayerDrawer] = useState(false);
  const [inspectorDrawer, setInspectorDrawer] = useState(false);
  const [group, setGroup] = useState<InspectorGroup>("text");
  const [sheet, setSheet] = useState<
    "inspector" | "layers" | "background" | null
  >(null);
  const [visibleViewport, setVisibleViewport] = useState<Rect | null>(null);
  const manualView = useRef<{
    view: ViewTransform;
    canvas: string;
  } | null>(null);
  function canvasSize() {
    const c = store.getState().document.canvas;
    return `${c.width}x${c.height}`;
  }
  /** The phone inspector owns a temporary, pure view adjustment. */
  function openInspectorSheet() {
    manualView.current = {
      view: store.getState().view,
      canvas: canvasSize(),
    };
    setSheet("inspector");
  }
  function closeSheet() {
    setSheet(null);
    // Clear the band in the same batch as the view restore, so the stage sees
    // no visibleViewport on this commit and cannot re-adjust the manual view.
    setVisibleViewport(null);
    const saved = manualView.current;
    manualView.current = null;
    // A resized canvas already re-fitted to the new size; keep that adaptation
    // instead of restoring a view measured against the old dimensions.
    if (saved && saved.canvas === canvasSize()) store.setView(saved.view);
  }
  useLayoutEffect(() => {
    if (layout !== "phone" || sheet !== "inspector") {
      setVisibleViewport(null);
      return;
    }
    const stage = window.document.querySelector<HTMLElement>(
      "[data-editor-stage]",
    );
    if (!stage) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const panel = window.document.querySelector<HTMLElement>(
        "[data-fp-overlay].bottom-sheet",
      );
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const panelTop = panel ? panel.getBoundingClientRect().top : vh;
      // The drawer already carries the safe-area inset and the visual viewport
      // reflects the on-screen keyboard; their intersection with the stage is
      // the band a phone user can still see and operate on.
      const bottom = Math.min(panelTop, vh, s.bottom);
      const height = clamp(bottom - s.top, 0, s.height);
      setVisibleViewport((prev) =>
        prev && prev.width === s.width && prev.height === height
          ? prev
          : { x: 0, y: 0, width: s.width, height },
      );
    };
    measure();
    // The drawer animates into place: re-measure on its size changes and once
    // after the enter transition, so a 0x0 first frame cannot win.
    const panel = window.document.querySelector<HTMLElement>(
      "[data-fp-overlay].bottom-sheet",
    );
    const observer = panel ? new ResizeObserver(measure) : null;
    if (panel) observer?.observe(panel);
    const timer = window.setTimeout(measure, 300);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      vv?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
    };
  }, [layout, sheet]);
  useEffect(() => {
    setSheet(null);
    setLayerDrawer(false);
    setInspectorDrawer(false);
    // A breakpoint change re-fits the stage to the new size; drop the stale
    // manual view rather than restoring it on top of that adaptation.
    manualView.current = null;
    setVisibleViewport(null);
  }, [layout]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      window.document.documentElement.style.setProperty(
        "--editor-viewport-height",
        `${viewport.height}px`,
      );
    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      window.document.documentElement.style.removeProperty(
        "--editor-viewport-height",
      );
    };
  }, []);
  const callback = useRef(onChange);
  callback.current = onChange;
  const emitted = useRef(document);
  const storeRef = useRef<EditorStore | null>(null);
  if (!storeRef.current)
    storeRef.current = createEditorStore(document, (doc) => {
      emitted.current = doc;
      callback.current(doc);
    });
  const store = storeRef.current;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const selected = state.document.textBlocks.find(
    (b) => b.id === state.selectedId,
  );
  /**
   * Raw number strings belong to the editor session, not to a mounted field.
   * A breakpoint swap or a property-tab change unmounts the inputs, so the
   * owner keeps each draft per session, block and field until the user
   * commits or leaves that field.
   */
  const drafts = useRef(new Map<string, string>());
  const draftSession = useRef(0);
  const priorScope = useRef(fontCheckScope);
  function clearDrafts() {
    draftSession.current += 1;
    drafts.current.clear();
  }
  function draft(blockId: string, field: string) {
    const key = `${draftSession.current}:${blockId}:${field}`;
    return {
      initialDraft: drafts.current.get(key),
      onDraftChange: (value: string | null) => {
        if (value === null) drafts.current.delete(key);
        else drafts.current.set(key, value);
      },
    };
  }
  const [pending, setPending] = useState<BackgroundAsset | null>(null),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false),
    [copyBusy, setCopyBusy] = useState(false);
  useErrorNotice("editor:operation", error || null);
  const fontChoice = useFontChoice({
    scope: fontCheckScope,
    fonts: availableFonts,
    checkFonts,
    snapshot: () => {
      const current = store.getState();
      const block = current.document.textBlocks.find(
        (candidate) => candidate.id === current.selectedId,
      );
      const target = block ? fontTarget(block.id) : null;
      let cursorStyle: InlineStyle | undefined;
      if (
        block &&
        target?.target.kind === "cursor" &&
        activeEditor &&
        !activeEditor.isDestroyed
      ) {
        const marks =
          activeEditor.state.storedMarks ??
          activeEditor.state.selection.$from.marks();
        cursorStyle = effectiveInlineStyle(marks, block.defaultStyle);
      }
      return {
        document: current.document,
        target,
        scope: fontCheckScope,
        cursorStyle,
      };
    },
    apply: applyPreparedFontChange,
  });
  useErrorNotice(
    "editor:font",
    fontChoice.error?.message ?? null,
    fontChoice.error?.action
      ? {
          action: {
            label: fontChoice.error.action.label,
            onClick: () => fontChoice.error?.action?.run(),
          },
        }
      : undefined,
  );
  useEffect(() => {
    if (document !== emitted.current) {
      emitted.current = document;
      clearDrafts();
      store.reset(document);
    }
  }, [document, store]);
  useEffect(() => {
    if (priorScope.current === fontCheckScope) return;
    priorScope.current = fontCheckScope;
    clearDrafts();
  }, [fontCheckScope]);
  useEffect(
    () => onInteractionChange?.(state.inTransaction),
    [state.inTransaction, onInteractionChange],
  );
  useEffect(
    () => onOverflowChange?.(state.overflow),
    [state.overflow, onOverflowChange],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      // A sheet or dialog already handled this Escape for its own layer.
      if (e.defaultPrevented) return;
      if (shouldIgnoreEditorShortcut(e) || store.getState().mode === "edit")
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        store.cancel();
        store.select(null);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [store]);
  async function background(request = onAssetRequest) {
    if (!request || uploading) return;
    setUploading(true);
    setError("");
    try {
      const asset = await request();
      if (asset) {
        if (
          asset.width !== state.document.canvas.width ||
          asset.height !== state.document.canvas.height
        )
          setPending(asset);
        else store.transact((d) => replaceBackground(d, asset));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setUploading(false);
    }
  }
  async function insertCopy() {
    if (!onCopyRequest || copyBusy) return;
    setCopyBusy(true);
    setError("");
    try {
      const text = (await onCopyRequest())?.trim();
      if (!text) return;
      const block = state.document.textBlocks.find(
        (b) => b.id === state.selectedId,
      );
      if (
        state.mode === "edit" &&
        activeEditor &&
        !activeEditor.isDestroyed &&
        block
      ) {
        const selection =
          textSelection.current ?? captureSelection(activeEditor);
        const max = activeEditor.state.doc.content.size;
        const from = Math.max(0, Math.min(max, selection.from));
        const to = Math.max(from, Math.min(max, selection.to));
        if (to > from) {
          const marks = marksAt(activeEditor.state.doc, block, from, to);
          store.begin();
          try {
            activeEditor
              .chain()
              .focus()
              .insertContentAt({ from, to }, copyContent(text, marks))
              .run();
            store.commit();
          } catch (e) {
            store.cancel();
            throw e;
          }
          return;
        }
      }
      if (state.document.textBlocks.length >= 100) {
        setError("文字块数量已达上限");
        return;
      }
      store.addText(availableFonts, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "插入文案失败");
    } finally {
      setCopyBusy(false);
    }
  }
  function fontTarget(blockId: string): FontTarget {
    if (state.mode === "edit" && activeEditor && !activeEditor.isDestroyed) {
      const snapshot = textSelection.current ?? captureSelection(activeEditor);
      return {
        blockId,
        target:
          snapshot.from !== snapshot.to
            ? { kind: "range", from: snapshot.from, to: snapshot.to }
            : { kind: "cursor", from: snapshot.from, to: snapshot.to },
      };
    }
    return { blockId, target: { kind: "block", from: 0, to: 0 } };
  }
  const numericInteraction = useRef(false);
  function beginNumericInteraction() {
    if (numericInteraction.current) return;
    store.commit();
    store.begin();
    numericInteraction.current = true;
  }
  function endNumericInteraction() {
    if (!numericInteraction.current) return;
    numericInteraction.current = false;
    store.commit();
    selectionChanged((v) => v + 1);
  }
  function applyPreparedFontChange(change: PreparedFontChange) {
    const editor = activeEditor;
    if (state.mode === "edit" && editor && !editor.isDestroyed) {
      const block = change.nextDocument.textBlocks.find(
        (b) => b.id === change.target.blockId,
      );
      if (!block) return;
      const snapshot = textSelection.current ?? captureSelection(editor);
      store.commit();
      store.begin();
      try {
        if (change.target.target.kind === "cursor") {
          if (change.removeItalic) editor.commands.unsetItalic();
          if (change.removeBold) editor.commands.unsetBold();
          editor.commands.setMark("textStyle", change.insertionStyle);
        } else {
          editor.commands.setContent(block.content, { emitUpdate: false });
          restoreSelection(editor, snapshot);
        }
        store.update(change.nextDocument);
        store.commit();
        selectionChanged((v) => v + 1);
      } catch (e) {
        store.cancel();
        throw e;
      }
    } else store.transact(() => change.nextDocument);
  }
  function apply(patch: InlineStylePatch) {
    if (!selected) return;
    if (patch.fontId) {
      const chosen = availableFonts.find((f) => f.assetId === patch.fontId);
      if (chosen) void fontChoice.choose(chosen);
      return;
    }
    if (state.mode === "edit" && activeEditor && !activeEditor.isDestroyed) {
      if (!numericInteraction.current) {
        store.commit();
        store.begin();
      }
      if (textSelection.current)
        restoreSelection(activeEditor, textSelection.current);
      if (patch.fontWeight !== undefined) activeEditor.commands.unsetBold();
      activeEditor.commands.setMark("textStyle", patch);
      if (!numericInteraction.current) store.commit();
      selectionChanged((v) => v + 1);
    } else if (numericInteraction.current) {
      store.updateBlock(selected.id, (b) => ({
        ...b,
        defaultStyle: { ...b.defaultStyle, ...patch },
        content: applyTextStyle(
          b.content,
          { kind: "block", from: 0, to: 0 },
          patch,
        ),
      }));
    } else {
      store.transact((d) => ({
        ...d,
        textBlocks: d.textBlocks.map((b) =>
          b.id === selected.id
            ? {
                ...b,
                defaultStyle: { ...b.defaultStyle, ...patch },
                content: applyTextStyle(
                  b.content,
                  { kind: "block", from: 0, to: 0 },
                  patch,
                ),
              }
            : b,
        ),
      }));
    }
  }
  function updateSelected(change: (block: TextBlock) => TextBlock) {
    if (!selected) return;
    if (numericInteraction.current) {
      store.updateBlock(selected.id, change);
      return;
    }
    store.commit();
    store.transact((d) => ({
      ...d,
      textBlocks: d.textBlocks.map((b) =>
        b.id === selected.id ? change(b) : b,
      ),
    }));
  }
  function deleteSelected() {
    const id = state.selectedId;
    if (id)
      for (const key of Array.from(drafts.current.keys()))
        if (key.startsWith(`${draftSession.current}:${id}:`))
          drafts.current.delete(key);
    store.deleteSelected();
  }
  function toggleEdit() {
    store.setMode(state.mode === "edit" ? "select" : "edit");
  }
  function toggleLayers() {
    if (layout === "wide") setLayersOpen((open) => !open);
    else {
      setLayerDrawer((open) => !open);
      setInspectorDrawer(false);
    }
  }
  function toggleInspector() {
    if (layout === "wide") setInspectorOpen((open) => !open);
    else if (layout === "narrow") {
      setInspectorDrawer((open) => !open);
      setLayerDrawer(false);
    }
  }
  const fontsReady = availableFonts.length > 0;
  const atCapacity = state.document.textBlocks.length >= 100;
  /**
   * One availability model for every control that can mutate the document.
   * The desktop toolbar, the phone canvas bar and the phone inspector sheet
   * all read from here, so font readiness, the 100-block limit, the selection
   * and the copy-busy state cannot drift apart between breakpoints (FP-07).
   */
  const operations = {
    addText: {
      disabled: !fontsReady || atCapacity,
      reason: !fontsReady
        ? "字体尚未就绪"
        : atCapacity
          ? "文字块数量已达上限"
          : "",
      run: () => store.addText(availableFonts),
    },
    copyText: {
      disabled: !fontsReady || copyBusy,
      reason: copyBusy ? "正在插入文案" : !fontsReady ? "字体尚未就绪" : "",
      busy: copyBusy,
      run: () => void insertCopy(),
    },
    duplicate: {
      disabled: !selected || atCapacity,
      reason: !selected
        ? "请先选择文字块"
        : atCapacity
          ? "文字块数量已达上限"
          : "",
      run: store.duplicateSelected,
    },
    delete: {
      disabled: !selected,
      reason: "请先选择文字块",
      run: deleteSelected,
    },
    undo: {
      disabled: !state.canUndo,
      reason: state.canUndo ? "" : "没有可撤销的操作",
      run: store.undo,
    },
    redo: {
      disabled: !state.canRedo,
      reason: state.canRedo ? "" : "没有可重做的操作",
      run: store.redo,
    },
    background: {
      disabled: uploading,
      reason: uploading ? "正在导入背景" : "",
    },
  };
  const textPanel: TextPanelProps | null = selected
    ? {
        block: selected,
        editor: state.mode === "edit" ? activeEditor : null,
        fonts: availableFonts,
        apply,
        chooseFont: (face, intent) => void fontChoice.choose(face, intent),
        fontPending: fontChoice.pending,
        sizeBase: firstTargetStyle(state.document, fontTarget(selected.id))
          .fontSize,
        onNumericStart: beginNumericInteraction,
        onNumericEnd: endNumericInteraction,
        update: updateSelected,
        draft: (field) => draft(selected.id, field),
        editing: state.mode === "edit",
        onToggleEdit: toggleEdit,
      }
    : null;
  const selectionActions = selected ? (
    <div className="selection-actions">
      <Tooltip label={operations.duplicate.reason || "复制文字块"}>
        <Button
          aria-label="复制文字块"
          disabled={operations.duplicate.disabled}
          onClick={operations.duplicate.run}
        >
          <Copy size={15} />
        </Button>
      </Tooltip>
      <Tooltip label="文字块前移一层">
        <Button
          aria-label="文字块前移一层"
          onClick={() => store.reorderSelected(1)}
        >
          <ArrowUp size={15} />
        </Button>
      </Tooltip>
      <Tooltip label="文字块后移一层">
        <Button
          aria-label="文字块后移一层"
          onClick={() => store.reorderSelected(-1)}
        >
          <ArrowDown size={15} />
        </Button>
      </Tooltip>
      <Tooltip label={operations.delete.reason || "删除文字块"}>
        <Button
          aria-label="删除文字块"
          disabled={operations.delete.disabled}
          onClick={operations.delete.run}
        >
          <Trash2 size={15} />
        </Button>
      </Tooltip>
    </div>
  ) : null;
  const position = selected ? (
    <div className="geometry-fields">
      {(["x", "y", "width"] as const).map((field) => (
        <label key={field}>
          {field === "width" ? "宽度" : field.toUpperCase()}
          <NumberField
            aria-label={
              field === "width"
                ? "文本框宽度"
                : `文字位置 ${field.toUpperCase()}`
            }
            value={Math.round(selected[field] * 100) / 100}
            min={field === "width" ? selected.effects.padding * 2 + 1 : 0}
            max={
              field === "width"
                ? state.document.canvas.width - selected.x
                : field === "x"
                  ? state.document.canvas.width - selected.width
                  : state.document.canvas.height - 0.001
            }
            step={1}
            {...draft(selected.id, `position-${field}`)}
            onValueChange={(n) => {
              store.transact((d) => ({
                ...d,
                textBlocks: d.textBlocks.map((b) =>
                  b.id === selected.id ? { ...b, [field]: n } : b,
                ),
              }));
            }}
          />
          <small>px</small>
        </label>
      ))}
      <p className="property-hint">调宽只改变自动换行，字号保持不变。</p>
    </div>
  ) : null;
  const scopeLabel = selected
    ? plainText(selected.content).replace(/\s+/g, " ").trim().slice(0, 18) ||
      "文字块"
    : "";
  function layerList() {
    return (
      <div className="layer-list">
        {[...state.document.textBlocks]
          .sort((a, b) => b.zIndex - a.zIndex)
          .map((b, index) => (
            <button
              className={
                b.id === state.selectedId ? "layer-item selected" : "layer-item"
              }
              key={b.id}
              aria-pressed={b.id === state.selectedId}
              onClick={() => store.select(b.id)}
            >
              <Type size={15} />
              <span>{plainText(b.content) || `文字 ${index + 1}`}</span>
            </button>
          ))}
        <div className="background-layer">
          <Image size={15} />
          背景图<span>锁定</span>
        </div>
        <p className="layer-tip">
          拖动文字移动位置
          <br />
          拖动两侧把手调整宽度
        </p>
      </div>
    );
  }
  const showLayers =
    layout === "wide"
      ? layersOpen
      : layout === "medium" || layout === "narrow"
        ? layerDrawer
        : false;
  const showInspector =
    layout === "wide"
      ? inspectorOpen
      : layout === "medium"
        ? true
        : layout === "narrow"
          ? inspectorDrawer
          : false;
  const bodyClass = [
    "editor-body",
    layout === "wide" && !layersOpen ? "layers-closed" : "",
    layout === "wide" && !inspectorOpen ? "inspector-closed" : "",
    layout !== "wide" && layerDrawer ? "layer-drawer" : "",
    layout === "narrow" && inspectorDrawer ? "inspector-drawer" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="poster-editor">
      {layout !== "phone" && (
        <div className="editor-toolbar">
          <div className="toolbar-tools">
            <Tooltip label="切换图层">
              <Button
                aria-label="切换图层"
                aria-expanded={showLayers}
                onClick={toggleLayers}
              >
                <PanelLeft size={16} />
              </Button>
            </Tooltip>
            <span className="toolbar-divider" aria-hidden="true" />
            <Button
              variant="primary"
              disabled={operations.addText.disabled}
              title={operations.addText.reason || undefined}
              onClick={operations.addText.run}
            >
              <Plus size={15} />
              添加文字
            </Button>
            <Button
              aria-label="更换背景"
              disabled={!onAssetRequest || operations.background.disabled}
              busy={uploading}
              onClick={() => void background()}
            >
              <Image size={15} />
              背景
            </Button>
            {onCopyRequest && (
              <Button
                disabled={operations.copyText.disabled}
                title={operations.copyText.reason || undefined}
                busy={operations.copyText.busy}
                onClick={operations.copyText.run}
              >
                <FileText size={15} />
                文案
              </Button>
            )}
            {onBackgroundLibraryRequest && (
              <Button
                disabled={operations.background.disabled}
                onClick={() => void background(onBackgroundLibraryRequest)}
              >
                背景库
              </Button>
            )}
          </div>
          <div className="toolbar-tools">
            <Tooltip label={operations.undo.reason || "撤销 Ctrl/⌘ Z"}>
              <Button
                aria-label="撤销"
                aria-keyshortcuts="Control+Z Meta+Z"
                disabled={operations.undo.disabled}
                onClick={operations.undo.run}
              >
                <Undo2 size={16} />
              </Button>
            </Tooltip>
            <Tooltip label={operations.redo.reason || "重做 Ctrl/⌘ Y"}>
              <Button
                aria-label="重做"
                aria-keyshortcuts="Control+Y Meta+Y"
                disabled={operations.redo.disabled}
                onClick={operations.redo.run}
              >
                <Redo2 size={16} />
              </Button>
            </Tooltip>
            {(layout === "wide" || layout === "narrow") && (
              <Tooltip label="切换文字设置">
                <Button
                  aria-label="切换文字设置"
                  aria-expanded={showInspector}
                  onClick={toggleInspector}
                >
                  <PanelRight size={16} />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {state.overflow && (
        <div className="overflow-notice" role="alert">
          文字超出画布，请调宽文本框、减小字号或调整位置后导出。正文已保留。
        </div>
      )}
      <div className={bodyClass}>
        {showLayers && (
          <aside className="editor-layers" aria-label="图层">
            <div className="panel-head">
              <h2>
                <Layers size={15} />
                图层<span>{state.document.textBlocks.length}</span>
              </h2>
              <Tooltip label={layout === "wide" ? "收起图层" : "关闭图层"}>
                <Button
                  aria-label={layout === "wide" ? "收起图层" : "关闭图层"}
                  onClick={() =>
                    layout === "wide"
                      ? setLayersOpen(false)
                      : setLayerDrawer(false)
                  }
                >
                  <PanelLeft size={16} />
                </Button>
              </Tooltip>
            </div>
            {layerList()}
          </aside>
        )}
        <Stage
          store={store}
          state={state}
          visibleViewport={visibleViewport}
          renderEditing={
            renderEditing
              ? (b) => renderEditing(b, store)
              : (b) => (
                  <RichTextEditor
                    block={b}
                    store={store}
                    fonts={availableFonts}
                    onReady={(editor) => {
                      setActiveEditor(editor);
                      textSelection.current = editor
                        ? captureSelection(editor)
                        : null;
                    }}
                    onSelection={(selection) => {
                      if (selection) textSelection.current = selection;
                      else if (activeEditor?.isFocused)
                        textSelection.current = captureSelection(activeEditor);
                      selectionChanged((v) => v + 1);
                    }}
                  />
                )
          }
        />
        {showInspector && (
          <aside className="editor-properties" aria-label="文字设置">
            <div className="panel-head">
              <h2>文字设置</h2>
              {layout === "wide" ? (
                <Tooltip label="收起文字设置">
                  <Button
                    aria-label="收起文字设置"
                    onClick={() => setInspectorOpen(false)}
                  >
                    <PanelRight size={16} />
                  </Button>
                </Tooltip>
              ) : layout === "narrow" ? (
                <Tooltip label="关闭文字设置">
                  <Button
                    aria-label="关闭文字设置"
                    onClick={() => setInspectorDrawer(false)}
                  >
                    <X size={16} />
                  </Button>
                </Tooltip>
              ) : null}
            </div>
            <EditorInspector
              group={group}
              onGroupChange={setGroup}
              textPanel={textPanel}
              position={position}
              onAddText={operations.addText.run}
              addDisabled={operations.addText.disabled}
              addDisabledReason={operations.addText.reason}
              scopeLabel={scopeLabel}
              actions={selectionActions}
            />
          </aside>
        )}
      </div>
      {layout === "phone" && (
        <div className="mobile-block-actions">
          {selected && (
            <>
              <Button onClick={toggleEdit}>
                {state.mode === "edit" ? "完成文字编辑" : "编辑文字"}
              </Button>
              <Button
                aria-label="复制文字块"
                disabled={operations.duplicate.disabled}
                onClick={operations.duplicate.run}
              >
                <Copy size={16} />
              </Button>
              <Button
                aria-label="删除文字块"
                disabled={operations.delete.disabled}
                onClick={operations.delete.run}
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
        </div>
      )}
      {layout === "phone" && (
        <nav className="mobile-nav" aria-label="编辑工具">
          {/* Named, 44px-target history controls share the desktop callbacks
              and disabled reasons; they stay visible without a selection. */}
          <button
            type="button"
            className="mobile-nav-item"
            aria-label="撤销"
            title={operations.undo.reason || "撤销"}
            disabled={operations.undo.disabled}
            onClick={operations.undo.run}
          >
            <Undo2 size={18} />
            <span>撤销</span>
          </button>
          <button
            type="button"
            className="mobile-nav-item"
            aria-label="重做"
            title={operations.redo.reason || "重做"}
            disabled={operations.redo.disabled}
            onClick={operations.redo.run}
          >
            <Redo2 size={18} />
            <span>重做</span>
          </button>
          <button
            type="button"
            className="mobile-nav-item"
            aria-label="文字设置"
            onClick={openInspectorSheet}
          >
            <Type size={18} />
            <span>文字</span>
          </button>
          <button
            type="button"
            className="mobile-nav-item"
            aria-label="更换背景"
            data-fp-background-entry=""
            disabled={!onAssetRequest || operations.background.disabled}
            onClick={() => setSheet("background")}
          >
            <Image size={18} />
            <span>背景</span>
          </button>
          {onCopyRequest && (
            <button
              type="button"
              className="mobile-nav-item"
              aria-label="文案"
              title={operations.copyText.reason || undefined}
              disabled={operations.copyText.disabled}
              onClick={operations.copyText.run}
            >
              <FileText size={18} />
              <span>文案</span>
            </button>
          )}
          <button
            type="button"
            className="mobile-nav-item"
            aria-label="图层"
            onClick={() => setSheet("layers")}
          >
            <Layers size={18} />
            <span>图层</span>
          </button>
        </nav>
      )}
      {layout === "phone" && sheet === "inspector" && (
        <BottomSheet title="文字设置" onClose={closeSheet}>
          <EditorInspector
            group={group}
            onGroupChange={setGroup}
            textPanel={textPanel}
            position={position}
            onAddText={operations.addText.run}
            addDisabled={operations.addText.disabled}
            addDisabledReason={operations.addText.reason}
            showAdd
            scopeLabel={scopeLabel}
            actions={selectionActions}
          />
        </BottomSheet>
      )}
      {layout === "phone" && sheet === "layers" && (
        <BottomSheet title="图层" onClose={() => setSheet(null)}>
          {layerList()}
        </BottomSheet>
      )}
      {layout === "phone" && sheet === "background" && (
        <BottomSheet title="更换背景" onClose={() => setSheet(null)}>
          <div className="background-sheet-choices">
            <Button
              onClick={() => {
                setSheet(null);
                void background();
              }}
            >
              上传图片
            </Button>
            {onBackgroundLibraryRequest && (
              <Button
                onClick={() => {
                  setSheet(null);
                  void background(onBackgroundLibraryRequest);
                }}
              >
                从背景库选择
              </Button>
            )}
          </div>
        </BottomSheet>
      )}
      {pending && (
        <Dialog title="更换不同尺寸的背景" onClose={() => setPending(null)}>
          <p>
            画布将改为 {pending.width} × {pending.height}{" "}
            像素。文字位置和文本框宽度按画布比例调整，字号保持不变。可通过撤销恢复。
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setPending(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                store.transact((d) => replaceBackground(d, pending));
                setPending(null);
              }}
            >
              更换背景
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
type EditorLayout = "wide" | "medium" | "narrow" | "phone";
/**
 * Three docked columns need 1200px before the canvas drops under 600px. Two
 * columns fit a 278px inspector down to 881px; below that the side panels
 * become temporary overlays, and at phone width the canvas owns the screen.
 */
function readLayout(width: number): EditorLayout {
  if (width >= 1200) return "wide";
  if (width >= 881) return "medium";
  if (width >= 681) return "narrow";
  return "phone";
}
function useEditorLayout(): EditorLayout {
  const [layout, setLayout] = useState<EditorLayout>(() =>
    readLayout(window.innerWidth),
  );
  useEffect(() => {
    const query = (min: number) => window.matchMedia(`(min-width: ${min}px)`);
    const queries = [query(1200), query(881), query(681)];
    const update = () => setLayout(readLayout(window.innerWidth));
    for (const q of queries) q.addEventListener("change", update);
    return () => {
      for (const q of queries) q.removeEventListener("change", update);
    };
  }, []);
  return layout;
}
function plainText(node: TextBlock["content"]): string {
  return node.text ?? node.content?.map(plainText).join("") ?? "";
}
function marksAt(
  doc: TiptapEditor["state"]["doc"],
  block: TextBlock,
  from: number,
  to: number,
): RichMark[] {
  const style = { ...block.defaultStyle };
  const extra: RichMark[] = [];
  let captured = false;
  doc.nodesBetween(from, to, (node) => {
    if (captured || !node.isText) return;
    captured = true;
    const textStyle = node.marks.find((m) => m.type.name === "textStyle");
    const attrs = textStyle?.attrs as Partial<typeof style> | undefined;
    if (attrs?.fontId) style.fontId = attrs.fontId;
    if (attrs?.fontSize) style.fontSize = attrs.fontSize;
    if (attrs?.color) style.color = attrs.color;
    if (attrs?.fontWeight) style.fontWeight = attrs.fontWeight;
    for (const mark of node.marks)
      if (mark.type.name !== "textStyle")
        extra.push({ type: mark.type.name as RichMark["type"] });
  });
  return [{ type: "textStyle", attrs: style }, ...extra];
}
function copyContent(text: string, marks: RichMark[]): RichNode[] {
  const content: RichNode[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (index) content.push({ type: "hardBreak" });
    if (line) content.push({ type: "text", text: line, marks });
  });
  return content;
}
