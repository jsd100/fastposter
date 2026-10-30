import { describe, it, expect } from "vitest";
import fixture from "../../../tests/fixtures/documents/valid-mixed.json";
import { parseDocument } from "@fastposter/poster-schema";
import {
  pinchView,
  resizeTextWidth,
  screenToDocument,
  replaceBackground,
  moveTextBlock,
} from "./geometry";
import { DocumentHistory } from "./history";
describe("original-pixel geometry", () => {
  const doc = parseDocument(fixture);
  const block = doc.textBlocks[0];
  it("resizeWidthKeepsFontAndOppositeAnchor at all preview scales and DPR", () => {
    for (const scale of [0.25, 1, 2])
      for (const dpr of [1, 2]) {
        const view = { x: 30, y: 40, scale };
        const from = screenToDocument({ x: 30 + block.x * scale, y: 40 }, view),
          to = screenToDocument(
            { x: 30 + (block.x + 100) * scale, y: 40 },
            view,
          );
        const next = resizeTextWidth(block, "left", to.x - from.x, doc.canvas);
        expect(next.x).toBe(180);
        expect(next.width).toBe(500);
        expect(next.x + next.width).toBe(block.x + block.width);
        expect(next.defaultStyle).toEqual(block.defaultStyle);
        expect(dpr).toBeGreaterThan(0);
      }
  });
  it("clamps movement and width without scaling content", () => {
    expect(
      moveTextBlock(block, { x: 1e6, y: -1 }, doc.canvas, 150),
    ).toMatchObject({ x: 600, y: 0 });
    expect(resizeTextWidth(block, "right", 1e6, doc.canvas).width).toBe(1120);
    expect(
      resizeTextWidth(block, "left", 1e6, doc.canvas).width,
    ).toBeGreaterThan(0);
  });
  it("replaceBackgroundScalesXYWidthOnly", () => {
    const next = replaceBackground(doc, {
      id: "bg-2",
      version: "2",
      width: 600,
      height: 800,
    });
    expect(next.canvas).toEqual({ width: 600, height: 800 });
    expect(next.textBlocks[0]).toMatchObject({ x: 40, y: 60, width: 300 });
    expect(next.textBlocks[0].defaultStyle.fontSize).toBe(72);
    expect(doc.canvas.width).toBe(1200);
  });
});
describe("one history for geometry and text", () => {
  it("groups pointer updates into one undo and clears redo on a new operation", () => {
    const history = new DocumentHistory({ x: 0, text: "a" });
    history.begin();
    history.update({ x: 1, text: "a" });
    history.update({ x: 2, text: "a" });
    history.commit();
    history.begin();
    history.update({ x: 2, text: "ab" });
    history.commit();
    expect(history.undo()).toEqual({ x: 2, text: "a" });
    expect(history.undo()).toEqual({ x: 0, text: "a" });
    expect(history.redo()).toEqual({ x: 2, text: "a" });
    history.begin();
    history.update({ x: 3, text: "a" });
    history.commit();
    expect(history.canRedo).toBe(false);
  });
  it("no-op transaction does not consume history and cancellation restores original", () => {
    const history = new DocumentHistory({ x: 1 });
    history.begin();
    history.update({ x: 1 });
    history.commit();
    expect(history.canUndo).toBe(false);
    history.begin();
    history.update({ x: 2 });
    expect(history.cancel()).toEqual({ x: 1 });
    expect(history.canUndo).toBe(false);
  });
});
it("pinch changes only the view and keeps midpoint anchored", () => {
  expect(
    pinchView(
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 20, y: 10 },
      { x: 220, y: 10 },
    ),
  ).toEqual({ x: 20, y: 10, scale: 2 });
});
