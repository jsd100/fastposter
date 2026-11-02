import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactElement, ReactNode } from "react";
import styles from "./Dialog.module.css";

export function Dialog({
  title,
  children,
  onClose,
  className = "",
  align = "center",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  align?: "center" | "bottom";
}): ReactElement {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <div className={styles.shell}>
          <DialogPrimitive.Backdrop className={styles.backdrop} />
          <DialogPrimitive.Popup
            data-fp-overlay=""
            className={`dialog ${align === "bottom" ? styles.bottom : styles.center} ${className}`}
          >
            <div className="dialog-header">
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                type="button"
                className="icon-button"
                aria-label="关闭"
              >
                ×
              </DialogPrimitive.Close>
            </div>
            {children}
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
