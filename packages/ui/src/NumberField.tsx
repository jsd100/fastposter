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
  const [draft, setDraft] = useState(value);
  const settled = useRef(value);
  const prior = useRef(value);

  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      prior.current = value;
      setDraft(value);
    }
  }, [value]);

  function commit(next: number | null) {
    if (next === null) return;
    if (
      classifyNumberDraft(String(next), min, max).kind !== "valid" ||
      next === settled.current
    )
      return;
    prior.current = settled.current;
    settled.current = next;
    setDraft(next);
    onValueChange(next);
  }

  return (
    <NumberFieldPrimitive.Root
      data-fp-control=""
      className={`${styles.root}${density === "compact" ? " " + styles.compact : ""} ${className}`}
      value={draft}
      onValueChange={commit}
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
        onFocus={() => {
          prior.current = value;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          const restore = prior.current;
          event.currentTarget.blur();
          commit(restore);
        }}
      />
    </NumberFieldPrimitive.Root>
  );
}
