import { useEffect, useRef } from "react";
import {
  EditorContent,
  useEditor,
  Extension,
  type Editor,
} from "@tiptap/react";
import type { TextBlock } from "@fastposter/poster-schema";
import type { EditorStore } from "../store";
import { richTextExtensions } from "./extensions";
import { canonicalRichText } from "./selection";
export function RichTextEditor({
  block,
  store,
  onReady,
  onSelection,
}: {
  block: TextBlock;
  store: EditorStore;
  onReady: (editor: Editor | null) => void;
  onSelection: (selection?: { from: number; to: number }) => void;
}) {
  const refs = useRef({ block, onReady, onSelection });
  refs.current = { block, onReady, onSelection };
  const emittedContents = useRef(new WeakSet<object>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    composing = useRef(false);
  const editor = useEditor(
    {
      extensions: [
        ...richTextExtensions(),
        Extension.create({
          name: "unifiedPosterHistory",
          priority: 1000,
          addKeyboardShortcuts() {
            return {
              "Mod-i": () => {
                const d = store.getState().document,
                  b = d.textBlocks.find((b) => b.id === refs.current.block.id);
                const id =
                  this.editor.getAttributes("textStyle").fontId ??
                  b?.defaultStyle.fontId;
                const family = d.fonts.find((f) => f.assetId === id)?.family;
                if (
                  d.fonts.some(
                    (f) => f.family === family && f.style === "italic",
                  )
                )
                  this.editor.commands.toggleItalic();
                return true;
              },
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
        attributes: {
          role: "textbox",
          "aria-label": "海报文字编辑",
          "aria-multiline": "true",
          spellcheck: "false",
        },
        handleDOMEvents: {
          compositionstart: () => {
            composing.current = true;
            store.commit();
            store.begin();
            if (timer.current) clearTimeout(timer.current);
            return false;
          },
          compositionend: () => {
            composing.current = false;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => store.commit(), 50);
            return false;
          },
        },
      },
      onUpdate: ({ editor }) => {
        store.updateBlock(refs.current.block.id, (b) => ({
          ...b,
          content: canonicalRichText(editor.getJSON()),
        }));
        const emitted = store
          .getState()
          .document.textBlocks.find(
            (b) => b.id === refs.current.block.id,
          )?.content;
        if (emitted) emittedContents.current.add(emitted);

        if (timer.current) clearTimeout(timer.current);
        if (!composing.current)
          timer.current = setTimeout(() => store.commit(), 650);
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
        if (!composing.current) store.commit();
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
      store.commit();
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
