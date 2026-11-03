import { loadOnce } from "./font-cache";

export type FontSource = {
  assetId: string;
  family: string;
  version: string;
  url: string;
  weight: number;
  style: "normal" | "italic";
};
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
    for (const alias of fonts.filter((f) => f.family === source.family)) {
      const key = `${url.href}|${source.weight}|${source.style}|${alias.assetId}`;
      await loadOnce(faces, key, async () => {
        const face = new FontFace(fontFamily(alias.assetId), data, {
          weight: String(source.weight),
          style: source.style,
        });
        await face.load();
        document.fonts.add(face);
      });
    }
  }
  await document.fonts.ready;
}
