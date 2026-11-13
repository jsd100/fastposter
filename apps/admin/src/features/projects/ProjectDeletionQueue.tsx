import { Card, Tag } from "antd";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectMetadataDTO } from "@fastposter/api-client";
import { routes } from "@fastposter/api-client";
import { ProjectDeletionStatus, useErrorNotice } from "@fastposter/ui";
import { errorMessage, request } from "../../api";
import { PAGE_SIZE, RecordPager } from "../records";
import { pageAfterShrink } from "./pagination";

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
            待清理作品<Tag>{total}</Tag>
          </h2>
          <p>作品已不可恢复，文件清理会在后台继续；重试按管理员权限执行。</p>
        </div>
      </div>
      <div className="admin-queue-list">
        {tasks.map((task) => (
          <Card className="admin-queue-item" key={task.id}>
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
          </Card>
        ))}
      </div>
      <RecordPager
        page={page}
        total={total}
        onPage={setPage}
        label="待清理作品分页"
      />
    </section>
  );
}
