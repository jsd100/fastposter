import { Tooltip as AntTooltip } from "antd";
import { useEffect, useState, type ReactElement } from "react";

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}): ReactElement {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      /* The first Escape closes only the hint. Listening in the capture phase
         and stopping here is what keeps it that way: the editor deselects the
         selected block on a bubbling window keydown, and deselecting unmounts
         the very actions the hint describes — so the layer that had the focus
         would swallow nothing and the focus would have nowhere to return to. */
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);
  return (
    <AntTooltip
      /* The hint carries the package marker so the browser tests keep addressing
         the bubble itself; antd owns its frame, ink and placement. */
      title={<div data-fp-tooltip="">{label}</div>}
      placement={side}
      trigger={["hover", "focus"]}
      open={open}
      onOpenChange={setOpen}
      destroyOnHidden
      getPopupContainer={(node) =>
        (node.closest("[data-fp-overlay]") as HTMLElement | null) ??
        document.body
      }
    >
      {children}
    </AntTooltip>
  );
}
