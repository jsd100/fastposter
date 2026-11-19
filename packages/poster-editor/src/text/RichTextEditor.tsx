import { useEffect, useRef } from "react";
import {
  EditorContent,
  useEditor,
  Extension,
  type Editor,
} from "@tiptap/react";
import type { TextBlock } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import type { EditorStore, TransactionHandle } from "../store";
import { preparePastedText, richTextExtensions } from "./extensions";
import { WeightPreview } from "./weight-preview";
import { documentFontSources } from "../fonts/catalog";
import { gradientWritesEnabled } from "../gradient-writes";
import { canApplyFontMark, canonicalRichText } from "./selection";
export function RichTextEditor({
  block,
  store,
  fonts,
  onReady,
  onSelection,
}: {
  block: TextBlock;
  store: EditorStore;
  fonts: FontSource[];
  onReady: (editor: Editor | null) => void;
  onSelection: (selection?: { from: number; to: number }) => void;
}) {
  const refs = useRef({ block, fonts, onReady, onSelection });
  refs.current = { block, fonts, onReady, onSelection };
  const emittedContents = useRef(new WeakSet<object>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    composing = useRef(false);
  // The only transaction this rich-text input is allowed to finish. A stale
  // debounce or blur must never commit a newer, external gesture.
  const ownHandle = useRef<TransactionHandle | null>(null);
  function finishOwn(action: "commit" | "cancel" = "commit") {
    const handle = ownHandle.current;
    ownHandle.current = null;
    if (handle) store.finish(handle, action);
  }
  /**
   * An external control gesture (color/property) already owns the open
   * transaction. The content update is still written, but our debounce must
   * not finalise that transaction early.
   */
  function externalGesture() {
    const owner = store.transactionOwner();
    return owner === "control" || owner === "external";
  }
  function beginOwn(): TransactionHandle {
    const active = store.activeTransaction();
    if (active && active.owner === "richtext") return active;
    return store.acquire("richtext", refs.current.block.id);
  }
  const editor = useEditor(
    {
      extensions: [
        ...richTextExtensions(),
        WeightPreview,
        Extension.create({
          name: "unifiedPosterHistory",
          priority: 1000,
          addKeyboardShortcuts() {
            const toggle = (mark: "bold" | "italic") => {
              const doc = store.getState().document;
              const block = doc.textBlocks.find(
                (candidate) => candidate.id === refs.current.block.id,
              );
              if (!block) return true;
              const referenced = documentFontSources(
                refs.current.fonts,
                doc.fonts,
              ).filter((font) =>
                doc.fonts.some((ref) => ref.assetId === font.assetId),
              );
              if (
                this.editor.isActive(mark) ||
                canApplyFontMark(
                  this.editor.state,
                  block.defaultStyle,
                  referenced,
                  mark,
                )
              )
                this.editor.commands.toggleMark(mark);
              return true;
            };
            return {
              "Mod-b": () => toggle("bold"),
              "Mod-i": () => toggle("italic"),
              "Mod-z": () => {
                store.undo();
                return true;
              },
              "Mod-Shift-z": () => {
                store.redo();
                return true;
              },
              "Mod-y": () => {
                store.redo();
                return true;
              },
            };
          },
        }),
      ],
      content: block.content,
      immediatelyRender: false,
      editorProps: {
        transformPasted: (slice) =>
          preparePastedText(
            slice,
            gradientWritesEnabled(),
            new Set(
              store.getState().document.fonts.map((font) => font.assetId),
            ),
          ),
        attributes: {
          role: "textbox",
          "aria-label": "海报文字编辑",
          "aria-multiline": "true",
          spellcheck: "false",
        },
        handleDOMEvents: {
          compositionstart: () => {
            composing.current = true;
            if (timer.current) clearTimeout(timer.current);
            if (!externalGesture()) {
              // Mirror the baseline commit/begin boundary. Any pending typing
              // whose 650ms debounce has not fired yet must become its own
              // undo step before the composition starts; otherwise the IME
              // text merges into that step and one undo removes both.
              finishOwn("commit");
              ownHandle.current = beginOwn();
            }
            return false;
          },
          compositionend: () => {
            composing.current = false;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => finishOwn("commit"), 50);
            return false;
          },
        },
      },
      onUpdate: ({ editor }) => {
        const content = canonicalRichText(editor.getJSON());
        const external = externalGesture();
        if (external) {
          // An external style/color gesture owns this transaction. Keep the
          // real content in sync but do not end (or schedule ending) it here.
          ownHandle.current = null;
          if (timer.current) clearTimeout(timer.current);
          store.updateBlock(refs.current.block.id, (b) => ({
            ...b,
            content,
          }));
          const emitted = store
            .getState()
            .document.textBlocks.find(
              (b) => b.id === refs.current.block.id,
            )?.content;
          if (emitted) emittedContents.current.add(emitted);
          return;
        }
        ownHandle.current = beginOwn();
        store.updateBlock(refs.current.block.id, (b) => ({
          ...b,
          content,
        }));
        const emitted = store
          .getState()
          .document.textBlocks.find(
            (b) => b.id === refs.current.block.id,
          )?.content;
        if (emitted) emittedContents.current.add(emitted);

        if (timer.current) clearTimeout(timer.current);
        if (!composing.current)
          timer.current = setTimeout(() => finishOwn("commit"), 650);
      },
      onSelectionUpdate: () => refs.current.onSelection(),
      onBlur: ({ editor }) => {
        const selection = window.getSelection(),
          root = editor.view.dom;
        if (
          selection?.anchorNode &&
          selection.focusNode &&
          root.contains(selection.anchorNode) &&
          root.contains(selection.focusNode)
        ) {
          const a = editor.view.posAtDOM(
              selection.anchorNode,
              selection.anchorOffset,
            ),
            b = editor.view.posAtDOM(
              selection.focusNode,
              selection.focusOffset,
            );
          refs.current.onSelection({
            from: Math.min(a, b),
            to: Math.max(a, b),
          });
        }
        // Only our own typing transaction may be finished by this blur.
        if (!composing.current) {
          if (timer.current) clearTimeout(timer.current);
          finishOwn("commit");
        }
      },
    },
    [block.id, store],
  );
  useEffect(() => {
    if (!editor) return;
    refs.current.onReady(editor);
    editor.commands.focus("end");
    return () => {
      if (timer.current) clearTimeout(timer.current);
      finishOwn("commit");
      refs.current.onReady(null);
    };
  }, [editor, store]);
  useEffect(() => {
    if (
      !editor ||
      composing.current ||
      emittedContents.current.has(block.content)
    )
      return;
    const next = canonicalRichText(block.content);
    if (
      JSON.stringify(canonicalRichText(editor.getJSON())) !==
      JSON.stringify(next)
    ) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(next, { emitUpdate: false });
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(from, max),
        to: Math.min(to, max),
      });
    }
  }, [block.content, editor]);
  return <EditorContent editor={editor} className="poster-rich-input" />;
}
