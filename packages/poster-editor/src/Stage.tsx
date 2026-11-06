import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { TextBlock as Block } from "@fastposter/poster-schema";
import { Select } from "@fastposter/ui";
import { measureLayout, type LayoutReport } from "@fastposter/poster-renderer";
import {
  pinchView,
  moveTextBlock,
  resizeTextWidth,
  fitSelectionIntoViewport,
  clamp,
  type Point,
  type Rect,
  type ViewTransform,
} from "./geometry";
import type { EditorStore, EditorState } from "./store";
import { TextBlock } from "./TextBlock";
import { SelectionHandles } from "./SelectionHandles";
type Gesture =
  | { kind: "pan"; start: Point; view: ViewTransform }
  | {
      kind: "move" | "left" | "right";
      start: Point;
      block: Block;
      height: number;
      scale: number;
    };
/**
 * A press on a control must not read as a press on empty canvas: it would pan
 * the view or drop the selection while the user is only choosing a zoom level.
 * Tag names no longer tell — the shared select renders as a div with an inner
 * input — so the test follows the hooks every shared control carries.
 */
function isControlPress(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("button,select,[data-fp-control],[data-fp-input]") !== null
  );
}
/**
 * A block taller than the visible band keeps the line being edited (or the
 * leading part of a live range) in view instead of the whole block. Bounds
 * and the viewport are in different spaces, so a DOM range is projected back
 * into document pixels through the current view.
 */
