import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { TextColor } from "@fastposter/poster-schema";
import {
  gradientCSS,
  GRADIENT_RANGE_ATTRIBUTE,
  isGradientColor,
  type TextGradient,
} from "./gradient";

type Bounds = { left: number; top: number; right: number; bottom: number };
type Group = {
  color: TextGradient;
  bounds: Bounds;
  fragments: Set<number>;
  rectangles: number;
};

function textNodes(root: HTMLElement): Text[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node as Text);
  return nodes;
}

function expand(bounds: Bounds, rect: DOMRect) {
  bounds.left = Math.min(bounds.left, rect.left);
  bounds.top = Math.min(bounds.top, rect.top);
  bounds.right = Math.max(bounds.right, rect.right);
  bounds.bottom = Math.max(bounds.bottom, rect.bottom);
}

function copyLayout(
  content: HTMLElement,
  padding: string,
  visible: ReadonlySet<number>,
  inlineFills?: ReadonlyMap<number, TextGradient>,
) {
  const clone = content.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll<HTMLElement>(
    `[contenteditable], [${GRADIENT_RANGE_ATTRIBUTE}], [data-poster-color], [tabindex], [id], [role], [aria-label], u, s`,
  )) {
    for (const attr of [
      "contenteditable",
      GRADIENT_RANGE_ATTRIBUTE,
      "data-gradient",
      "data-poster-color",
      "tabindex",
      "id",
      "role",
      "aria-label",
    ])
      el.removeAttribute(attr);
    el.style.color = "transparent";
    el.style.textDecoration = "none";
  }
  textNodes(clone).forEach((node, index) => {
    const inline = inlineFills?.get(index);
    if (!inline && visible.has(index)) return;
    const span = content.ownerDocument.createElement("span");
    if (inline) {
      span.style.backgroundImage = gradientCSS(inline);
      span.style.backgroundClip = "text";
    } else span.style.visibility = "hidden";
    node.replaceWith(span);
    span.appendChild(node);
  });
  Object.assign(clone.style, {
    position: "absolute",
    inset: "0",
    display: "block",
    boxSizing: "border-box",
    padding,
    color: "transparent",
    textShadow: "none",
    WebkitTextStroke: "0 transparent",
  });
  return clone;
}

function arrangePaint(
  content: HTMLElement,
  layer: HTMLElement,
  defaultColor: TextColor,
) {
  const nodes = textNodes(content);
  const marks = new Map<Element, TextGradient>();
  const groups = new Map<string, Group>();
  const range = content.ownerDocument.createRange();
  const origin = layer.getBoundingClientRect();
  const width = parseFloat(getComputedStyle(layer).width);
  const scale = origin.width / width;
  if (!(scale > 0)) return;

  nodes.forEach((node, index) => {
    const owner = node.parentElement?.closest(
      `[${GRADIENT_RANGE_ATTRIBUTE}], [data-poster-color]`,
    );
    let color: TextColor = defaultColor;
    if (owner) {
      const data = owner.getAttribute("data-gradient");
      if (!data) return;
      let mark = marks.get(owner);
      if (!mark) {
        mark = JSON.parse(data) as TextGradient;
        marks.set(owner, mark);
      }
      color = mark;
    }
    if (!isGradientColor(color) || !node.length) return;
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (!(rect.width > 0 && rect.height > 0)) continue;
      const bounds = new DOMRect(
        (rect.left - origin.left) / scale,
        (rect.top - origin.top) / scale,
        rect.width / scale,
        rect.height / scale,
      );
      const group = groups.get(color.rangeId) ?? {
        color,
        bounds: {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        },
        fragments: new Set<number>(),
        rectangles: 0,
      };
      expand(group.bounds, bounds);
      group.fragments.add(index);
      group.rectangles++;
      groups.set(color.rangeId, group);
    }
  });

  const paint = content.ownerDocument.createDocumentFragment();
  const padding = getComputedStyle(layer.parentElement!).padding;
  const inlineFills = new Map<number, TextGradient>();
  for (const { color, bounds, fragments, rectangles } of groups.values()) {
    if (rectangles === 1 && groups.size > 1) {
      inlineFills.set(fragments.values().next().value!, color);
      continue;
    }
    // A range that wraps or spans style runs needs an aligned background
    // across its full glyph mask. Single fragments can share a layout copy.
    const clone = copyLayout(content, padding, fragments);
    Object.assign(clone.style, {
      backgroundImage: gradientCSS(color),
      backgroundRepeat: "no-repeat",
      backgroundSize: `${bounds.right - bounds.left}px ${bounds.bottom - bounds.top}px`,
      backgroundPosition: `${bounds.left}px ${bounds.top}px`,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
    });
    paint.appendChild(clone);
  }
  if (inlineFills.size)
    paint.appendChild(copyLayout(content, padding, new Set(), inlineFills));
  layer.replaceChildren(paint);
}

export function GradientPaint({
  children,
  defaultColor,
  hasGradient,
}: {
  children: ReactNode;
  defaultColor: TextColor;
  hasGradient: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const source = content.current;
    const surface = layer.current;
    if (!hasGradient || !source || !surface) return;
    let frame = 0;
    const update = () => arrangePaint(source, surface, defaultColor);
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const mutations = new MutationObserver(schedule);
    mutations.observe(source, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "data-gradient", "data-poster-color"],
    });
    if (surface.parentElement)
      mutations.observe(surface.parentElement, {
        attributes: true,
        attributeFilter: ["style"],
      });
    const resize = new ResizeObserver(schedule);
    resize.observe(surface);
    const fonts = source.ownerDocument.fonts;
    fonts.addEventListener("loadingdone", schedule);
    return () => {
      mutations.disconnect();
      resize.disconnect();
      fonts.removeEventListener("loadingdone", schedule);
      cancelAnimationFrame(frame);
    };
  }, [defaultColor, hasGradient]);
  return (
    <>
      <div ref={content} style={{ display: "contents" }}>
        {children}
      </div>
      {hasGradient && (
        <div
          ref={layer}
          aria-hidden="true"
          inert
          data-gradient-paint=""
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
    </>
  );
}
