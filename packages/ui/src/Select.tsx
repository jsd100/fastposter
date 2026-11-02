import { Select as SelectPrimitive } from "@base-ui/react/select";
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import styles from "./Select.module.css";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SelectProps<T extends string | number> = {
  options: readonly SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  density?: "normal" | "compact";
  ref?: Ref<HTMLButtonElement>;
};

export function Select<T extends string | number>({
  options,
  value,
  onValueChange,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  disabled,
  required,
  className = "",
  density = "normal",
  ref,
}: SelectProps<T>): ReactElement {
  const internal = useRef<HTMLButtonElement | null>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>();
  useEffect(() => {
    const anchor = internal.current;
    if (!anchor) return;
    const overlay = anchor.closest<HTMLElement>("[data-fp-overlay]");
    setContainer(overlay ?? undefined);
  }, []);
  const attach = (node: HTMLButtonElement | null) => {
    internal.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  const current = options.find((option) => option.value === value)?.label;
  return (
    <SelectPrimitive.Root
      value={value}
      items={options}
      name={name}
      disabled={disabled}
      required={required}
      modal={false}
      onValueChange={(next) => {
        if (next !== null && next !== value) onValueChange(next as T);
      }}
    >
      <SelectPrimitive.Trigger
        ref={attach}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        title={current}
        className={`select ${styles.trigger}${
          density === "compact" ? ` ${styles.compact}` : ""
        } ${className}`}
      >
        <SelectPrimitive.Value
          className={styles.value}
          data-fp-select-value=""
        />
        <SelectPrimitive.Icon className={styles.icon} aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" focusable="false">
            <path
              d="M2.2 3.9 5 6.5l2.8-2.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Positioner
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className={styles.positioner}
        >
          <SelectPrimitive.Popup className={styles.popup}>
            <SelectPrimitive.List className={styles.list}>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={String(option.value)}
                  value={option.value}
                  disabled={option.disabled}
                  title={option.label}
                  className={styles.item}
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className={styles.indicator}>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 11 11"
                      focusable="false"
                    >
                      <path
                        d="M2.4 5.9 4.5 8 8.6 3.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