function focusRect(
  bounds: Rect,
  block: Block | undefined,
  editing: boolean,
  frame: HTMLElement | null,
  view: ViewTransform,
  viewport: Rect,
): Rect {
  if (bounds.height * view.scale <= viewport.height) return bounds;
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  if (editing && frame && anchor instanceof Node && frame.contains(anchor)) {
    const rects = selection?.rangeCount
      ? selection.getRangeAt(0).getClientRects()
      : null;
    const first = rects?.length ? rects[0] : null;
    if (first && (first.width > 1 || first.height > 1)) {
      const frameRect = frame.getBoundingClientRect();
      return {
        x: (first.left - frameRect.left) / view.scale,
        y: (first.top - frameRect.top) / view.scale,
        width: Math.max(1, first.width / view.scale),
        height: Math.max(1, first.height / view.scale),
      };
    }
  }
  const line = block
    ? block.defaultStyle.fontSize * block.paragraphStyle.lineHeight
    : bounds.height;
  return { ...bounds, height: Math.min(bounds.height, Math.max(1, line)) };
}
export function Stage({
  store,
  state,
  renderEditing,
  onLayout,
  visibleViewport,
}: {
  store: EditorStore;
  state: EditorState;
  renderEditing?: (block: Block) => ReactNode;
  onLayout?: (report: LayoutReport) => void;
  /** Visible stage band while the phone inspector covers its lower part. */
  visibleViewport?: Rect | null;
}) {
  const outer = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Rect | null>(null);
  viewportRef.current = visibleViewport ?? null;
  const gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ view: ViewTransform; a: Point; b: Point } | null>(
    null,
  );
  function touchEnd(e: PointerEvent<HTMLDivElement>) {
    touches.current.delete(e.pointerId);
    if (pinch.current) {
      if (touches.current.size < 2) pinch.current = null;
      gesture.current = null;
      return true;
    }
    return false;
  }

  const [layout, setLayout] = useState<LayoutReport | null>(null);
  const d = state.document;
  const view = state.view;
  useLayoutEffect(() => {
    const root = outer.current!;
    function fit() {
      const width = root.clientWidth,
        height = root.clientHeight;
      // A size change re-fits to the currently visible band. The band is read
      // from a ref so opening or closing the sheet never re-fits on its own:
      // that adjustment belongs to the sheet lifecycle, not to the stage size.
      const area = viewportRef.current ?? { x: 0, y: 0, width, height };
      const scale = clamp(
        Math.min(
          (area.width - 80) / d.canvas.width,
          (area.height - 80) / d.canvas.height,
          1,
        ),
        0.02,
        3,
      );
      store.setView({
        x: area.x + (area.width - d.canvas.width * scale) / 2,
        y: area.y + (area.height - d.canvas.height * scale) / 2,
        scale,
      });
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [d.canvas.width, d.canvas.height, store]);
  useLayoutEffect(() => {
    const root = canvas.current!;
    const measure = () => {
      const report = measureLayout(root);
      setLayout(report);
      store.setOverflow(!!report.overflow);
      onLayout?.(report);
    };
    measure();
    const observer = new ResizeObserver(measure);
    root
      .querySelectorAll("[data-text-block]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [d, view.scale, store, onLayout]);
  useLayoutEffect(() => {
    if (!visibleViewport || !layout || !state.selectedId) return;
    const bounds = layout.blocks.find((b) => b.id === state.selectedId);
    if (!bounds) return;
    const block = d.textBlocks.find((b) => b.id === state.selectedId);
    const next = fitSelectionIntoViewport(
      view,
      focusRect(
        bounds,
        block,
        state.mode === "edit",
        canvas.current,
        view,
        visibleViewport,
      ),
      visibleViewport,
    );
    if (
      Math.abs(next.x - view.x) < 0.01 &&
      Math.abs(next.y - view.y) < 0.01 &&
      Math.abs(next.scale - view.scale) < 0.0001
    )
      return;
    // Pure view: no document write and no history entry.
    store.setView(next);
  }, [visibleViewport, layout, state.selectedId, state.mode, view, d, store]);
  function downBlock(block: Block, e: PointerEvent<HTMLDivElement>) {
    if (state.mode === "edit" && state.selectedId === block.id) return;
    e.stopPropagation();
    if (e.button !== 0) return;
    store.select(block.id);
    store.begin();
    gesture.current = {
      kind: "move",
      start: { x: e.clientX, y: e.clientY },
      block: structuredClone(block),
      height: layout?.blocks.find((b) => b.id === block.id)?.height ?? 0,
      scale: view.scale,
    };
    outer.current!.setPointerCapture(e.pointerId);
  }
  function resize(edge: "left" | "right", e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    const block = d.textBlocks.find((b) => b.id === state.selectedId);
    if (!block) return;
    store.setMode("select");
    store.begin();
    gesture.current = {
      kind: edge,
      start: { x: e.clientX, y: e.clientY },
      block: structuredClone(block),
      height: 0,
      scale: view.scale,
    };
    outer.current!.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.start.x,
      dy = e.clientY - g.start.y;
    if (g.kind === "pan") {
      store.setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
      return;
    }
    store.updateBlock(g.block.id, () =>
      g.kind === "move"
        ? moveTextBlock(
            g.block,
            { x: g.block.x + dx / g.scale, y: g.block.y + dy / g.scale },
            d.canvas,
            g.height,
          )
        : resizeTextWidth(g.block, g.kind, dx / g.scale, d.canvas),
    );
  }
  function end(e: PointerEvent<HTMLDivElement>, cancel = false) {
    if (!gesture.current) return;
    if (gesture.current.kind !== "pan") {
      if (cancel) store.cancel();
      else store.commit();
    }
    gesture.current = null;
    if (outer.current?.hasPointerCapture(e.pointerId))
      outer.current.releasePointerCapture(e.pointerId);
  }
  useEffect(() => {
    const el = outer.current!;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[contenteditable="true"]')) return;
      e.preventDefault();
      const current = store.getState().view;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left,
          py = e.clientY - rect.top;
        const scale = clamp(
          current.scale * Math.exp(-e.deltaY * 0.003),
          0.02,
          3,
        );
        store.setView({
          scale,
          x: px - ((px - current.x) * scale) / current.scale,
          y: py - ((py - current.y) * scale) / current.scale,
        });
      } else
        store.setView({
          ...current,
          x: current.x - e.deltaX,
          y: current.y - e.deltaY,
        });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [store]);
  const selected = d.textBlocks.find((b) => b.id === state.selectedId);
  const selectedHeight =
    layout?.blocks.find((b) => b.id === state.selectedId)?.height ?? 0;
  return (
    <div
      className="editor-stage"
      ref={outer}
      data-editor-stage
      style={{ touchAction: state.mode === "edit" ? "auto" : "none" }}
      onPointerDownCapture={(e) => {
        // Portaled popup presses bubble through the React tree, so they reach this
        // handler even though their DOM nodes live outside the stage.
        if (
          !e.currentTarget.contains(e.target as Node) ||
          e.pointerType !== "touch" ||
          state.mode === "edit" ||
          isControlPress(e.target)
        )
          return;
        const rect = e.currentTarget.getBoundingClientRect();
        touches.current.set(e.pointerId, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        if (touches.current.size === 2) {
          store.cancel();
          gesture.current = null;
          const [a, b] = Array.from(touches.current.values());
          pinch.current = { view: store.getState().view, a, b };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onPointerDown={(e) => {
        if (
          e.button !== 0 ||
          !e.currentTarget.contains(e.target as Node) ||
          isControlPress(e.target) ||
          (e.target as HTMLElement).closest("[data-text-block]")
        )
          return;
        store.select(null);
        gesture.current = {
          kind: "pan",
          start: { x: e.clientX, y: e.clientY },
          view,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (pinch.current) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (touches.current.has(e.pointerId))
            touches.current.set(e.pointerId, {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          const [a, b] = Array.from(touches.current.values());
          if (a && b)
            store.setView(
              pinchView(
                pinch.current.view,
                pinch.current.a,
                pinch.current.b,
                a,
                b,
              ),
            );
          return;
        }
        move(e);
      }}
      onPointerUp={(e) => {
        if (!touchEnd(e)) end(e);
      }}
      onPointerCancel={(e) => {
        if (!touchEnd(e)) end(e, true);
      }}
    >
      <div
        className="poster-canvas"
        ref={canvas}
        data-poster-frame
        data-width={d.canvas.width}
        data-height={d.canvas.height}
        style={{
          width: d.canvas.width,
          height: d.canvas.height,
          transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`,
        }}
      >
        <img
          src={`/api/v1/assets/${d.background.assetId}/versions/${d.background.version}`}
          alt=""
          draggable={false}
          className="poster-background"
        />
        {d.textBlocks.map((block) => (
          <TextBlock
            key={block.id}
            block={block}
            editing={state.mode === "edit" && state.selectedId === block.id}
            onPointerDown={(e) => downBlock(block, e)}
            onEdit={() => {
              store.select(block.id, renderEditing ? "edit" : "select");
            }}
          >
            {renderEditing?.(block) ?? <div />}
          </TextBlock>
        ))}
      </div>
      {selected && state.mode === "select" && (
        <SelectionHandles
          block={selected}
          height={selectedHeight}
          view={view}
          onResize={resize}
        />
      )}
      <div className="stage-caption">
        {d.canvas.width} × {d.canvas.height} px
        <span>预览缩放不会改变导出尺寸</span>
      </div>
      <label className="stage-zoom">
        缩放
        <Select
          aria-label="预览缩放"
          value={view.scale}
          onValueChange={(scale) => {
            const root = outer.current!;
            const center = selected
              ? {
                  x: selected.x + selected.width / 2,
                  y: selected.y + selectedHeight / 2,
                }
              : { x: d.canvas.width / 2, y: d.canvas.height / 2 };
            store.setView({
              scale,
              x: root.clientWidth / 2 - center.x * scale,
              y: root.clientHeight / 2 - center.y * scale,
            });
          }}
          valueLabel={
            [0.25, 0.5, 0.75, 1, 1.5, 2, 3].includes(view.scale)
              ? `${view.scale * 100}%`
              : `${Math.round(view.scale * 100)}% · 适应`
          }
          options={[0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((scale) => ({
            value: scale,
            label: `${scale * 100}%`,
          }))}
        />
      </label>
    </div>
  );
}
