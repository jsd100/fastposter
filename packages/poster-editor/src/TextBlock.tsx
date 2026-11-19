import type { CSSProperties, PointerEvent, ReactNode } from "react";
import type { TextBlock as Block } from "@fastposter/poster-schema";
import {
  blockCSS,
  blockHasGradient,
  GradientPaint,
  RichText,
} from "@fastposter/poster-renderer";
export function TextBlock({
  block,
  editing,
  weightPreview,
  onPointerDown,
  onEdit,
  children,
}: {
  block: Block;
  editing: boolean;
  weightPreview?: number;
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
      data-font-weight-preview={weightPreview == null ? undefined : ""}
      style={{
        ...blockCSS(block),
        ...(weightPreview == null
          ? {}
          : ({ "--fp-weight-preview": weightPreview } as CSSProperties)),
        cursor: editing ? "text" : "move",
        userSelect: editing ? "text" : "none",
        touchAction: editing ? "auto" : "none",
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onEdit}
    >
      <GradientPaint
        defaultColor={block.defaultStyle.color}
        hasGradient={blockHasGradient(block)}
      >
        {editing ? (
          children
        ) : (
          <RichText node={block.content} defaultStyle={block.defaultStyle} />
        )}
      </GradientPaint>
    </div>
  );
}
