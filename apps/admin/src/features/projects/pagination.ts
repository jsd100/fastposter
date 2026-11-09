// A filtered or shrinking list can leave the current page empty while earlier
// pages still have rows. Fall back to the last page implied by the total; an
// empty page is not proof that the whole list is empty.
export function pageAfterShrink(
  page: number,
  total: number,
  itemCount: number,
  pageSize: number,
): number {
  if (page <= 1 || itemCount > 0) return page;
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
}

/**
 * One string pinning an admin list reply to the query dimensions that asked
 * for it (kind / page / keyword / category / status …). A late reply from an
 * old filter or page has a different identity and must not move the page.
 */
export function adminPageIdentity(parts: readonly (string | number)[]): string {
  return parts.map(String).join("|");
}

/**
 * FP-09 / Ruling 106. Admin lists share the same rule: only a successful,
 * settled result for the current query identity may correct the page. A failed
 * refetch keeps react-query's previous `data`, so the error must veto it.
 */
export function canCorrectAdminPage(state: {
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
