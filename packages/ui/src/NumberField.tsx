import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { useEffect, useRef, useState, type ReactElement } from "react";
import inputStyles from "./Input.module.css";
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
  variant?: "input" | "stepper";
  unit?: string;
  stepBase?: number;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

function seededStep(
  reason: string,
  event: Event | undefined,
  base: number,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number | null {
  if (
    reason !== "increment-press" &&
    reason !== "decrement-press" &&
    reason !== "keyboard"
  )
    return null;
  const key = (event as KeyboardEvent | undefined)?.key;
  let next: number;
  if (reason === "keyboard" && key === "Home") next = min ?? base;
  else if (reason === "keyboard" && key === "End") next = max ?? base;
  else {
    const modifier = event as KeyboardEvent | PointerEvent | undefined;
    const amount = modifier?.altKey ? 0.1 : modifier?.shiftKey ? 10 : step;
    const direction =
      reason === "decrement-press" || key === "ArrowDown" || key === "PageDown"
        ? -1
        : 1;
    next = base + amount * direction;
  }
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return Number(next.toPrecision(12));
}

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
  variant = "input",
  unit,
  stepBase,
  onInteractionStart,
  onInteractionEnd,
}: NumberFieldProps): ReactElement {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [pressEpoch, setPressEpoch] = useState(0);
  const settled = useRef(value);
  const prior = useRef(value);
  const interacting = useRef(false);
  const startRef = useRef(onInteractionStart);
  const endRef = useRef(onInteractionEnd);
  startRef.current = onInteractionStart;
  endRef.current = onInteractionEnd;
  const lower = min === undefined ? undefined : Number(min.toPrecision(12));
  const upper = max === undefined ? undefined : Number(max.toPrecision(12));

  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      prior.current = value;
      setDraft(value == null ? "" : String(value));
    }
  }, [value]);

  useEffect(
    () => () => {
      if (interacting.current) {
        interacting.current = false;
        endRef.current?.();
      }
    },
    [],
  );

  function startInteraction() {
    if (interacting.current) return;
    interacting.current = true;
    startRef.current?.();
  }

  function endInteraction() {
    if (!interacting.current) return;
    interacting.current = false;
    endRef.current?.();
  }

  function cancelInteraction() {
    endInteraction();
    // Base UI keeps its press-and-hold timer alive on pointercancel; remount
    // the step buttons so their unmount cleanup stops the repeat.
    setPressEpoch((epoch) => epoch + 1);
  }

  function commit(next: number | null) {
    if (next === null) return;
    if (
      classifyNumberDraft(String(next), lower, upper).kind !== "valid" ||
      next === settled.current
    )
      return;
    settled.current = next;
    onValueChange(next);
  }

  function finish() {
    const parsed = classifyNumberDraft(draft, lower, upper);
    if (parsed.kind === "valid") commit(parsed.value);
    setDraft(settled.current == null ? "" : String(settled.current));
    prior.current = settled.current;
  }

  const input = (
    <NumberFieldPrimitive.Input
      data-fp-input=""
      className={`${inputStyles.focus}${variant === "stepper" ? " " + styles.input : ""}`}
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => {
        event.preventBaseUIHandler();
        const raw = event.currentTarget.value;
        setDraft(raw);
        const parsed = classifyNumberDraft(raw, lower, upper);
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
              ((event.key === "Home" && lower !== undefined) ||
                (event.key === "End" && upper !== undefined))))
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
  );

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
        if (
          details.reason === "increment-press" ||
          details.reason === "decrement-press"
        )
          startInteraction();
        let resolved = next;
        if (value == null && stepBase !== undefined && resolved != null) {
          const seeded = seededStep(
            details.reason,
            details.event,
            stepBase,
            lower,
            upper,
            step ?? 1,
          );
          if (seeded !== null) resolved = seeded;
        }
        if (resolved === null) return;
        commit(Number(resolved.toPrecision(12)));
        setDraft(settled.current == null ? "" : String(settled.current));
      }}
      onValueCommitted={endInteraction}
      onPointerCancel={cancelInteraction}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        )
          endInteraction();
      }}
      min={lower}
      max={upper}
      step={step}
      allowOutOfRange
      disabled={disabled}
    >
      {variant === "stepper" ? (
        <NumberFieldPrimitive.Group data-fp-stepper="" className={styles.stepper}>
          <NumberFieldPrimitive.Decrement
            key={`decrement-${pressEpoch}`}
            className={styles.stepButton}
            aria-label={`减少${ariaLabel}`}
          >
            <span aria-hidden="true">−</span>
          </NumberFieldPrimitive.Decrement>
          {input}
          {unit && (
            <span className={styles.unit} aria-hidden="true">
              {unit}
            </span>
          )}
          <NumberFieldPrimitive.Increment
            key={`increment-${pressEpoch}`}
            className={styles.stepButton}
            aria-label={`增加${ariaLabel}`}
          >
            <span aria-hidden="true">+</span>
          </NumberFieldPrimitive.Increment>
        </NumberFieldPrimitive.Group>
      ) : (
        input
      )}
    </NumberFieldPrimitive.Root>
  );
}
