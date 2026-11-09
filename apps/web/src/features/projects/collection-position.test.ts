import { describe, it, expect } from "vitest";
import {
  emptyPosition,
  readPosition,
  lastValidPage,
  collectionIdentity,
  canCorrectPage,
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
    expect(lastValidPage({ page: 3, rows: 8, total: 49, pageSize: 24 })).toBe(
      3,
    );
    expect(lastValidPage({ page: 2, rows: 1, total: 25, pageSize: 24 })).toBe(
      2,
    );
  });
  it("falls back to the last full page when an empty page proves the end", () => {
    expect(lastValidPage({ page: 3, rows: 0, total: 24, pageSize: 24 })).toBe(
      1,
    );
    expect(lastValidPage({ page: 2, rows: 0, total: 0, pageSize: 24 })).toBe(1);
    expect(lastValidPage({ page: 4, rows: 0, total: 100, pageSize: 24 })).toBe(
      3,
    );
  });
  it("never leaves page one behind", () => {
    expect(lastValidPage({ page: 1, rows: 0, total: 0, pageSize: 24 })).toBe(1);
  });
});

/* FP-09 / Ruling 106. A page may only be corrected from a successful, settled
   reply that belongs to the exact query identity currently on screen. react-query
   keeps the previous `data` after a failed refetch, so an error must veto the
   correction; a late reply from an old account/filter/page has a stale identity
   and must not overwrite the position. */
describe("collection page correction gate", () => {
  const identity = collectionIdentity({
    userId: "u1",
    trash: false,
    keyword: "风景",
    page: 2,
  });
  const settled = {
    isSuccess: true,
    isError: false,
    fetchStatus: "idle" as const,
    resultIdentity: identity,
    viewIdentity: identity,
  };

  it("builds one identity from the account, trash, keyword and page", () => {
    expect(identity).toBe("u1|0|风景|2");
    expect(
      collectionIdentity({ userId: "u2", trash: true, keyword: "", page: 1 }),
    ).toBe("u2|1||1");
    expect(
      collectionIdentity({
        userId: "u1",
        trash: false,
        keyword: "风景",
        page: 2,
      }),
    ).toBe(
      collectionIdentity({
        userId: "u1",
        trash: false,
        keyword: "风景",
        page: 2,
      }),
    );
  });

  it("allows correction only for a settled success of the current identity", () => {
    expect(canCorrectPage(settled)).toBe(true);
  });

  it("skips a failed refetch even though react-query kept the old data", () => {
    expect(canCorrectPage({ ...settled, isError: true })).toBe(false);
    expect(
      canCorrectPage({ ...settled, isSuccess: false, isError: true }),
    ).toBe(false);
  });

  it("skips a reply that has not finished (pending or fetching)", () => {
    expect(canCorrectPage({ ...settled, fetchStatus: "fetching" })).toBe(false);
    expect(canCorrectPage({ ...settled, isSuccess: false })).toBe(false);
  });

  it("skips a late reply from an old account, filter or page", () => {
    expect(
      canCorrectPage({
        ...settled,
        resultIdentity: collectionIdentity({
          userId: "u1",
          trash: false,
          keyword: "",
          page: 2,
        }),
      }),
    ).toBe(false);
    expect(canCorrectPage({ ...settled, resultIdentity: "u1|0|风景|1" })).toBe(
      false,
    );
  });
});
