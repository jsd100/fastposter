import { useState as useReactState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { RichTextEditor } from "./text/RichTextEditor";
import { TextPanel } from "./panels/TextPanel";
import {
  captureSelection,
  restoreSelection,
  applyTextStyle,
  type InlineStylePatch,
} from "./text/selection";
import { BottomSheet } from "@fastposter/ui";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { PosterDocument, TextBlock } from "@fastposter/poster-schema";
import { Button, Dialog, Status } from "@fastposter/ui";
import {
  Plus,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image,
  Layers,
  Type,
} from "lucide-react";
import { createEditorStore, type EditorStore } from "./store";
import { Stage } from "./Stage";
import { replaceBackground, type BackgroundAsset } from "./geometry";
import { RichText, type FontSource } from "@fastposter/poster-renderer";
export type EditorProps = {
  document: PosterDocument;
  onChange: (doc: PosterDocument) => void;
  availableFonts?: FontSource[];
  onAssetRequest?: () => Promise<BackgroundAsset | undefined>;
  onBackgroundLibraryRequest?: () => Promise<BackgroundAsset | undefined>;
  onOverflowChange?: (overflow: boolean) => void;
  onInteractionChange?: (busy: boolean) => void;
  renderEditing?: (block: TextBlock, store: EditorStore) => ReactNode;
};
export function Editor({
  document,
  onChange,
  availableFonts = [],
  onAssetRequest,
  onBackgroundLibraryRequest,
  onOverflowChange,
  onInteractionChange,
  renderEditing,
}: EditorProps) {
  const textSelection = useRef<{ from: number; to: number } | null>(null);
  const [activeEditor, setActiveEditor] = useReactState<TiptapEditor | null>(
    null,
  );
  const [, selectionChanged] = useReactState(0);
  const [mobile, setMobile] = useReactState(
    () => window.matchMedia("(max-width:680px)").matches,
  );
  const [sheet, setSheet] = useReactState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width:680px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
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
  const [pending, setPending] = useState<BackgroundAsset | null>(null),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (document !== emitted.current) {
      emitted.current = document;
      store.reset(document);
    }
  }, [document, store]);
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
      const el = e.target as HTMLElement;
      if (
        el.closest('input,textarea,select,[contenteditable="true"]') ||
        store.getState().mode === "edit"
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        store.deleteSelected();
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
  function apply(patch: InlineStylePatch) {
    if (!selected) return;
    if (patch.fontId) {
      const family = availableFonts.find(
        (f) => f.assetId === patch.fontId,
      )?.family;
      const additions = availableFonts
        .filter(
          (f) =>
            f.family === family &&
            !state.document.fonts.some(
              (existing) => existing.assetId === f.assetId,
            ),
        )
        .map(({ assetId, version, family, weight, style }) => ({
          assetId,
          version,
          family,
          weight,
          style,
        }));
      if (additions.length) {
        if (state.document.fonts.length + additions.length > 100) {
          setError("字体引用已达上限");
          return;
        }
        store.transact((d) => ({ ...d, fonts: [...d.fonts, ...additions] }));
      }
    }
    if (state.mode === "edit" && activeEditor && !activeEditor.isDestroyed) {
      store.commit();
      store.begin();
      if (textSelection.current)
        restoreSelection(activeEditor, textSelection.current);
      if (patch.fontWeight !== undefined) activeEditor.commands.unsetBold();
      activeEditor.commands.setMark("textStyle", patch);
      store.commit();
      selectionChanged((v) => v + 1);
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
  const panel = selected ? (
    <TextPanel
      block={selected}
      editor={state.mode === "edit" ? activeEditor : null}
      fonts={availableFonts}
      apply={apply}
      update={(change) => {
        store.commit();
        store.transact((d) => ({
          ...d,
          textBlocks: d.textBlocks.map((b) =>
            b.id === selected.id ? change(b) : b,
          ),
        }));
      }}
    />
  ) : null;
  return (
    <div className="poster-editor">
      <div className="editor-commandbar">
        <div className="command-group">
          <Button
            variant="primary"
            disabled={
              !availableFonts.length || state.document.textBlocks.length >= 100
            }
            onClick={() => store.addText(availableFonts)}
          >
            <Plus size={15} />
            添加文字
          </Button>
          <Button
            aria-label="更换背景"
            disabled={!onAssetRequest}
            busy={uploading}
            onClick={() => void background()}
          >
            <Image size={15} />
            背景
          </Button>
        </div>
        <div className="command-group">
          {onBackgroundLibraryRequest && (
            <Button
              disabled={uploading}
              onClick={() => void background(onBackgroundLibraryRequest)}
            >
              背景库
            </Button>
          )}
          <Button
            aria-label="撤销"
            title="撤销 Ctrl/⌘ Z"
            disabled={!state.canUndo}
            onClick={store.undo}
          >
            <Undo2 size={16} />
          </Button>
          <Button
            aria-label="重做"
            disabled={!state.canRedo}
            onClick={store.redo}
          >
            <Redo2 size={16} />
          </Button>
        </div>
      </div>
      {error && <Status tone="error">{error}</Status>}
      {state.overflow && (
        <div className="overflow-notice" role="alert">
          文字超出画布，请调宽文本框、减小字号或调整位置后导出。正文已保留。
        </div>
      )}
      <div className="editor-body">
        <aside className="editor-layers">
          <h2>
            <Layers size={15} />
            图层<span>{state.document.textBlocks.length}</span>
          </h2>
          <div className="layer-list">
            {[...state.document.textBlocks]
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((b, index) => (
                <button
                  className={
                    b.id === state.selectedId
                      ? "layer-item selected"
                      : "layer-item"
                  }
                  key={b.id}
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
          </div>
          <p className="layer-tip">
            拖动文字移动位置
            <br />
            拖动两侧把手调整宽度
          </p>
        </aside>
        <Stage
          store={store}
          state={state}
          renderEditing={
            renderEditing
              ? (b) => renderEditing(b, store)
              : (b) => (
                  <RichTextEditor
                    block={b}
                    store={store}
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
        <aside className="editor-properties">
          <h2>文字设置</h2>
          {selected ? (
            <>
              <div className="selection-actions">
                <Button
                  aria-label="复制文字块"
                  onClick={store.duplicateSelected}
                >
                  <Copy size={15} />
                </Button>
                <Button
                  aria-label="文字块前移一层"
                  onClick={() => store.reorderSelected(1)}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  aria-label="文字块后移一层"
                  onClick={() => store.reorderSelected(-1)}
                >
                  <ArrowDown size={15} />
                </Button>
                <Button aria-label="删除文字块" onClick={store.deleteSelected}>
                  <Trash2 size={15} />
                </Button>
              </div>
              {true && (
                <Button
                  onClick={() =>
                    store.setMode(state.mode === "edit" ? "select" : "edit")
                  }
                >
                  {state.mode === "edit" ? "完成文字编辑" : "编辑文字"}
                </Button>
              )}
              {!mobile && panel}
              <h3>位置与大小</h3>
              <div className="geometry-fields">
                {(["x", "y", "width"] as const).map((field) => (
                  <label key={field}>
                    {field === "width" ? "宽度" : field.toUpperCase()}
                    <input
                      type="number"
                      aria-label={
                        field === "width"
                          ? "文本框宽度"
                          : `文字位置 ${field.toUpperCase()}`
                      }
                      value={Math.round(selected[field] * 100) / 100}
                      min={
                        field === "width" ? selected.effects.padding * 2 + 1 : 0
                      }
                      max={
                        field === "width"
                          ? state.document.canvas.width - selected.x
                          : field === "x"
                            ? state.document.canvas.width - selected.width
                            : state.document.canvas.height - 0.001
                      }
                      step="1"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n)) return;
                        const max = Number(e.target.max),
                          min = Number(e.target.min);
                        store.transact((d) => ({
                          ...d,
                          textBlocks: d.textBlocks.map((b) =>
                            b.id === selected.id
                              ? {
                                  ...b,
                                  [field]: Math.max(min, Math.min(max, n)),
                                }
                              : b,
                          ),
                        }));
                      }}
                    />
                    <small>px</small>
                  </label>
                ))}
              </div>
              <p className="property-hint">
                调宽只改变自动换行，字号保持不变。
              </p>
            </>
          ) : (
            <div className="properties-empty">
              <Type size={28} />
              <p>
                选择一个文字块
                <br />
                开始调整排版
              </p>
            </div>
          )}
        </aside>
      </div>
      <div className="mobile-block-actions">
        {selected && (
          <>
            <Button
              onClick={() =>
                store.setMode(state.mode === "edit" ? "select" : "edit")
              }
            >
              {state.mode === "edit" ? "完成文字编辑" : "编辑文字"}
            </Button>
            <Button onClick={() => setSheet(true)}>文字设置</Button>
            <Button aria-label="复制文字块" onClick={store.duplicateSelected}>
              <Copy size={16} />
            </Button>
            <Button aria-label="删除文字块" onClick={store.deleteSelected}>
              <Trash2 size={16} />
            </Button>
          </>
        )}
      </div>
      {mobile && sheet && selected && (
        <BottomSheet title="文字设置" onClose={() => setSheet(false)}>
          {panel}
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
function plainText(node: TextBlock["content"]): string {
  return node.text ?? node.content?.map(plainText).join("") ?? "";
}
