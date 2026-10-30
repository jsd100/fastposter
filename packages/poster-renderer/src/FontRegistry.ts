export type FontSource = {
  assetId: string;
  family: string;
  version: string;
  url: string;
  weight: number;
  style: "normal" | "italic";
};
export const fontFamily = (id: string) => `fp_${id}`;
export async function loadFonts(fonts: FontSource[]): Promise<void> {
  for (const source of fonts) {
    const url = new URL(source.url, location.href);
    if (url.origin !== location.origin)
      throw Error("Font origin is not permitted");
    for (const alias of fonts.filter((f) => f.family === source.family)) {
      const face = new FontFace(
        fontFamily(alias.assetId),
        `url("${url.href}")`,
        { weight: String(source.weight), style: source.style },
      );
      await face.load();
      document.fonts.add(face);
    }
  }
  await document.fonts.ready;
}
