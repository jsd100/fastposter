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
    const axes = fvar.offset + view.getUint16(fvar.offset + 4);
    const axisCount = view.getUint16(fvar.offset + 8);
    const axisSize = view.getUint16(fvar.offset + 10);
    if (
      axisCount > 16 ||
      axisSize < 20 ||
      axes + axisCount * axisSize > fvar.offset + fvar.length
    )
      return null;
    for (let i = 0; i < axisCount; i++) {
      const axis = axes + i * axisSize;
      if (tag(axis) !== "wght") continue;
      const minWeight = view.getInt32(axis + 4) / 65536;
      const maxWeight = view.getInt32(axis + 12) / 65536;
      if (
        !Number.isFinite(minWeight) ||
        !Number.isFinite(maxWeight) ||
        minWeight < 100 ||
        maxWeight > 900 ||
        minWeight > maxWeight
      )
        return null;
      return { minWeight, maxWeight };
    }
    return null;
  } catch {
    return null;
  }
}
export const fontFamily = (id: string) => `fp_${id}`;
const files = new Map<string, Promise<ArrayBuffer>>();
const faces = new Map<string, Promise<void>>();

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw Error("字体加载失败");
  return response.arrayBuffer();
}

export async function loadFonts(fonts: FontSource[]): Promise<void> {
  for (const source of fonts) {
    const url = new URL(source.url, location.href);
    if (url.origin !== location.origin)
      throw Error("Font origin is not permitted");
    const data = await loadOnce(files, url.href, () => fetchFont(url.href));
    const range =
      source.minWeight != null && source.maxWeight != null
        ? { minWeight: source.minWeight, maxWeight: source.maxWeight }
        : readWeightRange(data);
    const aliases = fonts.filter((f) => f.family === source.family);
    if (range) {
      // The referenced bytes are authoritative; catalog weight is only nominal.
      for (const alias of aliases) {
        alias.minWeight = range.minWeight;
        alias.maxWeight = range.maxWeight;
      }
    }
    for (const alias of aliases) {
      const min = alias.minWeight ?? alias.weight;
      const max = alias.maxWeight ?? alias.weight;
      const key = `${url.href}|${min}|${max}|${alias.style}|${alias.assetId}`;
      await loadOnce(faces, key, async () => {
        const face = new FontFace(fontFamily(alias.assetId), data, {
          weight: min === max ? String(min) : `${min} ${max}`,
          style: alias.style,
        });
        await face.load();
        document.fonts.add(face);
      });
    }
  }
  await document.fonts.ready;
}
