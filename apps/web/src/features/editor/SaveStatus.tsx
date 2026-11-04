import type { SaveStatus as Status } from "./autosave";
export function SaveStatus({ status }: { status: Status }) {
  return (
    <span className="saved-label" role="status">
      {
        {
          saved: "已保存",
          dirty: "待保存",
          saving: "保存中…",
          blocked: "正在编辑或上传…",
          offline: "离线 · 草稿已保留",
          conflict: "版本冲突 · 草稿已保留",
          error: "保存失败 · 请重试",
          deleted: "作品已删除 · 保存已停止",
        }[status]
      }
    </span>
  );
}
