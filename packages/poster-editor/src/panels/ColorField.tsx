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
  onInteractionEnd?: () => void;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const releasePopup = useRef<(() => void) | null>(null);
  const interacting = useRef(false);
  const endHandler = useRef(onInteractionEnd);
  endHandler.current = onInteractionEnd;
  const end = () => {
    releasePopup.current?.();
    releasePopup.current = null;
    if (!interacting.current) return;
    interacting.current = false;
    endHandler.current?.();
  };
  useEffect(
    () => () => {
      releasePopup.current?.();
      releasePopup.current = null;
      if (!interacting.current) return;
      interacting.current = false;
      endHandler.current?.();
    },
    [],
  );
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (!interacting.current) {
        interacting.current = true;
        onInteractionStart?.();
      }
      if (!releasePopup.current) releasePopup.current = registerPopupLayer();
      return;
    }
    end();
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
        onChange={(color) => onChange(color.toHexString())}
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
          <span
            className={styles.swatch}
            style={{ backgroundColor: value }}
            aria-hidden="true"
          />
          <span className={styles.hex}>{value.toUpperCase()}</span>
        </button>
      </ColorPicker>
    </span>
  );
}
