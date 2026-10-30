import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose} className="bottom-sheet">
      <div className="sheet-content">{children}</div>
    </Dialog>
  );
}
