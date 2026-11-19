import { Button, Popover, type RefSelectProps } from "antd";
import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { TextColor } from "@fastposter/poster-schema";
import {
  gradientCSS,
  gradientValueKey,
  isGradientColor,
} from "@fastposter/poster-renderer";
import { BottomSheet, registerPopupLayer } from "@fastposter/ui";
import { TextColorPanel } from "./TextColorPanel";
import shared from "./ColorField.module.css";
import styles from "./TextColorField.module.css";

type CloseAction = "commit" | "cancel";
type ChildPopup = "presets" | "picker";

const DEFAULT_TEXT_COLOR = "#000000";

export function TextColorField({
  value,
  target,
  sample,
  phone,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  value: TextColor | null;
  target: string;
  sample: string;
  phone: boolean;
  onChange: (next: TextColor) => void;
  onInteractionStart: () => void;
  onInteractionEnd: (action: CloseAction) => void;
}) {
  const [session, setSession] = useState<{
    target: string;
    phone: boolean;
  } | null>(null);
  const [popup, setPopup] = useState<ChildPopup | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pickerTrigger = useRef<HTMLButtonElement>(null);
  const presetTrigger = useRef<RefSelectProps>(null);
  const release = useRef<(() => void) | null>(null);
  const changed = useRef(false);
  const endHandler = useRef(onInteractionEnd);
  endHandler.current = onInteractionEnd;

  const finish = useCallback((action: CloseAction) => {
    release.current?.();
    release.current = null;
    if (changed.current) {
      changed.current = false;
      endHandler.current(action);
    }
  }, []);
  const close = useCallback(
    (action: CloseAction, focus = false) => {
      finish(action);
      setPopup(null);
      setSession(null);
      if (focus) trigger.current?.focus({ preventScroll: true });
    },
    [finish],
  );

  useEffect(() => () => finish("commit"), [finish]);
  useLayoutEffect(() => {
    if (session && (session.target !== target || session.phone !== phone))
      close("commit");
  }, [session, target, phone, close]);

  useEffect(() => {
    if (!session) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.stopPropagation();
      event.preventDefault();
      if (popup) {
        setPopup(null);
        const opener =
          popup === "picker" ? pickerTrigger.current : presetTrigger.current;
        opener?.focus({ preventScroll: true });
      } else close("cancel", true);
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [session, popup, close]);

  function setChildPopup(child: ChildPopup, open: boolean) {
    setPopup((current) => (open ? child : current === child ? null : current));
  }

  const open =
    !!session && session.target === target && session.phone === phone;
  const setOpen = (next: boolean) => {
    if (next) {
      if (session) return;
      if (!phone) release.current = registerPopupLayer();
      setSession({ target, phone });
    } else {
      close("commit");
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active === document.body || !active?.isConnected)
          trigger.current?.focus({ preventScroll: true });
      });
    }
  };
  const gradient = isGradientColor(value) ? value : null;
  const control = (
    <Button
      ref={trigger}
      className={`${shared.trigger} ${styles.trigger}`}
      aria-label="文字颜色"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={phone ? () => setOpen(true) : undefined}
    >
      <span className={shared.swatch} aria-hidden="true">
        <span
          className={shared.swatchColor}
          style={{
            background: gradient
              ? gradientCSS(gradient)
              : typeof value === "string"
                ? value
                : DEFAULT_TEXT_COLOR,
          }}
        />
      </span>
      <span className={shared.hex}>
        {gradient
          ? gradient.type === "linear"
            ? "线性渐变"
            : "径向渐变"
          : typeof value === "string"
            ? `${value.toUpperCase()} · 纯色 / 渐变`
            : "纯色 / 渐变"}
      </span>
      <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
    </Button>
  );
  const content = open && (
    <TextColorPanel
      value={value}
      fallbackColor={DEFAULT_TEXT_COLOR}
      sample={sample}
      phone={phone}
      pickerOpen={popup === "picker"}
      onPickerOpenChange={(open) => setChildPopup("picker", open)}
      pickerTrigger={pickerTrigger}
      presetsOpen={popup === "presets"}
      onPresetsOpenChange={(open) => setChildPopup("presets", open)}
      presetTrigger={presetTrigger}
      onChange={(next) => {
        if (value && gradientValueKey(next) === gradientValueKey(value)) return;
        if (!changed.current) {
          changed.current = true;
          onInteractionStart();
        }
        onChange(next);
      }}
      onDone={() => close("commit", true)}
    />
  );

  if (phone)
    return (
      <>
        {control}
        {open && (
          <BottomSheet
            title="编辑文字颜色"
            onClose={() => close("commit", true)}
            restoreFocusTo={() => trigger.current}
          >
            {content}
          </BottomSheet>
        )}
      </>
    );
  return (
    <Popover
      trigger="click"
      placement="leftTop"
      autoAdjustOverflow
      arrow={false}
      destroyOnHidden
      open={open}
      onOpenChange={setOpen}
      content={<>{content}</>}
      styles={{ container: { padding: 0 } }}
      getPopupContainer={(node) =>
        node.closest<HTMLElement>("[data-fp-overlay]") ?? document.body
      }
    >
      {control}
    </Popover>
  );
}
