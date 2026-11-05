import { Button as AntButton } from "antd";
import type { ButtonHTMLAttributes, Ref } from "react";
import { antdAppearance, antdSize, busyLoading } from "./button-appearance";

/**
 * `color` is dropped from the inherited HTML attributes because antd owns that
 * prop name for its own palette; every other button attribute stays as it was.
 */
export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  density?: "normal" | "compact";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "secondary",
  busy,
  density = "normal",
  className = "",
  disabled,
  type,
  ref,
  ...props
}: ButtonProps) {
  return (
    <AntButton
      {...props}
      ref={ref}
      htmlType={type ?? "button"}
      {...antdAppearance(variant)}
      size={antdSize(density)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      loading={busy ? busyLoading() : undefined}
      data-fp-control=""
      className={`button button-${variant} ${className}`}
    />
  );
}

export function IconButton({
  busy,
  density = "normal",
  className = "",
  disabled,
  type,
  ref,
  ...props
}: Omit<ButtonProps, "variant"> & { "aria-label": string }) {
  return (
    <AntButton
      {...props}
      ref={ref}
      htmlType={type ?? "button"}
      type="text"
      size={antdSize(density)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      loading={busy ? busyLoading() : undefined}
      data-fp-control=""
      className={`icon-button ${className}`}
    />
  );
}
