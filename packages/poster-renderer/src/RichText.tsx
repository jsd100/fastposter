import React from "react";
import type { CSSProperties } from "react";
import type { RichNode, InlineStyle } from "@fastposter/poster-schema";
import { posterFontFamily } from "./FontRegistry";
import { GRADIENT_RANGE_ATTRIBUTE, isGradientColor } from "./gradient";
export function inlineCSS(style: Partial<InlineStyle>): CSSProperties {
  const gradient = isGradientColor(style.color) ? style.color : null;
  return {
    fontFamily: style.fontId ? posterFontFamily(style.fontId) : undefined,
    fontSize: style.fontSize,
    color: gradient
      ? "transparent"
      : typeof style.color === "string"
        ? style.color
        : undefined,
    fontWeight: style.fontWeight,
  };
}
export function RichText({
  node,
  defaultStyle,
}: {
  node: RichNode;
  defaultStyle?: InlineStyle;
}): React.ReactNode {
  if (node.type === "doc")
    return (
      <>
        {node.content?.map((n, i) => (
          <RichText key={i} node={n} defaultStyle={defaultStyle} />
        ))}
      </>
    );
  if (node.type === "paragraph")
    return (
      <p style={{ margin: 0, minHeight: "1em" }}>
        {node.content?.length ? (
          node.content.map((n, i) => (
            <RichText key={i} node={n} defaultStyle={defaultStyle} />
          ))
        ) : (
          <br />
        )}
      </p>
    );
  if (node.type === "hardBreak") return <br />;
  const marks = node.marks ?? [];
  const attrs = Object.assign(
    {},
    defaultStyle,
    ...marks.filter((m) => m.type === "textStyle").map((m) => m.attrs ?? {}),
  ) as Partial<InlineStyle>;
  const css: CSSProperties = inlineCSS(attrs);
  if (marks.some((m) => m.type === "bold")) css.fontWeight = 700;
  if (marks.some((m) => m.type === "italic")) css.fontStyle = "italic";
  css.textDecoration =
    [
      marks.some((m) => m.type === "underline") ? "underline" : "",
      marks.some((m) => m.type === "strike") ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const gradient = isGradientColor(attrs.color) ? attrs.color : null;
  if (gradient && css.textDecoration)
    css.textDecorationColor = gradient.stops[0].color;
  return (
    <span
      style={css}
      {...(gradient
        ? {
            [GRADIENT_RANGE_ATTRIBUTE]: gradient.rangeId,
            "data-gradient": JSON.stringify(gradient),
          }
        : { "data-poster-color": "" })}
    >
      {node.text}
    </span>
  );
}
