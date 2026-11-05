import { Select } from "antd";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { registerPopupLayer } from "./modal-layer";
import menu from "./Select.module.css";
import styles from "./Combobox.module.css";

export type ComboboxOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

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

type ComboboxEntry = { value: string; label: string; disabled?: boolean };
type ComboboxGroup = { label: string; options: ComboboxEntry[] };

function groupOptions(
  options: readonly ComboboxOption[],
): (ComboboxEntry | ComboboxGroup)[] {
  const entries: (ComboboxEntry | ComboboxGroup)[] = [];
  for (const option of options) {
    const entry = {
      value: option.value,
      label: option.label,
      disabled: option.disabled,
    };
    if (!option.group) {
      entries.push(entry);
      continue;
    }
    const group = entries.find(
      (item): item is ComboboxGroup =>
        "options" in item && item.label === option.group,
    );
    if (group) group.options.push(entry);
    else entries.push({ label: option.group, options: [entry] });
  }
  return entries;
}

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
  const releasePopup = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(
    () => () => {
      releasePopup.current?.();
      releasePopup.current = null;
    },
    [],
  );
  const selected = options.find((option) => option.value === value);
  // A single select treats `undefined` as "no value" and shows the placeholder.
  // An empty string is a real option value wherever the list provides one.
  const isEmpty =
    value === "" && !options.some((option) => option.value === "");
  const entries = useMemo(() => groupOptions(options), [options]);
  return (
    <Select
      value={isEmpty ? undefined : value}
      options={entries}
      showSearch={{
        searchValue: search,
        onSearch: setSearch,
        optionFilterProp: "label",
      }}
      virtual={false}
      defaultActiveFirstOption={false}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      data-fp-control=""
      className={`select ${menu.select} ${className}`}
      classNames={{ popup: { root: menu.dropdown } }}
      labelRender={({ value: optionValue }) =>
        search ? (
          ""
        ) : (
          <span
            className={menu.value}
            data-fp-select-value=""
            title={selected?.label}
          >
            {selected?.label ?? String(optionValue ?? "")}
          </span>
        )
      }
      onChange={(next) => {
        if (next !== undefined && next !== value) onValueChange(next);
      }}
      onActive={(next) =>
        onHighlightChange?.(next == null ? null : String(next))
      }
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          if (!releasePopup.current)
            releasePopup.current = registerPopupLayer();
          return;
        }
        // rc-select keeps the typed search value after a blur or Escape, which
        // would filter the next open menu down to the previous query.
        setSearch("");
        onHighlightChange?.(null);
        releasePopup.current?.();
        releasePopup.current = null;
      }}
      notFoundContent={<div className={styles.empty}>没有匹配的字体</div>}
      getPopupContainer={(node) =>
        (node.closest("[data-fp-overlay]") as HTMLElement | null) ??
        document.body
      }
      popupRender={(list) => (
        <div className={menu.popup} data-fp-popup="">
          {open ? preview : null}
          {list}
        </div>
      )}
    />
  );
}
