import {
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { registerModalLayer } from "./modal-layer";

export type WorkbenchProps = {
  /** Accessible name of the container. Pages keep their own labelled close action. */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * A full-screen container that hosts an editor instead of interrupting it.
 *
 * It joins the shared layer stack so notices route into it and assistive tech
 * announces a named dialog, and it takes the keyboard on open and hands it back
 * to the control that opened it on close. It registers with
 * `blocksShortcuts: false` because undo, redo and delete belong to the canvas
 * inside, and it carries no `data-fp-overlay` marker for the same reason.
 * Escape is deliberately not bound: closing work in progress stays an explicit
 * action the page offers.
 */
export function Workbench({
  label,
  className = "",
  children,
}: WorkbenchProps): ReactElement {
  const root = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const active = document.activeElement;
    opener.current =
      active instanceof HTMLElement && active !== node ? active : null;
    const release = registerModalLayer(node, { blocksShortcuts: false });
    node.focus({ preventScroll: true });
    return () => {
      release();
      const target = opener.current;
      if (!target) return;
      // The page unmounts the workbench as soon as it closes, so restore after
      // that commit instead of handing focus to a detached element.
      queueMicrotask(() => {
        if (target.isConnected) target.focus({ preventScroll: true });
      });
    };
  }, []);

  return (
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
}
