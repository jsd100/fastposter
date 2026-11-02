import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import type { ReactElement } from "react";
import buttonStyles from "./Button.module.css";
import { Tooltip } from "./Tooltip";
import type { ButtonProps } from "./Button";

export type ToggleButtonProps = Omit<
  ButtonProps,
  "onChange" | "value" | "defaultValue"
> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  tooltip?: string;
};

export function ToggleButton({
  pressed,
  onPressedChange,
  tooltip,
  variant = "secondary",
  busy,
  density = "normal",
  className = "",
  children,
  disabled,
  type,
  ref,
  ...props
}: ToggleButtonProps): ReactElement {
  const button = (
    <TogglePrimitive
      {...props}
      ref={ref}
      type={type ?? "button"}
      pressed={pressed}
      onPressedChange={(next) => onPressedChange(next)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-fp-control=""
      className={`button button-${variant}${
        density === "compact" ? " " + buttonStyles.compact : ""
      } ${className}`}
    >
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </TogglePrimitive>
  );
  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}
