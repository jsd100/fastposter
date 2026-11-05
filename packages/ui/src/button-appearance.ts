import type { ButtonProps as AntButtonProps } from "antd";
import { createElement, type ReactElement } from "react";

export type SharedVariant = "primary" | "secondary" | "ghost" | "danger";
export type SharedDensity = "normal" | "compact";

/**
 * Maps the package's own variant names onto antd's colour and variant tokens so
 * callers keep writing `variant="ghost"` while antd owns the appearance.
 */
export function antdAppearance(variant: SharedVariant): {
  type: AntButtonProps["type"];
  danger?: true;
} {
  switch (variant) {
    case "primary":
      return { type: "primary" };
    case "ghost":
      return { type: "text" };
    case "danger":
      return { type: "primary", danger: true };
    default:
      return { type: "default" };
  }
}

/** Compact density is antd's small size; normal inherits the 36px seed token. */
export function antdSize(density: SharedDensity): AntButtonProps["size"] {
  return density === "compact" ? "small" : undefined;
}

/**
 * A busy control is disabled and shows the package spinner. antd's own loading
 * icon is `role="img" aria-label="loading"`, which would append English noise to
 * every accessible name, so the icon slot carries the hidden spinner instead.
 */
export function busySpinner(): ReactElement {
  return createElement("span", { className: "spinner", "aria-hidden": true });
}

export function busyLoading() {
  return { icon: busySpinner() };
}
