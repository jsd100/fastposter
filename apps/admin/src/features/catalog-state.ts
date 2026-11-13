/**
 * The four states a catalog container can be in. They are checked in this order
 * because a failed query has no rows and a loading one has never answered: only
 * a query that came back empty lets the page say 暂无 / 还没有.
 */
export function listState(input: {
  pending: boolean;
  failed: boolean;
  rows: number;
}): "loading" | "failed" | "empty" | "ready" {
  if (input.pending) return "loading";
  if (input.failed) return "failed";
  return input.rows === 0 ? "empty" : "ready";
}
