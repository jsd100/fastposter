import type { PointerEvent } from "react";
import type { TextBlock } from "@fastposter/poster-schema";
import type { ViewTransform } from "./geometry";
export function SelectionHandles({
  block,
  height,
  view,
  onResize,
}: {
  block: TextBlock;
  height: number;
  view: ViewTransform;
  onResize: (
    edge: "left" | "right",
    e: PointerEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <div
      className="selection-outline"
      style={{
        left: view.x + block.x * view.scale,
        top: view.y + block.y * view.scale,
        width: block.width * view.scale,
        height: height * view.scale,
      }}
    >
      <span className="selection-size">
        {Math.round(block.width)} × {Math.round(height)} px
      </span>
      {(["left", "right"] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          className={`width-handle width-handle-${edge}`}
          aria-label={`调整${edge === "left" ? "左" : "右"}侧宽度`}
          onPointerDown={(e) => onResize(edge, e)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}
