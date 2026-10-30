import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { TextBlock as Block } from "@fastposter/poster-schema";
import { measureLayout, type LayoutReport } from "@fastposter/poster-renderer";
import {
  pinchView,
  moveTextBlock,
  resizeTextWidth,
  clamp,
  type Point,
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
export function Stage({
  store,
  state,
  renderEditing,
  onLayout,
}: {
  store: EditorStore;
  state: EditorState;
  renderEditing?: (block: Block) => ReactNode;
  onLayout?: (report: LayoutReport) => void;
}) {
  const outer = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
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
      const scale = clamp(
        Math.min(
          (width - 80) / d.canvas.width,
          (height - 80) / d.canvas.height,
          1,
        ),
        0.02,
        3,
      );
      store.setView({
        x: (width - d.canvas.width * scale) / 2,
        y: (height - d.canvas.height * scale) / 2,
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
        if (
          e.pointerType !== "touch" ||
          state.mode === "edit" ||
          (e.target as HTMLElement).closest("button,select")
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
          (e.target as HTMLElement).closest("button,[data-text-block]")
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
        <select
          aria-label="预览缩放"
          value={view.scale}
          onChange={(e) => {
            const scale = Number(e.target.value),
              root = outer.current!;
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
        >
          {![0.25, 0.5, 0.75, 1, 1.5, 2, 3].includes(view.scale) && (
            <option value={view.scale}>
              {Math.round(view.scale * 100)}% · 适应
            </option>
          )}
          {[0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((scale) => (
            <option key={scale} value={scale}>
              {scale * 100}%
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
