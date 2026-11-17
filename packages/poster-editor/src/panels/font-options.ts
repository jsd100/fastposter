import type { FontSource } from "@fastposter/poster-renderer";
export function fontWeights(fonts: FontSource[], family: string | undefined) {
  return fonts
    .filter((f) => f.family === family && f.style === "normal")
    .sort((a, b) => a.weight - b.weight)
    .filter(
      (f, i, a) => a.findIndex((other) => other.weight === f.weight) === i,
    );
}
/** Variable faces expose 1-step weights inside the 100–700 product range. */
export function fontWeightRange(
  fonts: FontSource[],
  family: string | undefined,
): [number, number] | null {
  const face = fonts.find(
    (f) =>
      f.family === family &&
      f.style === "normal" &&
      f.minWeight != null &&
      f.maxWeight != null,
  );
  if (!face) return null;
  const min = Math.max(100, face.minWeight!);
  const max = Math.min(700, face.maxWeight!);
  return min <= max ? [min, max] : null;
}

export function fontFamilies(fonts: FontSource[]) {
  return [
    ...new Set(fonts.filter((f) => f.style === "normal").map((f) => f.family)),
  ].map((family) => {
    const faces = fontWeights(fonts, family);
    return faces.find((f) => f.weight === 400) ?? faces[0];
  });
}
