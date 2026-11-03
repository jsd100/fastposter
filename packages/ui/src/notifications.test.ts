import { describe, expect, it } from "vitest";
import {
  createNoticeStore,
  noticeTimeout,
  type NoticeEntry,
} from "./notifications";

function collect() {
  const upserts: NoticeEntry[] = [];
  const dismissed: string[] = [];
  const store = createNoticeStore({
    upsert: (entry) => upserts.push(entry),
    dismiss: (id) => dismissed.push(id),
  });
  return { store, upserts, dismissed };
}

describe("noticeTimeout", () => {
  it("keeps confirmations at four seconds and failures at six", () => {
    expect(noticeTimeout({ tone: "info" })).toBe(4000);
    expect(noticeTimeout({ tone: "success" })).toBe(4000);
    expect(noticeTimeout({ tone: "error" })).toBe(6000);
  });

  it("lets persistent failures stay until they clear", () => {
    expect(noticeTimeout({ tone: "error", persistent: true })).toBe(0);
    expect(noticeTimeout({ tone: "info", persistent: true })).toBe(0);
  });
});

describe("createNoticeStore", () => {
  it("updates a notice that arrives again with the same id", () => {
    const { store, upserts } = collect();
    store.setScope("alice");
    expect(
      store.show({ id: "upload", tone: "error", title: "上传失败" }, 0),
    ).toBe("upload");
    expect(
      store.show({ id: "upload", tone: "error", title: "仍然上传失败" }, 0),
    ).toBe("upload");
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0]?.title).toBe("仍然上传失败");
    expect(upserts.map((entry) => entry.title)).toEqual([
      "上传失败",
      "仍然上传失败",
    ]);
  });

  it("gives generated ids to notices without one", () => {
    const { store } = collect();
    store.setScope("alice");
    const first = store.show({ tone: "success", title: "已保存" }, 0);
    const second = store.show({ tone: "success", title: "已保存" }, 0);
    expect(first).not.toBe(second);
    expect(store.entries).toHaveLength(2);
  });

  it("applies the tone timeout to the queued notice", () => {
    const { store, upserts } = collect();
    store.setScope("alice");
    store.show({ tone: "success", title: "已保存" }, 0);
    store.show({ tone: "error", title: "保存失败" }, 0);
    store.show({ tone: "error", title: "加载失败", persistent: true }, 0);
    expect(upserts.map((entry) => entry.timeout)).toEqual([4000, 6000, 0]);
  });

  it("drops shows bound to a previous scope generation", () => {
    const { store, upserts, dismissed } = collect();
    store.setScope("alice");
    const aliceGeneration = store.generation;
    store.show({ id: "old", tone: "info", title: "旧账号提示" }, aliceGeneration);
    store.setScope("bob");
    expect(dismissed).toEqual(["old"]);
    expect(store.show({ tone: "error", title: "迟到的失败" }, aliceGeneration)).toBe(
      "",
    );
    expect(upserts).toHaveLength(1);
    expect(store.show({ tone: "info", title: "新账号提示" }, store.generation)).not.toBe(
      "",
    );
    expect(store.entries.map((entry) => entry.title)).toEqual(["新账号提示"]);
  });

  it("does not advance the generation for the initial scope", () => {
    const { store } = collect();
    const initial = store.generation;
    store.setScope("anonymous");
    expect(store.generation).toBe(initial);
    store.setScope("anonymous");
    expect(store.generation).toBe(initial);
    store.setScope("alice");
    expect(store.generation).toBe(initial + 1);
  });

  it("closes a notice and reports the dismissal once", () => {
    const { store, dismissed } = collect();
    store.setScope("alice");
    store.show({ id: "glyphs", tone: "error", title: "缺少字形" }, 0);
    store.close("glyphs");
    store.close("glyphs");
    expect(dismissed).toEqual(["glyphs"]);
    expect(store.entries).toHaveLength(0);
  });
});
