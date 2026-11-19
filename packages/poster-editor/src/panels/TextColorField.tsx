import { Button, ColorPicker, Slider } from "antd";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import type { TextColor } from "@fastposter/poster-schema";
import {
  gradientCSS,
  isGradientColor,
  type TextGradient,
} from "@fastposter/poster-renderer";
import { registerPopupLayer } from "@fastposter/ui";
import { ColorField } from "./ColorField";
import { gradientPresets } from "./gradient-presets";
import { gradientWritesEnabled } from "../gradient-writes";
import styles from "./ColorField.module.css";

const DEFAULT_SOLID = "#000000";
export function gradientWithType(
  kind: TextGradient["type"],
  current?: TextGradient,
): TextGradient {
  if (current?.type === kind) return current;
  const rangeId = current?.rangeId ?? "";
  const stops = current?.stops ?? [
    { color: "#FFB75E", offset: 0 },
    { color: "#ED8F03", offset: 100 },
  ];
  return kind === "linear"
    ? { type: "linear", rangeId, angle: 90, stops }
    : { type: "radial", rangeId, centerX: 50, centerY: 50, stops };
}

function GradientEditor({
  value,
  onChange,
}: {
  value: TextGradient;
  onChange: (next: TextGradient) => void;
}) {
  const rangeId = value.rangeId;
  const patch = (next: TextGradient) => onChange({ ...next, rangeId });
  const setStop = (index: number, stop: { color?: string; offset?: number }) =>
    patch({
      ...value,
      stops: value.stops.map((s, i) => (i === index ? { ...s, ...stop } : s)),
    });
  return (
    <div className={styles.gradientEditor}>
      <div className={styles.gradientRow}>
        <label>
          预设
          <select
            aria-label="渐变预设"
            value=""
            onChange={(e) => {
              const item = gradientPresets.find(
                (preset) => preset.label === e.target.value,
              );
              if (item) onChange(item.value);
            }}
          >
            <option value="">选择预设</option>
            {gradientPresets.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value.type === "linear" ? (
        <label className={styles.gradientRow}>
          角度 {value.angle}°
          <Slider
            ariaLabelForHandle="渐变角度"
            min={0}
            max={359}
            step={1}
            value={value.angle}
            onChange={(angle) => patch({ ...value, angle })}
          />
        </label>
      ) : (
        <div className={styles.gradientRow}>
          <label>
            圆心 X {value.centerX}%
            <Slider
              ariaLabelForHandle="圆心 X"
              min={0}
              max={100}
              value={value.centerX}
              onChange={(centerX) => patch({ ...value, centerX })}
            />
          </label>
          <label>
            圆心 Y {value.centerY}%
            <Slider
              ariaLabelForHandle="圆心 Y"
              min={0}
              max={100}
              value={value.centerY}
              onChange={(centerY) => patch({ ...value, centerY })}
            />
          </label>
        </div>
      )}
      <div className={styles.stops}>
        {value.stops.map((stop, index) => (
          <div key={index} className={styles.stopRow}>
            <ColorPicker
              value={stop.color}
              onChange={(color) =>
                setStop(index, { color: color.toHexString() })
              }
            >
              <Button
                htmlType="button"
                aria-label={`色标 ${index + 1} 颜色`}
                size="small"
              >
                <span
                  aria-hidden="true"
                  className={styles.stopSwatch}
                  style={{ backgroundColor: stop.color }}
                />
                {stop.color.toUpperCase()}
              </Button>
            </ColorPicker>
            <input
              aria-label={`色标 ${index + 1} 位置`}
              type="number"
              min={value.stops[index - 1]?.offset ?? 0}
              max={value.stops[index + 1]?.offset ?? 100}
              value={stop.offset}
              onChange={(e) => {
                const offset = Number(e.target.value);
                if (Number.isFinite(offset))
                  setStop(index, {
                    offset: Math.max(
                      value.stops[index - 1]?.offset ?? 0,
                      Math.min(value.stops[index + 1]?.offset ?? 100, offset),
                    ),
                  });
              }}
            />
            <Button
              htmlType="button"
              size="small"
              aria-label={`删除色标 ${index + 1}`}
              disabled={value.stops.length <= 2}
              onClick={() =>
                patch({
                  ...value,
                  stops: value.stops.filter((_, i) => i !== index),
                })
              }
            >
              删除
            </Button>
          </div>
        ))}
      </div>
      <Button
        htmlType="button"
        size="small"
        aria-label="添加色标"
        disabled={value.stops.length >= 8}
        onClick={() => {
          const last = value.stops[value.stops.length - 1];
          patch({
            ...value,
            stops: [
              ...value.stops,
              { color: last.color, offset: Math.min(100, last.offset + 10) },
            ],
          });
        }}
      >
        添加色标
      </Button>
    </div>
  );
}

