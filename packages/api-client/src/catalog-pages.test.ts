import { describe, expect, it, vi } from "vitest";
import { CatalogPagesError, loadCatalogPages } from "./catalog-pages";
import type { CatalogReply, ResourceDTO } from "./generated";

/* FP-10 / A09.1. A catalog tree is only ever built from a COMPLETE paging
   read. Any unstable total, early empty page, duplicate-driven count mismatch,
   failed page or runaway loop must surface as a retryable CatalogPagesError;
   a partial tree must never be handed to a group tree or a dropdown. */

const PAGE_SIZE = 100;

function row(id: string, patch: Partial<ResourceDTO> = {}): ResourceDTO {
  return {
    id,
    kind: "copy-category",
    title: id,
    sortOrder: 0,
    published: true,
    version: "1",
    ...patch,
  };
}

function reply(
  resources: ResourceDTO[],
  total: number = resources.length,
): CatalogReply {
  return { requestId: "unit-test", resources, total };
}

function pages(...list: CatalogReply[]) {
  return vi.fn(async (page: number, _pageSize: number) => {
    const found = list[page - 1];
    if (!found) throw new Error(`unexpected page ${page}`);
    return found;
  });
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  return undefined;
}

const firstHundred = () =>
  Array.from({ length: PAGE_SIZE }, (_, i) => row(`c-${i}`));

describe("loadCatalogPages", () => {
  it("reads two pages with a fixed page size of 100", async () => {
    const fetchPage = pages(
      reply(firstHundred(), 101),
      reply([row("c-100")], 101),
    );
    const result = await loadCatalogPages(fetchPage);
    expect(result).toHaveLength(101);
    expect(result[0].id).toBe("c-0");
    expect(result[100].id).toBe("c-100");
    expect(fetchPage.mock.calls).toEqual([
      [1, PAGE_SIZE],
      [2, PAGE_SIZE],
    ]);
  });

  it("wraps a failed page as a retryable error with its cause", async () => {
    const cause = new Error("network down");
    const fetchPage = vi.fn(async () => {
      throw cause;
    });
    const error = await caught(loadCatalogPages(fetchPage));
    expect(error).toBeInstanceOf(CatalogPagesError);
    expect(error).toMatchObject({
      name: "CatalogPagesError",
      code: "PAGE_FETCH_FAILED",
      retryable: true,
    });
    expect((error as CatalogPagesError).cause).toBe(cause);
  });

  it("never returns partial rows when a later page fails", async () => {
    const fetchPage = vi.fn(async (page: number) => {
      if (page === 1) return reply(firstHundred(), 101);
      throw new Error("page 2 failed");
    });
    await expect(loadCatalogPages(fetchPage)).rejects.toMatchObject({
      code: "PAGE_FETCH_FAILED",
      retryable: true,
    });
  });

  it("rejects an unstable total on a later page", async () => {
    const fetchPage = pages(
      reply(firstHundred(), 101),
      reply([row("c-100")], 200),
    );
    await expect(loadCatalogPages(fetchPage)).rejects.toMatchObject({
      code: "UNSTABLE_TOTAL",
      retryable: true,
    });
  });

  it("deduplicates by id and rejects a count mismatch", async () => {
    // total says 3 but a duplicate id leaves only 2 distinct rows.
    const fetchPage = pages(reply([row("A"), row("A"), row("B")], 3));
    await expect(loadCatalogPages(fetchPage)).rejects.toMatchObject({
      code: "COUNT_MISMATCH",
      retryable: true,
    });
  });

  it("deduplicates across pages keeping the first occurrence", async () => {
    const original = row("c-0", { title: "first" });
    const first = firstHundred();
    first[0] = original;
    const fetchPage = pages(
      reply(first, 101),
      reply([row("c-0", { title: "duplicate" }), row("c-100")], 101),
    );
    const result = await loadCatalogPages(fetchPage);
    expect(result).toHaveLength(101);
    expect(result.filter((r) => r.id === "c-0")).toHaveLength(1);
    expect(result[0].title).toBe("first");
  });

  it("rejects an early empty page before reaching total", async () => {
    const fetchPage = pages(reply(firstHundred(), 101), reply([], 101));
    await expect(loadCatalogPages(fetchPage)).rejects.toMatchObject({
      code: "EARLY_EMPTY_PAGE",
      retryable: true,
    });
  });

  it("returns an empty array for an empty catalog", async () => {
    const zero = pages(reply([], 0));
    await expect(loadCatalogPages(zero)).resolves.toEqual([]);
    const emptyFirst = pages(reply([], 5));
    await expect(loadCatalogPages(emptyFirst)).resolves.toEqual([]);
    expect(zero).toHaveBeenCalledTimes(1);
    expect(emptyFirst).toHaveBeenCalledTimes(1);
  });

  it("stops at the hard page ceiling", async () => {
    const fetchPage = vi.fn(async () => reply([row("tiny")], 250));
    await expect(loadCatalogPages(fetchPage)).rejects.toMatchObject({
      code: "TOO_MANY_PAGES",
      retryable: true,
    });
    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(
      Math.ceil(250 / PAGE_SIZE) + 1,
    );
  });
});
