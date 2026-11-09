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

/**
 * One string that pins a list reply to the exact view that asked for it: the
 * account, the trash/collection switch, the running keyword and the page. A
 * late reply from an older account, filter or page carries a different identity
 * and must never move the position that is currently on screen.
 */
export function collectionIdentity(input: {
  userId: string;
  trash: boolean;
  keyword: string;
  page: number;
}): string {
  return `${input.userId}|${input.trash ? 1 : 0}|${input.keyword}|${input.page}`;
}

/**
 * FP-09 / Ruling 106. A page may only be corrected from a successful, fully
 * settled reply that belongs to the exact query identity currently on screen.
 * react-query keeps the previous `data` after a failed refetch, so an error
 * vetoes the correction; a reply still in flight is not finished data; a late
 * reply from an old identity must not overwrite the position.
 */
export function canCorrectPage(state: {
  isSuccess: boolean;
  isError: boolean;
  fetchStatus: string;
  resultIdentity: string;
  viewIdentity: string;
}): boolean {
  return (
    state.isSuccess &&
    !state.isError &&
    state.fetchStatus === "idle" &&
    state.resultIdentity === state.viewIdentity
  );
}
