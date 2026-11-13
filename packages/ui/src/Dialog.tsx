import { Modal } from "antd";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { registerModalLayer, restoreLayerFocus } from "./modal-layer";

export function Dialog({
  title,
  children,
  onClose,
  className = "",
  align = "center",
  closable = true,
  restoreFocusTo,
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
  /** Stable entry to focus when a source swap removed the original trigger. */
  restoreFocusTo?: () => HTMLElement | null;
}): ReactElement {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restoreRef = useRef(restoreFocusTo);
  restoreRef.current = restoreFocusTo;
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
    return () => restoreLayerFocus(opener.current, restoreRef.current);
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
      width="var(--fp-dialog-width, 520px)"
      onCancel={onClose}
      className={`dialog ${className}`.trim()}
      panelRef={attachPanel}
    >
      {children}
    </Modal>
  );
}
