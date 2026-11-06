import { Modal } from "antd";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { registerModalLayer } from "./modal-layer";

export function Dialog({
  title,
  children,
  onClose,
  className = "",
  align = "center",
  closable = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  align?: "center" | "bottom";
  /**
   * Hide the corner X when the dialog already offers its own labelled close
   * action. Two controls called 关闭 in one dialog read as one ambiguous button.
   */
  closable?: boolean;
}): ReactElement {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Set the marker during the commit so portalled children can find their
  // container before their own passive effects run.
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    node.setAttribute("data-fp-overlay", "");
    setPanel(node);
  }, []);

  useLayoutEffect(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    return () => {
      const target = opener.current;
      if (!target) return;
      // Callers unmount the dialog as soon as they close it, which skips the
      // dialog library's own delayed focus restore. Restore after that commit.
      queueMicrotask(() => {
        if (target.isConnected) target.focus({ preventScroll: true });
      });
    };
  }, []);

  useLayoutEffect(() => {
    if (!panel) return;
    return registerModalLayer(panel);
  }, [panel]);

  return (
    <Modal
      open
      title={title}
      footer={null}
      closable={closable}
      centered={align === "center"}
      scrollLock
      width="var(--fp-dialog-width, min(420px, calc(100vw - 32px)))"
      onCancel={onClose}
      className={`dialog ${className}`.trim()}
      panelRef={attachPanel}
    >
      {children}
    </Modal>
  );
}
