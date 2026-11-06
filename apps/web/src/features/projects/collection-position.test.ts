import { describe, it, expect } from "vitest";
import {
  emptyPosition,
  readPosition,
  lastValidPage,
  type CollectionPosition,
} from "./collection-position";

const saved: CollectionPosition = {
  userId: "u1",
  trash: true,
  search: "旅行",
  keyword: "旅行",
  page: 3,
  deletionPage: 2,
  scrollTop: 480,
};

describe("collection position", () => {
  it("starts clean for an account with nothing saved", () => {
    expect(emptyPosition("u2")).toEqual({
      userId: "u2",
      trash: false,
      search: "",
      keyword: "",
      page: 1,
      deletionPage: 1,
      scrollTop: 0,
    });
  });
  it("keeps the position saved by the same account", () => {
    expect(readPosition(saved, "u1")).toEqual(saved);
  });
  it("drops a position that belongs to another account", () => {
    expect(readPosition(saved, "u2")).toBeNull();
    expect(readPosition(null, "u1")).toBeNull();
  });
  it("keeps the page while the server still returns rows", () => {
    expect(
      lastValidPage({ page: 3, rows: 8, total: 49, pageSize: 24 }),
    ).toBe(3);
    expect(
      lastValidPage({ page: 2, rows: 1, total: 25, pageSize: 24 }),
    ).toBe(2);
  });
  it("falls back to the last full page when an empty page proves the end", () => {
    expect(lastValidPage({ page: 3, rows: 0, total: 24, pageSize: 24 })).toBe(1);
    expect(lastValidPage({ page: 2, rows: 0, total: 0, pageSize: 24 })).toBe(1);
    expect(lastValidPage({ page: 4, rows: 0, total: 100, pageSize: 24 })).toBe(3);
  });
  it("never leaves page one behind", () => {
    expect(lastValidPage({ page: 1, rows: 0, total: 0, pageSize: 24 })).toBe(1);
  });
});
