import { Button, InputNumber } from "antd";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRef, type PointerEvent } from "react";
import type { TextGradient } from "@fastposter/poster-renderer";
import {
  addGradientStop,
  angleFromPoint,
  normalizeGradientAngle,
  percentage,
} from "./gradient-controls";
import styles from "./TextColorField.module.css";

type Stops = TextGradient["stops"];

function startDrag(event: PointerEvent<HTMLElement>) {
  if (!event.isPrimary || event.button !== 0) return false;
  event.currentTarget.setPointerCapture(event.pointerId);
  return true;
}

function NumberControl({
  label,
  value,
  unit,
  max = 100,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  unit: "°" | "%";
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.numberField}>
      {label}
      <InputNumber
        aria-label={label}
        value={value}
        min={min}
        max={max}
        suffix={unit}
        controls={false}
        onChange={(next) => {
          if (next != null) onChange(next);
        }}
      />
    </label>
  );
}

export function GradientDirection({
  value,
  onChange,
}: {
  value: TextGradient;
  onChange: (value: TextGradient) => void;
}) {
  if (value.type === "linear") {
    const setAngle = (angle: number) =>
      onChange({ ...value, angle: normalizeGradientAngle(angle) });
    const move = (event: PointerEvent<HTMLDivElement>) => {
      const { left, top, width, height } =
        event.currentTarget.getBoundingClientRect();
      const angle = angleFromPoint(
        event.clientX - left - width / 2,
        event.clientY - top - height / 2,
      );
      if (angle != null) setAngle(angle);
    };
    return (
      <div className={styles.direction}>
        <div
          tabIndex={0}
          role="slider"
          aria-label="渐变角度"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={value.angle}
          aria-valuetext={`${value.angle} 度`}
          className={styles.dial}
          onPointerDown={(event) => {
            if (startDrag(event)) move(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              move(event);
          }}
          onKeyDown={(event) => {
            const { key, shiftKey } = event;
            const sign =
              key === "ArrowRight" || key === "ArrowUp"
                ? 1
                : key === "ArrowLeft" || key === "ArrowDown"
                  ? -1
                  : 0;
            if (sign === 0 && key !== "Home" && key !== "End") return;
            event.preventDefault();
            if (key === "Home") setAngle(0);
            else if (key === "End") setAngle(359);
            else setAngle(Math.round(value.angle) + sign * (shiftKey ? 15 : 1));
          }}
        >
          <span className={styles.north} aria-hidden="true">
            0°
          </span>
          <span className={styles.east} aria-hidden="true">
            90°
          </span>
          <span className={styles.south} aria-hidden="true">
            180°
          </span>
          <span className={styles.west} aria-hidden="true">
            270°
          </span>
          <span
            className={styles.hand}
            style={{ transform: `rotate(${value.angle}deg)` }}
            aria-hidden="true"
          />
        </div>
        <NumberControl
          label="角度"
          value={value.angle}
          max={360}
          unit="°"
          onChange={setAngle}
        />
      </div>
    );
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    onChange({
      ...value,
      centerX: percentage(Math.round(((event.clientX - left) * 100) / width)),
      centerY: percentage(Math.round(((event.clientY - top) * 100) / height)),
    });
  };
  return (
    <div className={styles.direction}>
      <div
        className={styles.plane}
        data-testid="gradient-center"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (startDrag(event)) move(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            move(event);
        }}
      >
        <span
          className={styles.center}
          style={{ left: `${value.centerX}%`, top: `${value.centerY}%` }}
        />
      </div>
      <div className={styles.coordinates}>
        <NumberControl
          label="圆心 X"
          value={value.centerX}
          unit="%"
          onChange={(centerX) => onChange({ ...value, centerX })}
        />
        <NumberControl
          label="圆心 Y"
          value={value.centerY}
          unit="%"
          onChange={(centerY) => onChange({ ...value, centerY })}
        />
      </div>
    </div>
  );
}

export function GradientStops({
  stops,
  index,
  onSelect,
  onChange,
}: {
  stops: Stops;
  index: number;
  onSelect: (index: number) => void;
  onChange: (stops: Stops) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const min = (index: number) => stops[index - 1]?.offset ?? 0;
  const max = (index: number) => stops[index + 1]?.offset ?? 100;
  function setOffset(index: number, offset: number) {
    const clamped = Math.min(max(index), Math.max(min(index), offset));
    onChange(
      stops.map((stop, i) =>
        i === index ? { ...stop, offset: clamped } : stop,
      ),
    );
  }
  return (
    <>
      <div className={styles.stopHeader}>
        <strong>色标</strong>
        <Button
          size="small"
          icon={<Plus size={14} />}
          disabled={stops.length === 8}
          onClick={() => {
            const next = addGradientStop(stops);
            onSelect(next.index);
            onChange(next.stops);
          }}
        >
          添加色标
        </Button>
      </div>
      <div
        ref={rail}
        className={styles.rail}
        style={{
          backgroundImage: `linear-gradient(90deg, ${stops.map((stop) => `${stop.color} ${stop.offset}%`).join(", ")}), repeating-conic-gradient(#d9d9d9 0% 25%, #fff 0% 50%)`,
        }}
      >
        {stops.map((stop, position) => (
          <button
            type="button"
            key={position}
            className={styles.pin}
            aria-label={`色标 ${position + 1}，${stop.offset}%`}
            aria-pressed={position === index}
            style={{ left: `${stop.offset}%` }}
            onFocus={() => onSelect(position)}
            onClick={() => onSelect(position)}
            onPointerDown={(event) => {
              if (startDrag(event)) onSelect(position);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const bounds = rail.current?.getBoundingClientRect();
              if (bounds)
                setOffset(
                  position,
                  Math.round(
                    ((event.clientX - bounds.left) * 100) / bounds.width,
                  ),
                );
            }}
          >
            <span aria-hidden="true" style={{ backgroundColor: stop.color }} />
          </button>
        ))}
      </div>
      <div className={styles.stopPosition}>
        <div className={styles.stopNavigation} aria-label="切换当前色标">
          <Button
            type="text"
            size="small"
            aria-label="上一个色标"
            icon={<ChevronLeft size={15} />}
            disabled={index === 0}
            onClick={() => onSelect(index - 1)}
          />
          <output aria-label="当前色标">
            {index + 1} / {stops.length}
          </output>
          <Button
            type="text"
            size="small"
            aria-label="下一个色标"
            icon={<ChevronRight size={15} />}
            disabled={index === stops.length - 1}
            onClick={() => onSelect(index + 1)}
          />
        </div>
        <NumberControl
          label="位置"
          unit="%"
          min={min(index)}
          max={max(index)}
          value={stops[index].offset}
          onChange={(offset) => setOffset(index, offset)}
        />
        <Button
          type="text"
          danger
          aria-label="删除当前色标"
          icon={<Trash2 size={15} />}
          disabled={stops.length === 2}
          onClick={() => {
            onSelect(Math.max(0, index - 1));
            onChange(stops.filter((_, position) => position !== index));
          }}
        />
      </div>
    </>
  );
}
