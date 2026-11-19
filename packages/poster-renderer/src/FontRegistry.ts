import type { FontRef } from "@fastposter/poster-schema";
import { loadOnce } from "./font-cache";

export type FontSource = {
  assetId: string;
  family: string;
  version: string;
  url: string;
  /** Nominal weight of the referenced face; requested weights are separate. */
  weight: number;
  minWeight?: number;
  maxWeight?: number;
  style: "normal" | "italic";
};

/** Reads the real `wght` axis from an sfnt buffer; WOFF2 is left to the browser. */
export function readWeightRange(
  data: ArrayBuffer,
): { minWeight: number; maxWeight: number } | null {
  try {
    const view = new DataView(data);
    if (view.byteLength < 12) return null;
    const tag = (offset: number) =>
      String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );
    if (tag(0) === "wOF2") return null;
    const count = view.getUint16(4);
    if (count < 1 || count > 128 || 12 + 16 * count > view.byteLength)
      return null;
    const tables = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < count; i++) {
      const record = 12 + 16 * i;
      tables.set(tag(record), {
        offset: view.getUint32(record + 8),
        length: view.getUint32(record + 12),
      });
    }
    const fvar = tables.get("fvar");
    if (!fvar || fvar.length < 16) return null;
    const axisOffset = view.getUint16(fvar.offset + 4);
    const axes = fvar.offset + axisOffset;
    const axisCount = view.getUint16(fvar.offset + 8);
    const axisSize = view.getUint16(fvar.offset + 10);
    if (
      fvar.offset + fvar.length > view.byteLength ||
      axisOffset < 16 ||
      axisCount > 16 ||
      axisSize < 20 ||
      axes + axisCount * axisSize > fvar.offset + fvar.length
    )
      return null;
    for (let i = 0; i < axisCount; i++) {
      const axis = axes + i * axisSize;
      if (tag(axis) !== "wght") continue;
      const minWeight = Math.ceil(view.getInt32(axis + 4) / 65536);
      const maxWeight = Math.floor(view.getInt32(axis + 12) / 65536);
      if (minWeight > maxWeight) return null;
      return { minWeight, maxWeight };
    }
    return null;
  } catch {
    return null;
  }
}

export const fontFamily = (id: string, version?: string) =>
  version ? `fp_${id}-v${version}` : `fp_${id}`;

const fontKey = (font: Pick<FontRef, "assetId" | "version">) =>
  `${font.assetId}@${font.version}`;

const files = new Map<string, Promise<ArrayBuffer>>();
const faces = new Map<string, Promise<void>>();
const groups = new Map<string, Promise<void>>();
const familyNames = new Map<string, string>();
const urls = new Map<string, string>();
const ranges = new Map<string, ReturnType<typeof readWeightRange>>();
const listeners = new Set<() => void>();
let boundsRevision = 0;

