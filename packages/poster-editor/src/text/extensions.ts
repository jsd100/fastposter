import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { fontFamily } from "@fastposter/poster-renderer";
export const PosterTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      fontId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-font-id"),
        renderHTML: (attrs) =>
          attrs.fontId
            ? {
                "data-font-id": attrs.fontId,
                style: `font-family:${fontFamily(attrs.fontId)}`,
              }
            : {},
      },
      fontSize: {
        default: null,
        parseHTML: (el) => {
          const value = parseFloat(el.style.fontSize);
          return Number.isFinite(value) && value > 0 && value <= 4096
            ? value
            : null;
        },
        renderHTML: (attrs) =>
          attrs.fontSize ? { style: `font-size:${attrs.fontSize}px` } : {},
      },
      color: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attrs) =>
          attrs.color ? { style: `color:${attrs.color}` } : {},
      },
      fontWeight: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attrs) =>
          attrs.fontWeight ? { style: `font-weight:${attrs.fontWeight}` } : {},
      },
    };
  },
});
export function richTextExtensions() {
  return [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      trailingNode: false,
      undoRedo: false,
    }),
    PosterTextStyle,
  ];
}
