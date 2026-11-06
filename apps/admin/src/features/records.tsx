import { Pagination } from "antd";
import type { ReactElement, ReactNode } from "react";

/**
 * Shared shape for the four record pages. The API paginates server-side at 24
 * rows, the table key is always the record ID, and the pager only exists while
 * a second page actually came back — a list that shrank to one page has no
 * next-page control to click.
 */
export const PAGE_SIZE = 24;

export function NoRecords() {
  return <p className="admin-empty">暂无记录</p>;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

/**
 * "Nothing here" is a claim about data that actually arrived, so the empty slot
 * stays quiet while a query is loading and while it failed — those states have
 * their own spinner and their own error notice.
 */
export function emptyText(arrived: boolean) {
  return arrived ? (
    <NoRecords />
  ) : (
    <span className="admin-empty" aria-hidden="true" />
  );
}

export function RecordPager({
  page,
  total,
  onPage,
  label,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}): ReactElement | null {
  if (total <= PAGE_SIZE) return null;
  return (
    <Pagination
      className="admin-pagination"
      aria-label={label}
      current={page}
      total={total}
      pageSize={PAGE_SIZE}
      showSizeChanger={false}
      onChange={onPage}
    />
  );
}

/** One labelled block that holds either the desktop table or the phone list. */
export function RecordSection({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-records" aria-label={name}>
      {children}
    </section>
  );
}
