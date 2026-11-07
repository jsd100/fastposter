import { Select as AntSelect } from "antd";
import { useEffect, useRef, type ReactElement } from "react";
import { registerPopupLayer } from "./modal-layer";
import styles from "./Select.module.css";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
  swatch?: string;
};

export type SelectProps<T extends string | number> = {
  options: readonly SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
  /** Trigger text used when `value` is not one of `options`; keeps `options` stable. */
  valueLabel?: string;
  className?: string;
  density?: "normal" | "compact";
};

export function Select<T extends string | number>({
  options,
  value,
  onValueChange,
  valueLabel,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  disabled,
  className = "",
  density = "normal",
}: SelectProps<T>): ReactElement {
  const releasePopup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      releasePopup.current?.();
      releasePopup.current = null;
    },
    [],
  );
  const selected = options.find((option) => option.value === value);
  const current = valueLabel ?? selected?.label ?? String(value);
  return (
    <AntSelect
      value={value}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        disabled: option.disabled,
        title: option.label,
      }))}
      virtual={false}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-fp-control=""
      className={`select ${styles.select}${
        density === "compact" ? ` ${styles.compact}` : ""
      } ${className}`}
      classNames={{ content: styles.content, popup: { root: styles.dropdown } }}
      labelRender={({ label }) => (
        <span className={styles.value} data-fp-select-value="" title={current}>
          {selected?.swatch && (
            <span
              aria-hidden="true"
              className={styles.swatch}
              style={{ backgroundColor: selected.swatch }}
            />
          )}
          {valueLabel ?? (label as string) ?? String(value)}
        </span>
      )}
      optionRender={(option) => {
        const entry = options.find((item) => item.value === option.value);
        return (
          <span className={styles.optionLabel}>
            {entry?.swatch && (
              <span
                aria-hidden="true"
                className={styles.swatch}
                style={{ backgroundColor: entry.swatch }}
              />
            )}
            {option.label}
          </span>
        );
      }}
      onChange={(next) => {
        if (next !== value) onValueChange(next as T);
      }}
      onOpenChange={(open) => {
        if (open) {
          if (!releasePopup.current)
            releasePopup.current = registerPopupLayer();
          return;
        }
        releasePopup.current?.();
        releasePopup.current = null;
      }}
      getPopupContainer={(node) =>
        (node.closest("[data-fp-overlay]") as HTMLElement | null) ??
        document.body
      }
      popupRender={(menu) => (
        <div className={styles.popup} data-fp-popup="">
          {menu}
        </div>
      )}
    />
  );
}
