import { Button, Input, Space } from "antd";
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

/**
 * The full suspended state of a numeric input session. `raw` is the exact
 * string on screen, `baseline` is the valid value from before the session
 * began (what Escape restores) and `lastValid` is the most recent value that
 * took effect. The edit session keeps it so a breakpoint swap, a panel
 * remount or a display-mode change can put the very same input back.
 */
export type NumberDraftSnapshot = {
  raw: string;
  baseline: number | null;
  lastValid: number | null;
};

/**
 * Owners keep the snapshot per work/template, block, property and edit
 * target. A caller without a binding keeps all of this locally instead.
 */
export type NumberDraftBinding = {
  initialDraft?: NumberDraftSnapshot;
  onDraftChange?: (snapshot: NumberDraftSnapshot | null) => void;
  /** Cancel the whole input session through the edit session. */
  onDraftCancel?: () => void;
};

export type NumberFieldProps = NumberDraftBinding & {
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
  /** "commit" finalises the gesture, "cancel" reverts it (Escape). */
  onInteractionEnd?: (action: "commit" | "cancel") => void;
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
  initialDraft,
  onDraftChange,
  onDraftCancel,
}: NumberFieldProps): ReactElement {
  const [draft, setDraft] = useState(
    initialDraft ? initialDraft.raw : value == null ? "" : String(value),
  );
  const settled = useRef<number | null>(
    initialDraft ? initialDraft.lastValid : value,
  );
  const baseline = useRef<number | null>(
    initialDraft ? initialDraft.baseline : value,
  );
  const sessionStarted = useRef(!!initialDraft);
  // A restored snapshot continues the same input session across a remount.
  const interacting = useRef(!!initialDraft);
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

  function emitSnapshot(raw: string) {
    onDraftChange?.({
      raw,
      baseline: baseline.current,
      lastValid: settled.current,
    });
  }

  function ensureBaseline() {
    if (sessionStarted.current) return;
    baseline.current = settled.current;
    sessionStarted.current = true;
  }

  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value;
      baseline.current = value;
      sessionStarted.current = false;
      setDraft(value == null ? "" : String(value));
      onDraftChange?.(null);
    }
  }, [value, onDraftChange]);

  useEffect(
    () => () => {
      // A remount must keep the session draft and its open gesture alive;
      // only releaseRef (an interrupted press) may end an interaction.
      releaseRef.current?.();
    },
    [],
  );

  function startInteraction() {
    if (interacting.current) return;
    interacting.current = true;
    ensureBaseline();
    startRef.current?.();
  }

  function endInteraction(action: "commit" | "cancel" = "commit") {
    if (!interacting.current) return;
    interacting.current = false;
    sessionStarted.current = false;
    baseline.current = settled.current;
    endRef.current?.(action);
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
    // Acquire the gesture transaction before the value takes effect, so a
    // cancel can revert to the pre-session document value.
    startInteraction();
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
    // An unfinished string is tidied up like a deliberate blur.
    onDraftChange?.(null);
    endInteraction("commit");
  }

  function stepBy(delta: number) {
    const bounds = params.current;
    const base = settled.current ?? bounds.stepBase ?? 0;
    commit(stepNumber(base, delta, bounds.lower, bounds.upper));
    refreshDraft();
    onDraftChange?.(null);
  }

  /** One step-button press uses the declared step, not a raw ±1. */
  function stepOnce(direction: 1 | -1) {
    stepBy(direction * (params.current.step ?? 1));
  }

  function jumpTo(bound: number) {
    const bounds = params.current;
    commit(stepNumber(bound, 0, bounds.lower, bounds.upper));
    refreshDraft();
    onDraftChange?.(null);
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
      // Restore the valid value from before this input session. The branch is
      // decided by whether the field has a draft binding, NOT by whether it
      // has session transaction callbacks: a bound position field has a
      // binding but no callbacks and must still cancel through the session.
      const restore = baseline.current;
      const changed = restore !== settled.current;
      settled.current = restore;
      setDraft(restore == null ? "" : String(restore));
      const bound = onDraftChange !== undefined || onDraftCancel !== undefined;
      if (bound) {
        // Cancel the session BEFORE clearing the record: the owner reads the
        // session depth from that scope. A field with transaction callbacks
        // rolls its open gesture back through endInteraction("cancel"); a
        // bound field without them rolls back its committed input session via
        // onDraftCancel (a transaction rollback, no extra undo entry).
        if (!endRef.current) onDraftCancel?.();
        onDraftChange?.(null);
      } else if (restore !== null && changed) {
        // An unbound caller (admin) has no session to cancel: keep the shared
        // control's original local behaviour and write the pre-session value
        // back through onValueChange, as the baseline commit(prior) did, so
        // the displayed draft and the controlled value do not diverge.
        onValueChange(restore);
      }
      endInteraction("cancel");
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
      size={density === "compact" ? "small" : undefined}
      className={variant === "stepper" ? styles.input : undefined}
      suffix={unit && <span aria-hidden="true">{unit}</span>}
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
        ensureBaseline();
        const bounds = params.current;
        const parsed = classifyNumberDraft(raw, bounds.lower, bounds.upper);
        // Record the suspended draft BEFORE the valid value takes effect, so
        // the history depth captured by the owner marks the session start and
        // an Escape can roll the whole session back.
        emitSnapshot(raw);
        if (parsed.kind === "valid") commit(parsed.value);
      }}
      onBlur={finish}
      onKeyDown={handleKeyDown}
    />
  );

  if (variant !== "stepper") {
    return (
      <div data-fp-control="" className={`${styles.root} ${className}`}>
        {input}
      </div>
    );
  }

  return (
    <Space.Compact
      block
      size={density === "compact" ? "small" : undefined}
      data-fp-control=""
      data-fp-stepper=""
      className={`${styles.root} ${className}`}
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
        disabled={disabled || boundReached(-1)}
        onPointerDown={(event) => beginPress(event, -1)}
        onClick={() => keyboardStep(-1)}
      >
        <span aria-hidden="true">−</span>
      </Button>
      {input}
      <Button
        className={styles.stepButton}
        aria-label={`增加${ariaLabel}`}
        htmlType="button"
        disabled={disabled || boundReached(1)}
        onPointerDown={(event) => beginPress(event, 1)}
        onClick={() => keyboardStep(1)}
      >
        <span aria-hidden="true">+</span>
      </Button>
    </Space.Compact>
  );
}
