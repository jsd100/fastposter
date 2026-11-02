import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";
import styles from "./Tooltip.module.css";

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}): ReactElement {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side}
          sideOffset={6}
          className={styles.positioner}
        >
          <TooltipPrimitive.Popup
            data-fp-tooltip=""
            className={styles.popup}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
