import {
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  hasPopupLayer,
  hasVisiblePopup,
  registerModalLayer,
  restoreLayerFocus,
  topModalLayer,
} from "./modal-layer";

let workbenchHost: HTMLElement | null = null;

/** One stable host beside the app root, reused like the shared notice layer. */
function getWorkbenchHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (!workbenchHost) {
    workbenchHost = document.createElement("div");
    workbenchHost.setAttribute("data-fp-workbench-host", "");
    document.body.appendChild(workbenchHost);
  }
  return workbenchHost;
}

export type WorkbenchProps = {
  /** Accessible name of the container. Pages keep their own labelled close action. */
  label: string;
  className?: string;
  children: ReactNode;
  /** Stable list entry to focus when the opener was removed while open. */
  restoreFocusTo?: () => HTMLElement | null;
};

/**
 * A full-screen container that hosts an editor instead of interrupting it.
 *
 * It renders into a host beside the app root and takes that root out of the
 * tab order, so the list and sidebar behind it cannot be focused. Tab cycles
 * within the workbench; a nested dialog or portalled popup owns the keyboard
 * and pauses that cycle. It registers with `blocksShortcuts: false` because
 * undo, redo and delete belong to the canvas inside, and it carries no
 * `data-fp-overlay` marker for the same reason. Escape is deliberately not
 * bound: closing work in progress stays an explicit action the page offers.
 */
export function Workbench({
  label,
  className = "",
  children,
  restoreFocusTo,
}: WorkbenchProps): ReactElement {
  const root = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const restoreRef = useRef(restoreFocusTo);
  restoreRef.current = restoreFocusTo;

  // Capture the trigger before isolation makes the browser drop its focus,
  // take the app root out of the tab order, then own Tab inside the workbench.
  useLayoutEffect(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
    const appRoot = document.getElementById("root");
    if (appRoot) appRoot.inert = true;
    const node = root.current;
    const release = node
      ? registerModalLayer(node, { blocksShortcuts: false })
      : null;
    if (node) node.focus({ preventScroll: true });

    function trapTab(event: KeyboardEvent) {
      if (!node) return;
      if (event.key !== "Tab" || event.defaultPrevented) return;
      // A dialog above the workbench, or a portalled popup, owns Tab.
      if (topModalLayer() !== node) return;
      if (hasPopupLayer() || hasVisiblePopup()) return;
      const focused = document.activeElement;
      if (focused !== node && !node.contains(focused)) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (focused === node) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trapTab, true);
    return () => {
      document.removeEventListener("keydown", trapTab, true);
      release?.();
      if (appRoot) appRoot.inert = false;
      restoreLayerFocus(opener.current, restoreRef.current);
    };
  }, []);

  const content = (
    <div
      ref={root}
      className={`workbench ${className}`.trim()}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
    >
      {children}
    </div>
  );
  const host = getWorkbenchHost();
  // Static/server rendering has no document: keep the dialog inline so its
  // accessible-name contract still holds there.
  return host ? createPortal(content, host) : content;
}
