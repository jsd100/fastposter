import { it, expect } from "vitest";
import { parseDocument } from "@fastposter/poster-schema";
import { createEditorStore } from "./store";
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
