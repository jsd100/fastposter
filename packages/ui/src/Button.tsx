import { Button as BaseButton } from "@base-ui/react/button";
import type { ButtonHTMLAttributes, Ref } from "react";
import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  density?: "normal" | "compact";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "secondary",
  busy,
  density = "normal",
  children,
  className = "",
  disabled,
  type,
  ref,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-fp-control=""
      className={`button button-${variant}${density === "compact" ? " " + styles.compact : ""} ${className}`}
    >
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </BaseButton>
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
}: ButtonProps & { "aria-label": string }) {
  return (
    <BaseButton
      {...props}
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-fp-control=""
      className={`icon-button${density === "compact" ? " " + styles.compactIcon : ""} ${className}`}
    />
  );
}
