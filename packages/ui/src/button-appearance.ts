import { Spin } from "antd";
import type { ButtonProps as AntButtonProps } from "antd";
import { createElement, type ReactElement } from "react";

export type SharedVariant =
  "primary" | "secondary" | "ghost" | "link" | "danger" | "danger-outline";
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
    case "link":
      return { type: "link" };
    case "danger-outline":
      return { type: "default", danger: true };
    case "danger":
      return { type: "primary", danger: true };
    default:
      return { type: "default" };
  }
}

/** Compact density is antd's small size; normal uses antd's default size. */
export function antdSize(density: SharedDensity): AntButtonProps["size"] {
  return density === "compact" ? "small" : undefined;
}

/**
 * A busy control is disabled and shows an antd loading component in the icon
 * slot. antd's own loading icon is `role="img" aria-label="loading"`, which
 * would append English noise to every accessible name, so a hidden antd Spin
 * takes that slot instead: the loading visual stays antd-owned and the name
 * stays clean.
 */
export function busySpinner(): ReactElement {
  const props = { size: "small" as const, "aria-hidden": true };
  return createElement(Spin, props);
}

export function busyLoading() {
  return { icon: busySpinner() };
}
