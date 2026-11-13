import { Card, Empty, Tag } from "antd";
import { Pencil } from "lucide-react";
import type { ResourceDTO } from "@fastposter/api-client";
import { Button, LoadingState, Status } from "@fastposter/ui";
import { listState } from "../catalog-state";

export function CopyList({
  resources,
  loading,
  failed,
  busy,
  onEdit,
  onToggle,
}: {
  resources: ResourceDTO[];
  loading: boolean;
  failed: boolean;
  busy: string;
  onEdit: (copy: ResourceDTO) => void;
  onToggle: (copy: ResourceDTO) => void;
}) {
  // "Nothing here" only means something once the request came back; a failed
  // list keeps its own notice inside this container.
  const state = listState({
    pending: loading,
    failed,
    rows: resources.length,
  });
  if (state === "loading") return <LoadingState label="正在加载文案…" />;
  if (state === "failed")
    return <Status tone="error">文案加载失败。请重试，或检查服务状态。</Status>;
  if (state === "empty")
    return (
      <Empty className="admin-empty" description="还没有文案">
        <p>在上方选择分类后新建文案，发布后用户即可在创作空间插入。</p>
      </Empty>
    );
  return (
    <div className="copy-list">
      {resources.map((copy) => (
        <Card className="copy-card" data-testid="copy-card" key={copy.id}>
          <div className="copy-card-body">
            <h3>{copy.title}</h3>
            <p>{copy.body}</p>
          </div>
          <div className="copy-card-side">
            <Tag
              className="resource-state"
              color={copy.published ? "success" : undefined}
            >
              {copy.published ? "已发布" : "已下架"}
            </Tag>
            <div className="copy-card-actions">
              <Button variant="link" onClick={() => onEdit(copy)}>
                <Pencil size={14} />
                编辑
              </Button>
              <Button
                variant={copy.published ? "secondary" : "primary"}
                disabled={busy === copy.id}
                onClick={() => onToggle(copy)}
              >
                {copy.published ? "下架" : "发布"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
