import {
  Button,
  ColorPicker,
  Input,
  Segmented,
  type RefSelectProps,
} from "antd";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { TextColor } from "@fastposter/poster-schema";
import {
  gradientCSS,
  isGradientColor,
  type TextGradient,
} from "@fastposter/poster-renderer";
import { GradientDirection, GradientStops } from "./GradientControls";
import { initialGradientStops } from "./gradient-controls";
import { TextColorPresetSelect } from "./TextColorPresetSelect";
import styles from "./TextColorField.module.css";

type ColorType = "solid" | TextGradient["type"];
const colorTypes: { label: string; value: ColorType }[] = [
  { label: "纯色", value: "solid" },
  { label: "线性渐变", value: "linear" },
  { label: "径向渐变", value: "radial" },
];

export function TextColorPanel({
  value,
  fallbackColor,
  sample,
  phone,
  pickerOpen,
  onPickerOpenChange,
  pickerTrigger,
  presetsOpen,
  onPresetsOpenChange,
  presetTrigger,
  onChange,
  onDone,
}: {
  value: TextColor | null;
  fallbackColor: string;
  sample: string;
  phone: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  pickerTrigger: RefObject<HTMLButtonElement | null>;
  presetsOpen: boolean;
  onPresetsOpenChange: (open: boolean) => void;
  presetTrigger: RefObject<RefSelectProps | null>;
  onChange: (value: TextColor) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const memory = useRef<{
    gradient?: TextGradient;
    angle: number;
    centerX: number;
    centerY: number;
  }>({ angle: 90, centerX: 50, centerY: 50 });
  const gradient = isGradientColor(value) ? value : null;
  const selected = Math.min(index, (gradient?.stops.length ?? 1) - 1);
  const solid = typeof value === "string" ? value : fallbackColor;
  const color = gradient?.stops[selected].color ?? solid;
  const popupContainer = (node: HTMLElement) =>
    node.closest<HTMLElement>("[data-text-color-layer]") ?? document.body;

  useLayoutEffect(() => {
    if (!phone) layer.current?.focus({ preventScroll: true });
  }, [phone]);

  function remember(next: TextGradient) {
    memory.current.gradient = next;
    if (next.type === "linear") memory.current.angle = next.angle;
    else {
      memory.current.centerX = next.centerX;
      memory.current.centerY = next.centerY;
    }
  }

  function applyGradient(next: TextGradient) {
    remember(next);
    onChange(next);
  }

  function selectStop(next: number) {
    setIndex(next);
    setHexDraft(null);
  }

  function switchType(type: ColorType) {
    if (type === (gradient?.type ?? "solid")) return;
    onPickerOpenChange(false);
    onPresetsOpenChange(false);
    setHexDraft(null);
    if (gradient) remember(gradient);
    if (type === "solid") {
      if (gradient) onChange(gradient.stops[0].color);
      return;
    }
    const { gradient: previous, angle, centerX, centerY } = memory.current;
    const stops =
      gradient?.stops ??
      (previous
        ? [{ ...previous.stops[0], color: solid }, ...previous.stops.slice(1)]
        : initialGradientStops(typeof value === "string" ? value : null));
    const base = {
      rangeId: gradient?.rangeId ?? previous?.rangeId ?? "",
      stops,
    };
    applyGradient(
      type === "linear"
        ? { type, angle, ...base }
        : { type, centerX, centerY, ...base },
    );
  }

  function applyColor(next: string) {
    if (next.toLowerCase() === color.toLowerCase() && value !== null) return;
    if (!gradient) onChange(next);
    else
      applyGradient({
        ...gradient,
        stops: gradient.stops.map((stop, i) =>
          i === selected ? { ...stop, color: next } : stop,
        ),
      });
  }

  return (
    <div
      ref={layer}
      role={phone ? undefined : "dialog"}
      aria-label={phone ? undefined : "编辑文字颜色"}
      tabIndex={phone ? undefined : -1}
      className={phone ? styles.phonePanel : styles.panel}
      data-text-color-layer=""
      data-fp-popup={phone ? undefined : ""}
    >
      <div className={styles.modeBar}>
        <Segmented<ColorType>
          block
          aria-label="颜色类型"
          options={colorTypes}
          value={gradient?.type ?? "solid"}
          onChange={switchType}
        />
      </div>
      <div className={styles.scrollBody}>
        <div className={styles.preview} aria-label="文字颜色预览">
          <strong
            style={
              gradient
                ? {
                    backgroundImage: gradientCSS(gradient),
                    backgroundClip: "text",
                    color: "transparent",
                  }
                : { color }
            }
          >
            {Array.from(sample).slice(0, 10).join("")}
          </strong>
        </div>
        <TextColorPresetSelect
          value={value}
          open={presetsOpen}
          onOpenChange={onPresetsOpenChange}
          selectRef={presetTrigger}
          getPopupContainer={popupContainer}
          onChange={(next) => {
            selectStop(0);
            if (isGradientColor(next)) applyGradient(next);
            else applyColor(next);
          }}
        />
        {gradient && (
          <>
            <GradientDirection value={gradient} onChange={applyGradient} />
            <GradientStops
              stops={gradient.stops}
              index={selected}
              onSelect={selectStop}
              onChange={(stops) => applyGradient({ ...gradient, stops })}
            />
          </>
        )}
        <div className={styles.colorRow}>
          <ColorPicker
            value={color}
            open={pickerOpen}
            format="hex"
            disabledFormat
            destroyOnHidden
            placement="topLeft"
            onOpenChange={(open) => {
              setHexDraft(null);
              onPickerOpenChange(open);
            }}
            onChange={(next) => applyColor(next.toHexString())}
            getPopupContainer={popupContainer}
            panelRender={(panel) => <div data-fp-popup="">{panel}</div>}
          >
            <Button
              ref={pickerTrigger}
              aria-label="打开取色器"
              aria-expanded={pickerOpen}
              className={styles.colorPicker}
            >
              <span className={styles.colorChip} aria-hidden="true">
                <span style={{ backgroundColor: color }} />
              </span>
            </Button>
          </ColorPicker>
          <Input
            aria-label="文字颜色 HEX"
            prefix="HEX"
            value={hexDraft ?? color.toUpperCase()}
            spellCheck={false}
            autoComplete="off"
            maxLength={9}
            onBlur={() => setHexDraft(null)}
            onPressEnter={(event) => event.currentTarget.blur()}
            onChange={(event) => {
              const draft = event.target.value;
              setHexDraft(draft);
              const hex = draft.replace(/^#/, "");
              if (/^(?:[\da-f]{6}|[\da-f]{8})$/i.test(hex))
                applyColor(`#${hex.toLowerCase()}`);
            }}
          />
        </div>
      </div>
      <div className={styles.footer}>
        <Button type="primary" aria-label="关闭颜色面板" onClick={onDone}>
          完成
        </Button>
      </div>
    </div>
  );
}
