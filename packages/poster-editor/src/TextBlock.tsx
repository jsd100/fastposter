import type { PointerEvent, ReactNode } from "react";
import type { TextBlock as Block } from "@fastposter/poster-schema";
import { blockCSS, RichText } from "@fastposter/poster-renderer";
export function TextBlock({
  block,
  editing,
  onPointerDown,
  onEdit,
  children,
}: {
  block: Block;
  editing: boolean;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onEdit: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      data-text-block={block.id}
      data-x={block.x}
      data-y={block.y}
      data-selected-editing={editing || undefined}
      style={{
        ...blockCSS(block),
        cursor: editing ? "text" : "move",
        userSelect: editing ? "text" : "none",
        touchAction: editing ? "auto" : "none",
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onEdit}
    >
      {editing ? children : <RichText node={block.content} />}
    </div>
  );
}
