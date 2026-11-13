import type { CatalogReply, ResourceDTO } from "./generated";

/* FP-10 / Ruling 133. A category tree or dropdown is only ever built from a
   COMPLETE paging read. The caller binds its own public/admin route, account,
   kind and signal; this function fixes the page size at the server limit and
   turns every inconsistency into a single retryable error. A partial tree is
   never returned. */

export type CatalogPagesErrorCode =
  | "PAGE_FETCH_FAILED"
  | "UNSTABLE_TOTAL"
  | "EARLY_EMPTY_PAGE"
  | "COUNT_MISMATCH"
  | "TOO_MANY_PAGES";

export class CatalogPagesError extends Error {
  readonly name = "CatalogPagesError";
  readonly retryable = true;
  constructor(
    readonly code: CatalogPagesErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export const CATALOG_PAGE_SIZE = 100;

export async function loadCatalogPages(
  fetchPage: (page: number, pageSize: number) => Promise<CatalogReply>,
): Promise<ResourceDTO[]> {
  const rows: ResourceDTO[] = [];
  const seen = new Set<string>();
  let total = 0;
  let fetched = 0;
  for (let page = 1; ; page++) {
    // Hard ceiling: Math.ceil(total / pageSize) + 1 pages, no infinite loop.
    if (page > Math.ceil(total / CATALOG_PAGE_SIZE) + 1)
      throw new CatalogPagesError(
        "TOO_MANY_PAGES",
        "分类分页超出安全上限，请重新加载",
      );
    let reply: CatalogReply;
    try {
      reply = await fetchPage(page, CATALOG_PAGE_SIZE);
    } catch (e) {
      throw new CatalogPagesError("PAGE_FETCH_FAILED", "读取分类分页失败", e);
    }
    if (page === 1) {
      total = reply.total;
      // A legitimately empty catalog is not an error.
      if (total === 0 || reply.resources.length === 0) return [];
    } else {
      if (reply.total !== total)
        throw new CatalogPagesError(
          "UNSTABLE_TOTAL",
          "分类总数在分页间发生变化，请重新加载",
        );
      if (reply.resources.length === 0)
        throw new CatalogPagesError(
          "EARLY_EMPTY_PAGE",
          "未读完分类就遇到空页，请重新加载",
        );
    }
    fetched += reply.resources.length;
    for (const resource of reply.resources) {
      if (seen.has(resource.id)) continue; // keep the first occurrence
      seen.add(resource.id);
      rows.push(resource);
    }
    if (fetched >= total) break;
  }
  if (rows.length !== total)
    throw new CatalogPagesError(
      "COUNT_MISMATCH",
      "去重后分类数量与总数不一致，请重新加载",
    );
  return rows;
}
