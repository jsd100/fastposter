/**
 * Where the gallery stood when the account last looked at it, so returning from
 * the editor puts the same list back on screen. Held for the browser session
 * only: leaving, a stale session, or another account starts a clean one.
 */
export type CollectionPosition = {
  userId: string;
  trash: boolean;
  /** What is in the search box, including an uncommitted debounced word. */
  search: string;
  /** What the running query actually filtered by. */
  keyword: string;
  page: number;
  deletionPage: number;
  scrollTop: number;
};

export function emptyPosition(userId: string): CollectionPosition {
  return {
    userId,
    trash: false,
    search: "",
    keyword: "",
    page: 1,
    deletionPage: 1,
    scrollTop: 0,
  };
}

/**
 * The saved position, but only when it belongs to this account. A null return
 * is the caller's signal to start from `emptyPosition`.
 */
export function readPosition(
  saved: CollectionPosition | null,
  userId: string,
): CollectionPosition | null {
  return saved && saved.userId === userId ? saved : null;
}

/**
 * The page to ask the server for once a result has arrived. Rows mean the page
 * was real; an empty page above the first only happens after the last page
 * shrank, so fall back one page at a time and never below the first.
 */
export function lastValidPage(input: {
  page: number;
  rows: number;
  total: number;
  pageSize: number;
}): number {
  if (input.page <= 1) return 1;
  if (input.rows > 0) return input.page;
  const lastFull = Math.ceil(input.total / input.pageSize);
  return Math.max(1, Math.min(input.page - 1, lastFull));
}
