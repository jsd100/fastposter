import { it, expect } from "vitest";
import { parseDocument } from "@fastposter/poster-schema";
import type { FontSource } from "@fastposter/poster-renderer";
import {
  createEditorStore,
  NumberDraftSession,
  type DraftScope,
  type TransactionHandle,
} from "./store";
import { prepareFontChange } from "./fonts/prepare-change";

function emptyDoc() {
  return parseDocument({
    schemaVersion: 1,
    canvas: { width: 1200, height: 1600 },
    background: { assetId: "bg", version: "1" },
    fonts: [],
    textBlocks: [],
  });
}
function resized(store: ReturnType<typeof createEditorStore>, width: number) {
  store.update({
    ...store.getState().document,
    canvas: { ...store.getState().document.canvas, width },
  });
}

it("finish only ends the transaction that still matches the handle", () => {
  const store = createEditorStore(emptyDoc());
  const first = store.acquire("control", "block-a:color");
  resized(store, 800);
  expect(store.getState().inTransaction).toBe(true);
  // A handle from another session/identity is ignored.
  const stale: TransactionHandle = {
    session: 999,
    target: "block-a:color",
    id: 999,
    owner: "control",
  };
  expect(store.finish(stale, "commit")).toBe(false);
  expect(store.getState().inTransaction).toBe(true);
  expect(store.finish(first, "commit")).toBe(true);
  expect(store.getState().inTransaction).toBe(false);
  // A late timer / blur cannot commit a transaction that is already over.
  expect(store.finish(first, "commit")).toBe(false);
  expect(store.getState().document.canvas.width).toBe(800);
});

it("a newer transaction cannot be finished by an old handle", () => {
  const store = createEditorStore(emptyDoc());
  const typing = store.acquire("richtext", "block-a");
  // A control gesture starts while typing is open: the old transaction is
  // committed and a fresh identity is issued.
  const color = store.acquire("control", "block-a:color");
  expect(color.id).not.toBe(typing.id);
  resized(store, 640);
  // The rich-text debounce fires late and must not commit the color gesture.
  expect(store.finish(typing, "commit")).toBe(false);
  expect(store.getState().inTransaction).toBe(true);
  expect(store.finish(color, "commit")).toBe(true);
  expect(store.getState().inTransaction).toBe(false);
});

it("session invalidation ends the old session and ignores late handles", () => {
  const store = createEditorStore(emptyDoc());
  const old = store.acquire("control", "block-a:color");
  resized(store, 900);
  store.invalidateSession();
  expect(store.getState().inTransaction).toBe(false);
  expect(store.finish(old, "commit")).toBe(false);
  const fresh = store.acquire("control", "block-a:color");
  expect(fresh.session).not.toBe(old.session);
  expect(store.finish(old, "commit")).toBe(false);
  expect(store.finish(fresh, "commit")).toBe(true);
});

it("finish(handle, cancel) reverts without adding history", () => {
  const store = createEditorStore(emptyDoc());
  expect(store.getState().canUndo).toBe(false);
  const handle = store.acquire("control", "block-a:padding");
  resized(store, 500);
  expect(store.finish(handle, "cancel")).toBe(true);
  expect(store.getState().document.canvas.width).toBe(1200);
  expect(store.getState().canUndo).toBe(false);
});

it("NumberDraftSession scopes, restores and discards a suspended snapshot", () => {
  const drafts = new NumberDraftSession();
  const scope: DraftScope = {
    work: "u1:project:p1",
    blockId: "b1",
    field: "padding",
    target: "select",
  };
  const snapshot = { raw: "12.", baseline: 0, lastValid: 12 };
  const handle: TransactionHandle = {
    session: 0,
    target: "b1:padding",
    id: 1,
    owner: "control",
  };
  drafts.write(scope, snapshot, handle);
  expect(drafts.read(scope)).toEqual(snapshot);
  expect(drafts.handleOf(scope)).toEqual(handle);
  // Another edit target or another block must not see this draft.
  expect(drafts.read({ ...scope, target: "edit" })).toBeUndefined();
  expect(drafts.read({ ...scope, blockId: "b2" })).toBeUndefined();
  drafts.discardBlock("b1");
  expect(drafts.read(scope)).toBeUndefined();
  drafts.write(scope, snapshot, handle);
  drafts.invalidate();
  expect(drafts.read(scope)).toBeUndefined();
});
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
    store.getState().document.textBlocks[0].content.content![0].content![1]
      .marks![0].attrs,
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
