import { Button, Input } from "antd";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from "react";
import { classifyNumberDraft, stepNumber } from "./number-draft";
import styles from "./NumberField.module.css";

/** A normal click finishes well inside the delay; a hold repeats every tick. */
const HOLD_DELAY = 500;
const HOLD_INTERVAL = 50;

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
  const settled = useRef(value);
  const prior = useRef(value);
  const interacting = useRef(false);
  const startRef = useRef(onInteractionStart);
  const endRef = useRef(onInteractionEnd);
  startRef.current = onInteractionStart;
  endRef.current = onInteractionEnd;
  const lower = min === undefined ? undefined : Number(min.toPrecision(12));
  const upper = max === undefined ? undefined : Number(max.toPrecision(12));

  const params = useRef({ lower, upper, step, stepBase });
  params.current = { lower, upper, step, stepBase };
  const releaseRef = useRef<(() => void) | null>(null);
  const holdDelay = useRef<number | undefined>(undefined);
  const holdRepeat = useRef<number | undefined>(undefined);
  const pointerStepped = useRef(false);

  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      prior.current = value;
      setDraft(value == null ? "" : String(value));
    }
  }, [value]);

  useEffect(
    () => () => {
      releaseRef.current?.();
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

  function commit(next: number | null) {
    if (next === null) return;
    const bounds = params.current;
    if (
      classifyNumberDraft(String(next), bounds.lower, bounds.upper).kind !==
        "valid" ||
      next === settled.current
    )
      return;
    settled.current = next;
    onValueChange(next);
  }

  function refreshDraft() {
    setDraft(settled.current == null ? "" : String(settled.current));
  }

  function finish() {
    const bounds = params.current;
    const parsed = classifyNumberDraft(draft, bounds.lower, bounds.upper);
    if (parsed.kind === "valid") commit(parsed.value);
    setDraft(settled.current == null ? "" : String(settled.current));
    prior.current = settled.current;
  }

  function stepBy(delta: number) {
    const bounds = params.current;
    const base = settled.current ?? bounds.stepBase ?? 0;
    commit(stepNumber(base, delta, bounds.lower, bounds.upper));
    refreshDraft();
  }

  /** One step-button press uses the declared step, not a raw ±1. */
  function stepOnce(direction: 1 | -1) {
    stepBy(direction * (params.current.step ?? 1));
  }

  function jumpTo(bound: number) {
    const bounds = params.current;
    commit(stepNumber(bound, 0, bounds.lower, bounds.upper));
    refreshDraft();
  }

  function clearHold() {
    if (holdDelay.current !== undefined) {
      window.clearTimeout(holdDelay.current);
      holdDelay.current = undefined;
    }
    if (holdRepeat.current !== undefined) {
      window.clearInterval(holdRepeat.current);
      holdRepeat.current = undefined;
    }
  }

  function stopPress() {
    releaseRef.current?.();
  }

  function beginPress(event: PointerEvent<HTMLElement>, direction: 1 | -1) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    releaseRef.current?.();
    pointerStepped.current = true;
    startInteraction();
    stepOnce(direction);
    holdDelay.current = window.setTimeout(() => {
      holdDelay.current = undefined;
      stepOnce(direction);
      holdRepeat.current = window.setInterval(
        () => stepOnce(direction),
        HOLD_INTERVAL,
      );
    }, HOLD_DELAY);
    // Release can happen outside the button (or the window), and a cancelled
    // touch never sends pointerup; every ending releases the same way.
    const release = () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      releaseRef.current = null;
      clearHold();
      endInteraction();
      window.setTimeout(() => {
        pointerStepped.current = false;
      }, 0);
    };
    releaseRef.current = release;
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229 ||
      event.which === 229
    ) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      commit(prior.current);
      refreshDraft();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (!event.altKey && event.key === "Home" && lower !== undefined) {
      event.preventDefault();
      jumpTo(lower);
      return;
    }
    if (!event.altKey && event.key === "End" && upper !== undefined) {
      event.preventDefault();
      jumpTo(upper);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key))
      return;
    event.preventDefault();
    const direction =
      event.key === "ArrowDown" || event.key === "PageDown" ? -1 : 1;
    const amount = event.altKey ? 0.1 : event.shiftKey ? 10 : (step ?? 1);
    stepBy(amount * direction);
  }

  function boundReached(direction: 1 | -1) {
    if (value == null) return false;
    return direction === 1
      ? upper !== undefined && value >= upper
      : lower !== undefined && value <= lower;
  }

  function keyboardStep(direction: 1 | -1) {
    if (pointerStepped.current) {
      pointerStepped.current = false;
      return;
    }
    startInteraction();
    stepOnce(direction);
    endInteraction();
  }

  const input = (
    <Input
      data-fp-input=""
      className={variant === "stepper" ? styles.input : undefined}
      id={id}
      aria-label={ariaLabel}
      role="spinbutton"
      aria-valuemin={lower}
      aria-valuemax={upper}
      aria-valuenow={settled.current ?? undefined}
      inputMode="decimal"
      placeholder={placeholder}
      value={draft}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        setDraft(raw);
        const bounds = params.current;
        const parsed = classifyNumberDraft(raw, bounds.lower, bounds.upper);
        if (parsed.kind === "valid") commit(parsed.value);
      }}
      onBlur={finish}
      onFocus={() => {
        prior.current = value;
      }}
      onKeyDown={handleKeyDown}
    />
  );

  if (variant !== "stepper") {
    return (
      <div
        data-fp-control=""
        className={`${styles.root}${density === "compact" ? " " + styles.compact : ""} ${className}`}
      >
        {input}
      </div>
    );
  }

  return (
    <div
      data-fp-control=""
      data-fp-stepper=""
      className={`${styles.root} ${styles.stepper}${density === "compact" ? " " + styles.compact : ""} ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          endInteraction();
      }}
      onPointerCancel={stopPress}
    >
      <Button
        className={styles.stepButton}
        aria-label={`减少${ariaLabel}`}
        htmlType="button"
        disabled={boundReached(-1)}
        onPointerDown={(event) => beginPress(event, -1)}
        onClick={() => keyboardStep(-1)}
      >
        <span aria-hidden="true">−</span>
      </Button>
      {input}
      {unit && (
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      )}
      <Button
        className={styles.stepButton}
        aria-label={`增加${ariaLabel}`}
        htmlType="button"
        disabled={boundReached(1)}
        onPointerDown={(event) => beginPress(event, 1)}
        onClick={() => keyboardStep(1)}
      >
        <span aria-hidden="true">+</span>
      </Button>
    </div>
  );
}
