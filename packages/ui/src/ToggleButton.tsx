import { Button as AntButton } from "antd";
import type { MouseEvent, ReactElement } from "react";
import { antdAppearance, antdSize, busyLoading } from "./button-appearance";
import type { ButtonProps } from "./Button";
import { Tooltip } from "./Tooltip";

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
  onClick,
  ref,
  ...props
}: ToggleButtonProps): ReactElement {
  const button = (
    <AntButton
      {...props}
      ref={ref}
      htmlType={type ?? "button"}
      {...antdAppearance(
        pressed && variant === "secondary" ? "primary" : variant,
      )}
      size={antdSize(density)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      loading={busy ? busyLoading() : undefined}
      data-fp-control=""
      className={`button button-${variant} ${className}`}
      onClick={(event: MouseEvent<HTMLElement>) => {
        (onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined)?.(
          event,
        );
        onPressedChange(!pressed);
      }}
    >
      {children}
    </AntButton>
  );
  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}
