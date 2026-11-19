import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type WeightPreview = { from: number; to: number; weight: number };
const previewKey = new PluginKey<WeightPreview | null>("posterWeightPreview");

export const WeightPreview = Extension.create({
  name: "posterWeightPreview",
  addProseMirrorPlugins() {
    return [
      new Plugin<WeightPreview | null>({
        key: previewKey,
        state: {
          init: () => null,
          apply(transaction, previous) {
            const next = transaction.getMeta(previewKey) as
              WeightPreview | null | undefined;
            if (next !== undefined) return next;
            return transaction.docChanged || transaction.selectionSet
              ? null
              : previous;
          },
        },
        props: {
          decorations(state) {
            const preview = previewKey.getState(state);
            return preview
              ? DecorationSet.create(state.doc, [
                  Decoration.inline(preview.from, preview.to, {
                    "data-font-weight-preview": "",
                    style: `--fp-weight-preview: ${preview.weight}`,
                  }),
                ])
              : null;
          },
        },
      }),
    ];
  },
});

export function previewEditorWeight(
  editor: Editor,
  range: { from: number; to: number } | null,
  weight: number | null,
) {
  if (editor.isDestroyed) return;
  const next =
    range && range.from < range.to && weight !== null
      ? { ...range, weight }
      : null;
  if (!next && !previewKey.getState(editor.state)) return;
  editor.view.dispatch(editor.state.tr.setMeta(previewKey, next));
}
