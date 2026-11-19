import { Select as AntSelect, type RefSelectProps } from "antd";
import {
  useLayoutEffect,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { registerPopupLayer } from "./modal-layer";
import styles from "./Select.module.css";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
  swatch?: string;
  group?: string;
  /** Rich option preview; it is hidden from the option's accessible name. */
  preview?: ReactNode;
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
  ref?: Ref<RefSelectProps>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  searchable?: boolean;
  showSelectedPreview?: boolean;
  getPopupContainer?: (node: HTMLElement) => HTMLElement;
};

function groupOptions<T extends string | number>(
  options: readonly SelectOption<T>[],
) {
  type Option = SelectOption<T> & { title: string };
  type Group = { label: string; options: Option[] };
  const groups = new Map<string, Group>();
  const result: (Option | Group)[] = [];
  for (const option of options) {
    const entry = { ...option, title: option.label };
    if (!option.group) {
      result.push(entry);
      continue;
    }
    let group = groups.get(option.group);
    if (!group) {
      group = { label: option.group, options: [] };
      groups.set(option.group, group);
      result.push(group);
    }
    group.options.push(entry);
  }
  return result;
}

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
  ref,
  open: controlledOpen,
  onOpenChange,
  searchable = false,
  showSelectedPreview = false,
  getPopupContainer,
}: SelectProps<T>): ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const menuOpen = controlledOpen ?? internalOpen;
  useLayoutEffect(() => {
    if (menuOpen) return registerPopupLayer();
  }, [menuOpen]);
  const selected = options.find((option) => option.value === value);
  const current = valueLabel ?? selected?.label ?? String(value);
  return (
    <AntSelect
      ref={ref}
      value={value}
      options={groupOptions(options)}
      virtual={false}
      open={controlledOpen}
      showSearch={
        searchable ? { optionFilterProp: ["label", "value"] } : undefined
      }
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-fp-control=""
      size={density === "compact" ? "small" : undefined}
      className={`select ${styles.select} ${className}`}
      labelRender={({ label }) => (
        <span className={styles.value} data-fp-select-value="" title={current}>
          {showSelectedPreview && selected?.preview && (
            <span aria-hidden="true" className={styles.preview}>
              {selected.preview}
            </span>
          )}
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
        const entry = option.data as SelectOption<T>;
        return (
          <span className={styles.optionLabel}>
            {entry?.preview && (
              <span aria-hidden="true" className={styles.preview}>
                {entry.preview}
              </span>
            )}
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
        if (controlledOpen === undefined) setInternalOpen(open);
        onOpenChange?.(open);
      }}
      getPopupContainer={
        getPopupContainer ??
        ((node: HTMLElement) =>
          node.closest<HTMLElement>("[data-fp-overlay]") ?? document.body)
      }
      popupRender={(menu) => (
        <div className={styles.popup} data-fp-popup="">
          {menu}
        </div>
      )}
    />
  );
}