/**
 * Solid colors delegate to the shared ColorField so its hex popup contract is
 * untouched. Gradients use a dedicated controlled popup whose open -> close
 * cycle is one undo step.
 */
export function TextColorField({
  label,
  value,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  allowGradient = gradientWritesEnabled(),
}: {
  label: string;
  value: TextColor;
  onChange: (next: TextColor) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: (action: "commit" | "cancel") => void;
  allowGradient?: boolean;
}): ReactElement {
  const gradient = isGradientColor(value) ? value : null;
  const solid = typeof value === "string" ? value : DEFAULT_SOLID;

  // Pure color keeps the original ColorField trigger and popup verbatim.
  if (!gradient)
    return (
      <ColorField
        label={label}
        value={solid}
        onChange={(next) => onChange(next)}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />
    );

  // A deployment that cannot write gradients still renders them faithfully;
  // it simply does not offer an editor for the stored value.
  if (!allowGradient)
    return (
      <label className="panel-field">
        {label}
        <span
          aria-label={label}
          style={{
            display: "inline-block",
            width: 32,
            height: 18,
            borderRadius: 4,
            backgroundImage: gradientCSS(gradient),
          }}
        />
      </label>
    );

  return (
    <GradientTrigger
      label={label}
      value={gradient}
      onChange={onChange}
      onInteractionStart={onInteractionStart}
      onInteractionEnd={onInteractionEnd}
    />
  );
}

function GradientTrigger({
  label,
  value,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  label: string;
  value: TextGradient;
  onChange: (next: TextColor) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: (action: "commit" | "cancel") => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const releasePopup = useRef<(() => void) | null>(null);
  const changed = useRef(false);
  const valueRef = useRef<TextColor>(value);
  const startHandler = useRef(onInteractionStart);
  const endHandler = useRef(onInteractionEnd);
  valueRef.current = value;
  startHandler.current = onInteractionStart;
  endHandler.current = onInteractionEnd;

  const emit = (next: TextColor) => {
    if (JSON.stringify(next) === JSON.stringify(valueRef.current)) return;
    if (!changed.current) {
      changed.current = true;
      startHandler.current?.();
    }
    onChange(next);
  };
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
      if (changed.current) {
        changed.current = false;
        endHandler.current?.("commit");
      }
    },
    [],
  );
  const preview = gradientCSS(value);
  return (
    <span
      className={styles.field}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        end("cancel");
        trigger.current?.focus();
      }}
    >
      <Button
        ref={trigger}
        htmlType="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            changed.current = false;
            if (!releasePopup.current)
              releasePopup.current = registerPopupLayer();
            setOpen(true);
          } else {
            setOpen(false);
            end("commit");
          }
        }}
      >
        <span
          className={styles.swatch}
          style={{ background: preview }}
          aria-hidden="true"
        />
        <span className={styles.hex}>
          {value.type === "linear" ? "线性渐变" : "径向渐变"}
        </span>
      </Button>
      {open && (
        <div className={styles.popup} data-fp-popup="" role="dialog">
          <label className={styles.gradientRow}>
            颜色类型
            <select
              aria-label="颜色类型"
              value={value.type}
              onChange={(e) => {
                const kind = e.target.value;
                if (kind === "solid") emit(value.stops[0].color);
                else if (kind === "linear" || kind === "radial")
                  emit(gradientWithType(kind, value));
              }}
            >
              <option value="solid">纯色</option>
              <option value="linear">线性渐变</option>
              <option value="radial">径向渐变</option>
            </select>
          </label>
          <GradientEditor value={value} onChange={emit} />
          <Button
            htmlType="button"
            size="small"
            aria-label="关闭颜色面板"
            onClick={() => {
              setOpen(false);
              end("commit");
              trigger.current?.focus();
            }}
          >
            完成
          </Button>
        </div>
      )}
    </span>
  );
}
