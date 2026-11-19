import { fontWeightBounds, type FontSource } from "@fastposter/poster-renderer";
export function fontWeights(fonts: FontSource[], family: string | undefined) {
  return fonts
    .filter((f) => f.family === family && f.style === "normal")
    .sort((a, b) => a.weight - b.weight)
    .filter(
      (f, i, a) => a.findIndex((other) => other.weight === f.weight) === i,
    );
}

export function familySupportsWeight(
  fonts: FontSource[],
  family: string,
  weight: number,
  style: FontSource["style"] = "normal",
) {
  return fonts.some((font) => {
    if (font.family !== family || font.style !== style) return false;
    const bounds = fontWeightBounds(font);
    return bounds
      ? weight >= bounds.minWeight && weight <= bounds.maxWeight
      : font.weight === weight;
  });
}
/** Variable faces expose 1-step weights inside the 100–700 product range. */
export function fontWeightRange(
  fonts: FontSource[],
  family: string | undefined,
): [number, number] | null {
  const range = fonts
    .filter((font) => font.family === family && font.style === "normal")
    .map(fontWeightBounds)
    .find((weight) => weight && weight.minWeight < weight.maxWeight);
  if (!range) return null;
  const min = Math.max(100, range.minWeight);
  const max = Math.min(700, range.maxWeight);
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
