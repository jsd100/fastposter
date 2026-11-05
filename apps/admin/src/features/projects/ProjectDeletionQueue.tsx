import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectMetadataDTO } from "@fastposter/api-client";
import { routes } from "@fastposter/api-client";
import { Button, ProjectDeletionStatus, useErrorNotice } from "@fastposter/ui";
import { errorMessage, request } from "../../api";
import { pageAfterShrink } from "./pagination";

const PAGE_SIZE = 24;
const POLL_INTERVAL = 2000;

export function canPermanentlyDelete(
  project: Pick<ProjectMetadataDTO, "deletedAt">,
) {
  return Boolean(project.deletedAt);
}

export function ProjectDeletionQueue() {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "deletions", page],
    queryFn: () =>
      request(routes.AdminListProjectDeletions, {
        page,
        pageSize: PAGE_SIZE,
      }),
    retry: false,
    refetchInterval: (query) =>
      (query.state.data?.total ?? 0) > 0 ? POLL_INTERVAL : false,
  });
  useErrorNotice("admin:deletions", q.error ? errorMessage(q.error) : null, {
    persistent: true,
    action: { label: "重新加载", onClick: () => void q.refetch() },
  });
  useErrorNotice("admin:deletion-action", actionError || null);
  useEffect(() => {
    if (!q.data) return;
    const next = pageAfterShrink(
      page,
      q.data.total,
      q.data.deletions.length,
      PAGE_SIZE,
    );
    if (next !== page) setPage(next);
  }, [page, q.data]);

  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["admin", "deletions"] }),
      cache.invalidateQueries({ queryKey: ["admin", "projects"] }),
      cache.invalidateQueries({ queryKey: ["admin", "jobs"] }),
      cache.invalidateQueries({ queryKey: ["admin", "overview"] }),
      cache.invalidateQueries({ queryKey: ["admin", "audit"] }),
    ]);
  }

  async function retry(taskId: string) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await request(routes.AdminRetryProjectDeletion, { id: taskId });
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const tasks = q.data?.deletions ?? [];
  const total = q.data?.total ?? 0;
  if (tasks.length === 0) return null;
  return (
    <section className="admin-deletion-queue" aria-label="待清理作品">
      <div className="admin-queue-head">
        <div>
          <h2>
            待清理作品<span className="badge">{total}</span>
          </h2>
          <p>作品已不可恢复，文件清理会在后台继续；重试按管理员权限执行。</p>
        </div>
      </div>
      <div className="admin-queue-list">
        {tasks.map((task) => (
          <article className="admin-queue-item" key={task.id}>
            <div className="admin-queue-info">
              <h3>{task.title || "已删除作品"}</h3>
              <p>
                {task.width && task.height
                  ? `${task.width} × ${task.height} · `
                  : ""}
                用户 {task.ownerId}
              </p>
              <small>作品 ID：{task.projectId}</small>
            </div>
            <ProjectDeletionStatus
              deletion={task}
              busy={busy}
              onRetry={() => void retry(task.id)}
            />
          </article>
        ))}
      </div>
      {total > PAGE_SIZE && (
        <div className="pagination">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span>
            第 {page} 页 · 共 {total} 项
          </span>
          <Button
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </section>
  );
}
