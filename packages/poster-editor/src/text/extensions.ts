import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Fragment, Slice } from "@tiptap/pm/model";
import { parseTextColor } from "@fastposter/poster-schema";
import {
  posterFontFamily,
  GRADIENT_RANGE_ATTRIBUTE,
  gradientValueKey,
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
                style: `font-family:${posterFontFamily(attrs.fontId)}`,
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
        parseHTML: (el) => {
          const raw = el.getAttribute("data-gradient");
          if (!raw) return null;
          try {
            const gradient = parseTextColor(JSON.parse(raw));
            return isGradientColor(gradient) ? gradient : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attrs) => {
          if (!attrs.color) return {};
          const gradient = isGradientColor(attrs.color) ? attrs.color : null;
          if (!gradient)
            return {
              "data-poster-color": "",
              style: `color:${attrs.color};--fp-decoration-color:currentColor`,
            };
          return {
            [GRADIENT_RANGE_ATTRIBUTE]: gradient.rangeId,
            "data-gradient": JSON.stringify(gradient),
            style: `color:transparent;--fp-decoration-color:${gradient.stops[0].color}`,
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

export function preparePastedText(
  slice: Slice,
  allowGradients: boolean,
  fontIds: ReadonlySet<string>,
): Slice {
  const ranges = new Map<string, string>();
  function visit(fragment: Fragment): Fragment {
    const children = [];
    for (let i = 0; i < fragment.childCount; i++) {
      const node = fragment.child(i);
      const marks = node.marks.map((mark) => {
        if (mark.type.name !== "textStyle") return mark;
        const attrs = { ...mark.attrs };
        if (attrs.fontId && !fontIds.has(attrs.fontId)) attrs.fontId = null;
        const color = attrs.color;
        if (!isGradientColor(color)) return mark.type.create(attrs);
        if (!allowGradients) return mark.type.create({ ...attrs, color: null });
        const key = `${color.rangeId}:${gradientValueKey(color)}`;
        let rangeId = ranges.get(key);
        if (!rangeId) {
          rangeId = `pasted-${crypto.randomUUID()}`;
          ranges.set(key, rangeId);
        }
        return mark.type.create({
          ...attrs,
          color: { ...color, rangeId },
        });
      });
      children.push(
        node.copy(node.isLeaf ? node.content : visit(node.content)).mark(marks),
      );
    }
    return Fragment.fromArray(children);
  }
  return new Slice(visit(slice.content), slice.openStart, slice.openEnd);
}

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
