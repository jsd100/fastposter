import { it, expect } from "vitest";
import { parseDocument } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import { createEditorStore } from "./store";
import { prepareFontChange } from "./fonts/prepare-change";
it("stores only immutable font references, not transport URLs", () => {
  const doc = parseDocument({
    schemaVersion: 1,
    canvas: { width: 1200, height: 1600 },
    background: { assetId: "bg", version: "1" },
    fonts: [],
    textBlocks: [],
  });
  const store = createEditorStore(doc);
  const source = {
    assetId: "font",
    version: "1",
    family: "Noto Sans SC",
    weight: 400,
    style: "normal" as const,
    url: "/api/font",
  };
  store.addText([source]);
  expect(() => parseDocument(store.getState().document)).not.toThrow();
  expect(store.getState().document.fonts[0]).not.toHaveProperty("url");
});
it("undoing block deletion selects the restored block", () => {
  const store = createEditorStore(
    parseDocument({
      schemaVersion: 1,
      canvas: { width: 1200, height: 1600 },
      background: { assetId: "bg", version: "1" },
      fonts: [],
      textBlocks: [],
    }),
  );
  store.addText([
    {
      assetId: "font",
      version: "1",
      family: "Noto Sans SC",
      weight: 400,
      style: "normal",
    },
  ]);
  const id = store.getState().selectedId;
  store.deleteSelected();
  store.undo();
  expect(store.getState().selectedId).toBe(id);
});
it("one undo restores the font references and the text style together", () => {
  const source = (
    assetId: string,
    family: string,
    weight: number,
  ): FontSource => ({
    assetId,
    family,
    version: "1",
    weight,
    style: "normal",
    url: `/api/assets/${assetId}/versions/1`,
  });
  const sans400 = source("sans-400", "Noto Sans SC", 400);
  const kuaile400 = source("kuaile-400", "ZCOOL KuaiLe", 400);
  const doc = parseDocument({
    schemaVersion: 1,
    canvas: { width: 1200, height: 1600 },
    background: { assetId: "bg", version: "1" },
    fonts: [
      {
        assetId: "sans-400",
        version: "1",
        family: "Noto Sans SC",
        weight: 400,
        style: "normal",
      },
    ],
    textBlocks: [
      {
        id: "block",
        x: 0,
        y: 0,
        width: 1200,
        zIndex: 0,
        defaultStyle: {
          fontId: "sans-400",
          fontSize: 64,
          color: "#284632",
          fontWeight: 400,
        },
        paragraphStyle: { align: "left", lineHeight: 1.4, letterSpacing: 0 },
        effects: {
          opacity: 1,
          padding: 0,
          backgroundColor: "#00000000",
          strokeWidth: 0,
          strokeColor: "#000000",
          shadowColor: "#00000000",
          shadowBlur: 0,
          shadowX: 0,
          shadowY: 0,
        },
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "你好风景世界" }],
            },
          ],
        },
      },
    ],
  });
  const store = createEditorStore(doc);
  store.select("block");
  const before = store.getState().document;
  const change = prepareFontChange(
    store.getState().document,
    { blockId: "block", target: { kind: "range", from: 3, to: 5 } },
    kuaile400,
    [sans400, kuaile400],
  );
  store.transact(() => change.nextDocument);
  expect(
    store
      .getState()
      .document.textBlocks[0].content.content![0].content![1].marks![0].attrs,
  ).toEqual({
    fontId: "kuaile-400",
    fontWeight: 400,
  });
  expect(store.getState().document.fonts.map((f) => f.assetId)).toEqual([
    "sans-400",
    "kuaile-400",
  ]);
  store.undo();
  expect(store.getState().document).toEqual(before);
});
