import React, { useEffect } from "react";
import type { CSSProperties } from "react";
import type { PosterDocument, TextBlock } from "@fastposter/poster-schema";
import { inlineCSS, RichText } from "./RichText";
import { blockHasGradient, isGradientColor } from "./gradient";
import { GradientPaint } from "./GradientPaint";
import { documentFontVariables, loadDocumentFonts } from "./FontRegistry";
export function blockCSS(b: TextBlock): CSSProperties {
  const e = b.effects;
  const color = b.defaultStyle.color;
  return {
    position: "absolute",
    left: b.x,
    top: b.y,
    width: b.width,
    zIndex: b.zIndex,
    boxSizing: "border-box",
    padding: e.padding,
    opacity: e.opacity,
    background: e.backgroundColor,
    ...inlineCSS(b.defaultStyle),
    ...(isGradientColor(color)
      ? ({ "--fp-decoration-color": color.stops[0].color } as CSSProperties)
      : {}),
    lineHeight: b.paragraphStyle.lineHeight,
    letterSpacing: b.paragraphStyle.letterSpacing,
    textAlign: b.paragraphStyle.align,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSynthesis: "none",
    WebkitTextStroke: e.strokeWidth
      ? `${e.strokeWidth}px ${e.strokeColor}`
      : undefined,
    paintOrder: "stroke fill",
    textShadow:
      e.shadowColor !== "#00000000"
        ? `${e.shadowX}px ${e.shadowY}px ${e.shadowBlur}px ${e.shadowColor}`
        : undefined,
  };
}
export function PosterFrame({
  document: d,
  backgroundUrl,
  transparentTextOnly = false,
}: {
  document: PosterDocument;
  backgroundUrl?: string;
  transparentTextOnly?: boolean;
}) {
  useEffect(() => {
    void loadDocumentFonts(d.fonts).catch(() => undefined);
  }, [d.fonts]);
  return (
    <div
      data-poster-frame
      data-width={d.canvas.width}
      data-height={d.canvas.height}
      style={{
        ...documentFontVariables(d.fonts),
        position: "relative",
        width: d.canvas.width,
        height: d.canvas.height,
        overflow: "hidden",
        background: "transparent",
        isolation: "isolate",
      }}
    >
      {!transparentTextOnly && backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}
      {d.textBlocks.map((b) => (
        <div
          key={b.id}
          data-text-block={b.id}
          data-x={b.x}
          data-y={b.y}
          style={blockCSS(b)}
        >
          <GradientPaint
            defaultColor={b.defaultStyle.color}
            hasGradient={blockHasGradient(b)}
          >
            <RichText node={b.content} defaultStyle={b.defaultStyle} />
          </GradientPaint>
        </div>
      ))}
    </div>
  );
}