export function subscribeFontWeights(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const fontWeightRevision = () => boundsRevision;

export function fontWeightBounds(font: FontSource) {
  const key = fontKey(font);
  if (ranges.has(key)) return ranges.get(key);
  return font.minWeight != null && font.maxWeight != null
    ? { minWeight: font.minWeight, maxWeight: font.maxWeight }
    : null;
}

async function loadBytes(ref: FontRef): Promise<ArrayBuffer> {
  const key = fontKey(ref);
  return loadOnce(files, key, async () => {
    const url = new URL(
      urls.get(key) ?? `/api/v1/assets/${ref.assetId}/versions/${ref.version}`,
      location.href,
    );
    if (url.origin !== location.origin)
      throw Error("Font origin is not permitted");
    const response = await fetch(url.href);
    if (!response.ok) throw Error("字体加载失败");
    const data = await response.arrayBuffer();
    const range = readWeightRange(data);
    ranges.set(key, range);
    if (range) {
      boundsRevision++;
      for (const listener of listeners) listener();
    }
    return data;
  });
}

function registerFace(
  family: string,
  font: FontRef,
  bytes: ArrayBuffer,
  min: number,
  max: number,
) {
  const key = JSON.stringify([family, fontKey(font), font.style, min, max]);
  return loadOnce(faces, key, async () => {
    const face = new FontFace(family, bytes, {
      style: font.style,
      weight: min === max ? String(min) : `${min} ${max}`,
    });
    await face.load();
    document.fonts.add(face);
  });
}

function singleFace(font: FontRef, bytes: ArrayBuffer) {
  const range = ranges.get(fontKey(font));
  return registerFace(
    fontFamily(font.assetId, font.version),
    font,
    bytes,
    Math.max(1, range?.minWeight ?? font.weight),
    Math.min(1000, range?.maxWeight ?? font.weight),
  );
}

export async function loadFonts(fonts: FontSource[]): Promise<void> {
  for (const font of fonts) urls.set(fontKey(font), font.url);
  await Promise.all(
    fonts.map(async (font) => singleFace(font, await loadBytes(font))),
  );
}

function familiesFor(fonts: readonly FontRef[]) {
  const families = new Map<string, FontRef[]>();
  for (const font of fonts) {
    const faces = families.get(font.family) ?? [];
    faces.push(font);
    families.set(font.family, faces);
  }
  return [...families.values()];
}

function familyName(fonts: readonly FontRef[]) {
  if (fonts.length === 1) return fontFamily(fonts[0].assetId, fonts[0].version);
  const key = JSON.stringify(
    fonts.map((font) => [fontKey(font), font.style, font.weight]),
  );
  let name = familyNames.get(key);
  if (!name) {
    const lead =
      fonts.find((font) => font.weight === 400 && font.style === "normal") ??
      fonts[0];
    name = `${fontFamily(lead.assetId, lead.version)}-group-${familyNames.size}`;
    familyNames.set(key, name);
  }
  return name;
}

function fontVariable(assetId: string) {
  return `--fp-font-${assetId}`;
}

export function posterFontFamily(assetId: string) {
  return `var(${fontVariable(assetId)}, ${fontFamily(assetId)})`;
}

export function documentFontVariables(fonts: readonly FontRef[]) {
  return Object.fromEntries(
    familiesFor(fonts).flatMap((group) => {
      const family = familyName(group);
      return group.map((font) => [fontVariable(font.assetId), family]);
    }),
  );
}

export async function loadDocumentFonts(
  fonts: readonly FontRef[],
): Promise<void> {
  await Promise.all(
    familiesFor(fonts).map((group) => {
      const family = familyName(group);
      return loadOnce(groups, family, async () => {
        const data = await Promise.all(group.map(loadBytes));
        if (group.length === 1) {
          await singleFace(group[0], data[0]);
          return;
        }
        const entries = group.map((font, index) => {
          const range = ranges.get(fontKey(font));
          return {
            font,
            bytes: data[index],
            min: range?.minWeight ?? font.weight,
            max: range?.maxWeight ?? font.weight,
          };
        });
        const registrations: Promise<void>[] = [];
        for (const style of ["normal", "italic"] as const) {
          const matching = entries.filter(
            (entry) => entry.font.style === style,
          );
          if (!matching.length) continue;
          // CSS ranges must be disjoint to express the server's exact nominal
          // preference and document-order variable fallback.
          let previous: (typeof entries)[number] | undefined;
          let start = 100;
          for (let weight = 100; weight <= 901; weight++) {
            const candidate =
              weight < 901
                ? (matching.find(
                    (entry) =>
                      entry.font.weight === weight &&
                      entry.min <= weight &&
                      weight <= entry.max,
                  ) ??
                  matching.find(
                    (entry) => entry.min <= weight && weight <= entry.max,
                  ))
                : undefined;
            if (candidate === previous) continue;
            if (previous) {
              registrations.push(
                registerFace(
                  family,
                  previous.font,
                  previous.bytes,
                  start,
                  weight - 1,
                ),
              );
            }
            previous = candidate;
            start = weight;
          }
        }
        await Promise.all(registrations);
      });
    }),
  );
}
