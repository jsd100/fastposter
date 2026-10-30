import React from "react";
import type { CSSProperties } from "react";
import type { RichNode, InlineStyle } from "@fastposter/poster-schema";
import { fontFamily } from "./FontRegistry";
export function inlineCSS(style: Partial<InlineStyle>): CSSProperties {
  return {
    fontFamily: style.fontId ? fontFamily(style.fontId) : undefined,
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: style.fontWeight,
  };
}
export function RichText({ node }: { node: RichNode }): React.ReactNode {
  if (node.type === "doc")
    return (
      <>
        {node.content?.map((n, i) => (
          <RichText key={i} node={n} />
        ))}
      </>
    );
  if (node.type === "paragraph")
    return (
      <p style={{ margin: 0, minHeight: "1em" }}>
        {node.content?.length ? (
          node.content.map((n, i) => <RichText key={i} node={n} />)
        ) : (
          <br />
        )}
      </p>
    );
  if (node.type === "hardBreak") return <br />;
  const marks = node.marks ?? [];
  const attrs = Object.assign(
    {},
    ...marks.filter((m) => m.type === "textStyle").map((m) => m.attrs ?? {}),
  );
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
  return <span style={css}>{node.text}</span>;
}
