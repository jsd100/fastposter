import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { classifyNumberDraft } from "./number-draft";
import styles from "./NumberField.module.css";

export type NumberFieldProps = {
  value: number | null;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  "aria-label": string;
  id?: string;
  className?: string;
  density?: "normal" | "compact";
  placeholder?: string;
  disabled?: boolean;
};

export function NumberField({
  value,
  onValueChange,
  min,
  max,
  step,
  "aria-label": ariaLabel,
  id,
  className = "",
  density = "normal",
  placeholder,
  disabled,
}: NumberFieldProps): ReactElement {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const settled = useRef(value);
  const prior = useRef(value);

  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      prior.current = value;
      setDraft(value == null ? "" : String(value));
    }
  }, [value]);

  function commit(next: number | null) {
    if (next === null) return;
    if (
      classifyNumberDraft(String(next), min, max).kind !== "valid" ||
      next === settled.current
    )
      return;
    settled.current = next;
    onValueChange(next);
  }

  function finish() {
    const parsed = classifyNumberDraft(draft, min, max);
    if (parsed.kind === "valid") commit(parsed.value);
    setDraft(settled.current == null ? "" : String(settled.current));
    prior.current = settled.current;
  }

  return (
    <NumberFieldPrimitive.Root
      data-fp-control=""
      className={`${styles.root}${density === "compact" ? " " + styles.compact : ""} ${className}`}
      value={value}
      onValueChange={(next, details) => {
        // Text is validated before parsing below. Keep Base UI's stepping,
        // but do not let its blur parser commit a stale or unfinished draft.
        if (details.reason.startsWith("input-")) {
          details.cancel();
          return;
        }
        commit(next);
        setDraft(settled.current == null ? "" : String(settled.current));
      }}
      min={min}
      max={max}
      step={step}
      allowOutOfRange
      disabled={disabled}
    >
      <NumberFieldPrimitive.Input
        data-fp-input=""
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => {
          event.preventBaseUIHandler();
          const raw = event.currentTarget.value;
          setDraft(raw);
          const parsed = classifyNumberDraft(raw, min, max);
          if (parsed.kind === "valid") commit(parsed.value);
        }}
        onPaste={(event) => {
          // Let the browser splice the text and deliver onChange with the
          // complete raw draft, rather than parsing the clipboard first.
          event.preventBaseUIHandler();
        }}
        onBlur={finish}
        onFocus={() => {
          prior.current = value;
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.which === 229) {
            event.preventBaseUIHandler();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            finish();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            commit(prior.current);
            setDraft(settled.current == null ? "" : String(settled.current));
          } else if (
            !event.ctrlKey &&
            !event.metaKey &&
            (["ArrowUp", "ArrowDown"].includes(event.key) ||
              (!event.altKey &&
                ((event.key === "Home" && min !== undefined) ||
                  (event.key === "End" && max !== undefined))))
          ) {
            // At a bound Base UI may not emit a change, but stepping must
            // still replace an unfinished draft with the effective number.
            setDraft(settled.current == null ? "" : String(settled.current));
          } else {
            // Base UI's character filter reads its formatted numeric value,
            // not our raw draft. Let native editing feed the raw validator.
            event.preventBaseUIHandler();
          }
        }}
      />
    </NumberFieldPrimitive.Root>
  );
}
