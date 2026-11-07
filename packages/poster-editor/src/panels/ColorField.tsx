import { ColorPicker } from "antd";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { registerPopupLayer } from "@fastposter/ui";
import styles from "./ColorField.module.css";

export function ColorField({
  label,
  value,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onInteractionStart?: () => void;
  /** "commit" is used for close, plain Escape and target switches. */
  onInteractionEnd?: (action: "commit" | "cancel") => void;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const releasePopup = useRef<(() => void) | null>(null);
  // A handle is acquired only by the first *valid* change of this open. An
  // unedited open/close must not write, add history or block save/export.
  const changed = useRef(false);
  const startHandler = useRef(onInteractionStart);
  const endHandler = useRef(onInteractionEnd);
  const valueRef = useRef(value);
  startHandler.current = onInteractionStart;
  endHandler.current = onInteractionEnd;
  valueRef.current = value;

  const end = (action: "commit" | "cancel" = "commit") => {
    releasePopup.current?.();
    releasePopup.current = null;
    if (!changed.current) return;
    changed.current = false;
    endHandler.current?.(action);
  };
  useEffect(
    () => () => {
      releasePopup.current?.();
      releasePopup.current = null;
      // An unmount with produced changes commits them on the original target.
      if (changed.current) {
        changed.current = false;
        endHandler.current?.("commit");
      }
    },
    [],
  );
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      changed.current = false;
      if (!releasePopup.current) releasePopup.current = registerPopupLayer();
      return;
    }
    end("commit");
  };
  return (
    <span
      className={styles.field}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (!open || event.key !== "Escape") return;
        // A popup layer is registered while the panel is open, so the sheet
        // leaves this Escape to the picker. A second one reaches the sheet.
        event.preventDefault();
        event.stopPropagation();
        handleOpenChange(false);
        trigger.current?.focus();
      }}
    >
      <ColorPicker
        value={value}
        open={open}
        disabled={disabled}
        format="hex"
        destroyOnHidden
        onOpenChange={handleOpenChange}
        onChange={(color) => {
          const next = color.toHexString();
          if (next === valueRef.current) return;
          if (!changed.current) {
            changed.current = true;
            startHandler.current?.();
          }
          onChange(next);
        }}
        getPopupContainer={(node) =>
          (node.closest("[data-fp-overlay]") as HTMLElement | null) ??
          document.body
        }
        panelRender={(panel) => (
          <div className={styles.panel} data-fp-popup="">
            {panel}
          </div>
        )}
      >
        <button
          ref={trigger}
          type="button"
          className={styles.trigger}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className={styles.swatch} aria-hidden="true">
            <span
              className={styles.swatchColor}
              style={{ backgroundColor: value }}
            />
          </span>
          <span className={styles.hex}>{value.toUpperCase()}</span>
        </button>
      </ColorPicker>
    </span>
  );
}
