import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { parseDocument } from "@fastposter/poster-schema";
import type { PosterDocument } from "@fastposter/poster-schema";
import {
  PosterFrame,
  loadFonts,
  measureLayout,
} from "@fastposter/poster-renderer";
import type { FontSource, LayoutReport } from "@fastposter/poster-renderer";
const root = createRoot(document.getElementById("root")!);
document.documentElement.style.cssText =
  "margin:0;padding:0;background:transparent";
document.body.style.cssText = "margin:0;padding:0;background:transparent";
declare global {
  interface Window {
    renderPoster: (data: {
      document: PosterDocument;
      fonts: FontSource[];
    }) => Promise<LayoutReport>;
  }
}
window.renderPoster = async ({ document: d, fonts }) => {
  parseDocument(d);
  await loadFonts(fonts);
  flushSync(() =>
    root.render(<PosterFrame document={d} transparentTextOnly />),
  );
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const frame = document.querySelector<HTMLElement>("[data-poster-frame]");
  if (!frame) throw Error("Frame not mounted");
  const report = measureLayout(frame);
  if (report.overflow) throw Error("文字超出画布，请调整位置、宽度或字号");
  return report;
};
