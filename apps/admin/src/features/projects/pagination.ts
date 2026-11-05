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
