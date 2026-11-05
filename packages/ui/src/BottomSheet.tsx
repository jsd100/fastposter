import { Drawer } from "antd";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  hasPopupLayer,
  hasVisiblePopup,
  registerModalLayer,
} from "./modal-layer";

export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}): ReactElement {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const section =
      node.querySelector<HTMLElement>(".ant-drawer-section") ?? node;
    section.setAttribute("data-fp-overlay", "");
    setPanel(section);
  }, []);

  useLayoutEffect(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    return () => {
      const target = opener.current;
      if (!target) return;
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
    <Drawer
      open
      placement="bottom"
      title={title}
      size="auto"
      closable={{ placement: "end" }}
      onClose={onClose}
      className="bottom-sheet"
      classNames={{ wrapper: "bottom-sheet-wrapper" }}
      panelRef={attachPanel}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (hasPopupLayer() || hasVisiblePopup()) return;
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-content">{children}</div>
    </Drawer>
  );
}
