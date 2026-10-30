import type { FontSource } from "@fastposter/poster-renderer";
export function fontWeights(fonts: FontSource[], family: string | undefined) {
  return fonts
    .filter((f) => f.family === family && f.style === "normal")
    .sort((a, b) => a.weight - b.weight)
    .filter(
      (f, i, a) => a.findIndex((other) => other.weight === f.weight) === i,
    );
}
export function fontFamilies(fonts: FontSource[]) {
  return [
    ...new Set(fonts.filter((f) => f.style === "normal").map((f) => f.family)),
  ].map((family) => {
    const faces = fontWeights(fonts, family);
    return faces.find((f) => f.weight === 400) ?? faces[0];
  });
}
