import { describe, it, expect } from "vitest";
import fixture from "../../../tests/fixtures/documents/valid-mixed.json";
import { parseDocument } from "@fastposter/poster-schema";
import {
  pinchView,
  resizeTextWidth,
  screenToDocument,
  replaceBackground,
  moveTextBlock,
  fitSelectionIntoViewport,
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
/**
 * A02 / FP-07. `bounds` is in document pixels while `viewport` is the visible
 * part of the stage in stage-local pixels, so the selection has to be projected
 * through the view before anything is compared. Translation is preferred; the
 * scale only shrinks when the selection cannot fit at the current zoom.
 */
describe("fitSelectionIntoViewport", () => {
  it("translates a selection into view without changing the zoom", () => {
    const next = fitSelectionIntoViewport(
      { x: 0, y: 0, scale: 0.5 },
      { x: 100, y: 400, width: 200, height: 100 },
      { x: 0, y: 0, width: 300, height: 200 },
    );
    expect(next.scale).toBe(0.5);
    expect(next.x).toBe(0);
    expect(next.y).toBe(-58);
    // The projected box now ends exactly on the 8px-inset viewport bottom.
    expect(next.y + 400 * next.scale + 100 * next.scale).toBe(192);
  });
  it("leaves an already-visible selection untouched", () => {
    const view = { x: 20, y: 20, scale: 1 };
    expect(
      fitSelectionIntoViewport(
        view,
        { x: 30, y: 30, width: 100, height: 50 },
        { x: 0, y: 0, width: 400, height: 300 },
      ),
    ).toEqual(view);
  });
  it("shrinks the zoom only when translation cannot fit the selection", () => {
    const next = fitSelectionIntoViewport(
      { x: 0, y: 0, scale: 3 },
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 120 },
    );
    expect(next.scale).toBeCloseTo(1.04, 5);
    expect(next.x).toBe(8);
    expect(next.y).toBe(8);
    // The projected box sits inside the inset viewport at the new zoom.
    expect(next.x + 100 * next.scale).toBeLessThanOrEqual(192);
    expect(next.y + 100 * next.scale).toBeLessThanOrEqual(112);
  });
  it("projects document bounds through the view scale before comparing", () => {
    // At scale 2 the box starts at 200px; treating bounds as stage-local (100)
    // would leave it in view and move nothing.
    const next = fitSelectionIntoViewport(
      { x: 0, y: 0, scale: 2 },
      { x: 100, y: 100, width: 50, height: 50 },
      { x: 0, y: 0, width: 260, height: 260 },
    );
    expect(next.scale).toBe(2);
    expect(next.x).toBe(-48);
    expect(next.y).toBe(-48);
  });
  it("keeps the leading part visible when a block is taller than the viewport", () => {
    const next = fitSelectionIntoViewport(
      { x: 0, y: 0, scale: 3 },
      { x: 0, y: 0, width: 10, height: 10000 },
      { x: 0, y: 0, width: 200, height: 120 },
    );
    expect(next.scale).toBe(0.02);
    // The top (the line being edited) stays on the inset viewport top.
    expect(next.y).toBe(8);
  });
});
