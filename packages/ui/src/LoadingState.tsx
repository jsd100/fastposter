import { Spin } from "antd";
import type { ReactElement } from "react";

/**
 * A region-level waiting state. antd owns the loading visual; this wrapper
 * contributes exactly one live status announcement (the phase text), so a
 * screen reader hears the wait once and never an English "loading" from an
 * icon. Errors, success and static / manual-action hints keep using Status.
 */
export function LoadingState({
  label,
  size = "default",
}: {
  label: string;
  size?: "small" | "default" | "large";
}): ReactElement {
  return (
    <div
      className="fp-loading"
      data-fp-loading=""
      role="status"
      aria-busy="true"
    >
      <Spin size={size === "default" ? undefined : size} aria-hidden="true" />
      <span className="fp-loading-label">{label}</span>
    </div>
  );
}
