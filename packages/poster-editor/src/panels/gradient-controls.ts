import type { TextGradient } from "@fastposter/poster-renderer";
import { defaultGradientStops } from "./gradient-presets";

type Stops = TextGradient["stops"];

export function normalizeGradientAngle(value: number) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped || 0;
}

export function angleFromPoint(dx: number, dy: number) {
  if (Math.hypot(dx, dy) < 4) return null;
  return normalizeGradientAngle(
    Math.round((Math.atan2(dx, -dy) * 180) / Math.PI),
  );
}

export function percentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function rgba(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    hex.length === 9 ? parseInt(hex.slice(7), 16) : 255,
  ];
}

function mix(from: string, to: string, amount: number) {
  const source = rgba(from);
  const destination = rgba(to);
  const sourceAlpha = source[3] * (1 - amount);
  const destinationAlpha = destination[3] * amount;
  const alpha = sourceAlpha + destinationAlpha;
  // CSS interpolates transparent stops in premultiplied sRGB.
  const channels = source
    .slice(0, 3)
    .map((value, index) =>
      Math.round(
        alpha
          ? (value * sourceAlpha + destination[index] * destinationAlpha) /
              alpha
          : value,
      ),
    );
  if (alpha < 255) channels.push(Math.round(alpha));
  return (
    "#" + channels.map((value) => value.toString(16).padStart(2, "0")).join("")
  );
}

export function initialGradientStops(solid: string | null): Stops {
  if (!solid) return defaultGradientStops;
  const [r, g, b] = rgba(solid);
  const light = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255 > 0.5;
  const companion = (light ? "#000000" : "#ffffff") + solid.slice(7);
  return [
    { color: solid, offset: 0 },
    { color: mix(solid, companion, 0.35), offset: 100 },
  ];
}

export function addGradientStop(stops: Stops) {
  let index = 1;
  let widest = -1;
  for (let i = 1; i < stops.length; i++) {
    const width = stops[i].offset - stops[i - 1].offset;
    if (width > widest) {
      widest = width;
      index = i;
    }
  }
  const left = stops[index - 1];
  const right = stops[index];
  return {
    index,
    stops: [
      ...stops.slice(0, index),
      {
        color: widest === 0 ? left.color : mix(left.color, right.color, 0.5),
        offset: (left.offset + right.offset) / 2,
      },
      ...stops.slice(index),
    ],
  };
}
