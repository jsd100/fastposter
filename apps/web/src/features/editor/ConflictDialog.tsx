import { Button, Dialog } from "@fastposter/ui";
export function ConflictDialog({
  busy,
  onCloud,
  onCopy,
}: {
  busy: boolean;
  onCloud: () => void;
  onCopy: () => void;
}) {
  return (
    <Dialog title="作品版本冲突" onClose={() => {}}>
      <p>这张作品已在其他窗口或设备更新。本地修改已保留，请选择如何继续。</p>
      <div className="conflict-actions">
        <Button disabled={busy} onClick={onCloud}>
          加载云端版本
        </Button>
        <Button variant="primary" busy={busy} onClick={onCopy}>
          将本地另存为作品
        </Button>
      </div>
    </Dialog>
  );
}
