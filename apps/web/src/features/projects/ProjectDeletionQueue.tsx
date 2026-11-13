import { Card, Tag } from "antd";
import type { ProjectDeletionDTO } from "@fastposter/api-client";
import { ProjectDeletionStatus } from "@fastposter/ui";
import { Pagination } from "antd";
import { DELETION_PAGE_SIZE } from "./useProjectDeletion";

type Props = {
  tasks: ProjectDeletionDTO[];
  total: number;
  page: number;
  onPage: (page: number) => void;
  onRetry: (taskId: string) => void;
  busy: boolean;
};

export function ProjectDeletionQueue({
  tasks,
  total,
  page,
  onPage,
  onRetry,
  busy,
}: Props) {
  if (tasks.length === 0) return null;
  return (
    <section className="deletion-queue" aria-label="待清理作品">
      <div className="deletion-queue-head">
        <div>
          <h2>
            待清理作品
            <Tag>{total}</Tag>
          </h2>
          <p>作品已不可恢复，文件清理会在后台继续，离开页面不影响。</p>
        </div>
      </div>
      <div className="deletion-queue-list">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className="deletion-queue-item"
            data-testid="deletion-task"
          >
            <div className="deletion-queue-info">
              <h3>{task.title || "已删除作品"}</h3>
              <p>
                {task.width && task.height
                  ? `${task.width} × ${task.height} · `
                  : ""}
                {new Intl.DateTimeFormat("zh-CN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(task.deletedAt ?? task.createdAt))}{" "}
                删除
              </p>
              <small>作品 ID：{task.projectId}</small>
            </div>
            <ProjectDeletionStatus
              deletion={task}
              onRetry={() => onRetry(task.id)}
              busy={busy}
            />
          </Card>
        ))}
      </div>
      {total > DELETION_PAGE_SIZE && (
        <nav className="gallery-pager" aria-label="待清理作品分页">
          <Pagination
            current={page}
            pageSize={DELETION_PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={onPage}
          />
        </nav>
      )}
    </section>
  );
}
