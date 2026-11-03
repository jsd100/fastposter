import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./Combobox.module.css";

export type ComboboxOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

type ComboboxGroup = { value: string; items: ComboboxOption[] };

export type ComboboxProps = {
  value: string;
  options: readonly ComboboxOption[];
  onValueChange: (value: string) => void;
  onHighlightChange?: (value: string | null) => void;
  "aria-label": string;
  preview?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  value,
  options,
  onValueChange,
  onHighlightChange,
  "aria-label": ariaLabel,
  preview,
  placeholder = "搜索",
  disabled,
  className = "",
}: ComboboxProps): ReactElement {
  const input = useRef<HTMLInputElement | null>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>();
  useEffect(() => {
    const anchor = input.current;
    if (!anchor) return;
    const overlay = anchor.closest<HTMLElement>("[data-fp-overlay]");
    setContainer(overlay ?? undefined);
  }, []);
  const selected = options.find((option) => option.value === value) ?? null;
  const groups = useMemo(() => {
    const result: ComboboxGroup[] = [];
    for (const option of options) {
      const name = option.group ?? "";
      const group = result.find((candidate) => candidate.value === name);
      if (group) group.items.push(option);
      else result.push({ value: name, items: [option] });
    }
    return result;
  }, [options]);
  return (
    <ComboboxPrimitive.Root<ComboboxOption, false, ComboboxOption>
      items={groups}
      value={selected}
      disabled={disabled}
      modal={false}
      autoHighlight={false}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      isItemEqualToValue={(item, current) => item.value === current.value}
      onValueChange={(next) => {
        if (next && next.value !== value) onValueChange(next.value);
      }}
      onItemHighlighted={(item) => onHighlightChange?.(item ? item.value : null)}
    >
      <ComboboxPrimitive.InputGroup className={styles.group}>
        <ComboboxPrimitive.Input
          ref={input}
          aria-label={ariaLabel}
          placeholder={placeholder}
          disabled={disabled}
          data-fp-control=""
          className={`select ${styles.input} ${className}`}
        />
        <ComboboxPrimitive.Icon className={styles.icon} aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" focusable="false">
            <path
              d="M2.2 3.9 5 6.5l2.8-2.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </ComboboxPrimitive.Icon>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal container={container}>
        <ComboboxPrimitive.Positioner
          align="start"
          sideOffset={6}
          className={styles.positioner}
        >
          <ComboboxPrimitive.Popup className={styles.popup} data-fp-popup="">
            {preview}
            <ComboboxPrimitive.List className={styles.list}>
              {(group: ComboboxGroup) => (
                <ComboboxPrimitive.Group
                  key={group.value}
                  items={group.items}
                  className={styles.groupSection}
                >
                  {group.value ? (
                    <ComboboxPrimitive.GroupLabel className={styles.groupLabel}>
                      {group.value}
                    </ComboboxPrimitive.GroupLabel>
                  ) : null}
                  <ComboboxPrimitive.Collection>
                    {(item: ComboboxOption) => (
                      <ComboboxPrimitive.Item
                        key={item.value}
                        value={item}
                        disabled={item.disabled}
                        className={styles.item}
                      >
                        <span className={styles.itemText}>{item.label}</span>
                        <ComboboxPrimitive.ItemIndicator
                          className={styles.indicator}
                        >
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
                        </ComboboxPrimitive.ItemIndicator>
                      </ComboboxPrimitive.Item>
                    )}
                  </ComboboxPrimitive.Collection>
                </ComboboxPrimitive.Group>
              )}
            </ComboboxPrimitive.List>
            <ComboboxPrimitive.Empty className={styles.empty}>
              没有匹配的字体
            </ComboboxPrimitive.Empty>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
