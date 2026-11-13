import { useState } from "react";
import { Checkbox, Spin } from "antd";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import styles from "./ProjectDeletion.module.css";

export type ProjectDeletionInfo = {
  id: string;
  projectId: string;
  state: string;
  title?: string;
  errorCode?: string;
};

export type ProjectDeletionConfirmProps = {
  project: { id: string; title: string; ownerId?: string };
  admin?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function deletionConfirmDisabled(
  admin: boolean,
  acknowledged: boolean,
  busy: boolean,
): boolean {
  return busy || (admin && !acknowledged);
}

export function ProjectDeletionConfirm({
  project,
  admin = false,
  busy = false,
  onConfirm,
  onClose,
}: ProjectDeletionConfirmProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const disabled = deletionConfirmDisabled(admin, acknowledged, busy);
  return (
    <Dialog
      title="彻底删除作品？"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className={styles.target}>
        <strong>{project.title}</strong>
        <small>
          {admin
            ? `归属用户：${project.ownerId ?? "未知"} · 作品 ID：${project.id}`
            : `作品 ID：${project.id}`}
        </small>
      </div>
      <p>
        作品、全部历史版本及导出记录将被删除，独占的图片和导出文件也会被清理。
      </p>
      <p className={styles.irreversible}>删除后无法恢复。</p>
      <div className={styles.explain}>
        其他作品或资源库仍在使用的图片、字体会保留，不会影响它们正常使用。
      </div>
      {admin && (
        <Checkbox
          className={styles.check}
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        >
          我已确认作品归属，理解此操作会永久删除该用户的作品。
        </Checkbox>
      )}
      <div className="dialog-actions">
        <Button autoFocus onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={disabled}>
          彻底删除
        </Button>
      </div>
    </Dialog>
  );
}

export type ProjectDeletionStatusProps = {
  deletion: ProjectDeletionInfo;
  onRetry?: () => void;
  busy?: boolean;
};

export function ProjectDeletionStatus({
  deletion,
  onRetry,
  busy = false,
}: ProjectDeletionStatusProps) {
  if (deletion.state === "completed")
    return (
      <p className={`${styles.status} ${styles.completed}`} role="status">
        作品及独占资源已彻底删除，共享资源已保留。
      </p>
    );
  if (deletion.state === "retry_wait")
    return (
      <div className={`${styles.status} ${styles.failed}`} role="status">
        <p>作品已删除，部分文件尚未清理。</p>
        <p>系统将继续重试，也可立即重试。</p>
        <Button variant="ghost" density="compact" busy={busy} onClick={onRetry}>
          重试清理
        </Button>
      </div>
    );
  return (
    <div
      className={`${styles.status} ${styles.cleaning}`}
      role="status"
      aria-busy="true"
      data-fp-loading=""
    >
      <Spin size="small" aria-hidden="true" />
      <p>正在清理相关文件…</p>
      <p>作品已不可恢复，你可以离开此页面。</p>
    </div>
  );
}
