import type { ResourceDTO } from "@fastposter/api-client";
import { Button, Status } from "@fastposter/ui";
import { FileText } from "lucide-react";

export function CopyList({
  resources,
  loading,
  busy,
  onEdit,
  onToggle,
}: {
  resources: ResourceDTO[];
  loading: boolean;
  busy: string;
  onEdit: (copy: ResourceDTO) => void;
  onToggle: (copy: ResourceDTO) => void;
}) {
  if (loading) return <Status>正在加载文案…</Status>;
  if (!resources.length)
    return (
      <div className="admin-empty">
        <FileText size={30} />
        <h2>还没有文案</h2>
        <p>在上方选择分类后新建文案，发布后用户即可在创作空间插入。</p>
      </div>
    );
  return (
    <div className="copy-list">
      {resources.map((copy) => (
        <article className="copy-card" data-testid="copy-card" key={copy.id}>
          <div className="copy-card-body">
            <h3>{copy.title}</h3>
            <p>{copy.body}</p>
          </div>
          <div className="copy-card-side">
            <span
              className={
                copy.published ? "resource-state published" : "resource-state"
              }
            >
              {copy.published ? "已发布" : "已下架"}
            </span>
            <div className="copy-card-actions">
              <Button variant="ghost" onClick={() => onEdit(copy)}>
                编辑
              </Button>
              <Button
                variant="ghost"
                disabled={busy === copy.id}
                onClick={() => onToggle(copy)}
              >
                {copy.published ? "下架" : "发布"}
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
