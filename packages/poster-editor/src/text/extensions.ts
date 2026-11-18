import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  fontFamily,
  gradientCSS,
  GRADIENT_RANGE_ATTRIBUTE,
  isGradientColor,
} from "@fastposter/poster-renderer";
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
        // Pasted HTML carries the full gradient; reparsing assigns a fresh
        // rangeId so the pasted range never joins an existing one.
        parseHTML: (el) => {
          const raw = el.getAttribute("data-gradient");
          if (!raw) return null;
          try {
            const gradient = JSON.parse(raw) as Record<string, unknown>;
            if (gradient.type !== "linear" && gradient.type !== "radial")
              return null;
            return {
              ...gradient,
              rangeId: `pasted-${Math.random().toString(36).slice(2, 10)}`,
            };
          } catch {
            return null;
          }
        },
        renderHTML: (attrs) => {
          if (!attrs.color) return {};
          const gradient = isGradientColor(attrs.color) ? attrs.color : null;
          if (!gradient) return { style: `color:${attrs.color}` };
          return {
            [GRADIENT_RANGE_ATTRIBUTE]: gradient.rangeId,
            "data-gradient": JSON.stringify(gradient),
            style: `color:transparent;background-image:${gradientCSS(gradient)};background-clip:text;-webkit-background-clip:text`,
          };
        },
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
