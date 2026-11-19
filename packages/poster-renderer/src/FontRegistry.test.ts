import { afterEach, expect, it, vi } from "vitest";
import { fontFamily, loadDocumentFonts, loadFonts } from "./FontRegistry";

const regular = {
  assetId: "registry-normal",
  version: "1",
  family: "Font registry test",
  weight: 400,
  style: "normal" as const,
  url: "/normal",
};
const bold = {
  ...regular,
  assetId: "registry-bold",
  url: "/bold",
  weight: 700,
};
const next = { ...regular, url: "/next", version: "2" };

afterEach(() => vi.unstubAllGlobals());

it("registers exact static faces and separates same-asset versions", async () => {
  const registrations: { family: string; path: number; weight: string }[] = [];
  class Face {
    constructor(
      family: string,
      data: ArrayBuffer,
      options: FontFaceDescriptors,
    ) {
      registrations.push({
        family,
        path: new Uint8Array(data)[0],
        weight: options.weight!,
      });
    }
    async load() {}
  }
  vi.stubGlobal("FontFace", Face);
  vi.stubGlobal("location", new URL("https://registry.test/"));
  vi.stubGlobal("document", { fonts: { add() {}, ready: Promise.resolve() } });
  vi.stubGlobal("fetch", async (url: string) => ({
    ok: true,
    arrayBuffer: async () =>
      Uint8Array.of(url.endsWith("/normal") ? 1 : url.endsWith("/bold") ? 2 : 3)
        .buffer,
  }));

  await loadFonts([regular, bold, next]);
  await loadDocumentFonts([regular, bold]);
  await loadDocumentFonts([next, bold]);
  expect(fontFamily(regular.assetId, regular.version)).not.toEqual(
    fontFamily(next.assetId, next.version),
  );
  expect(
    registrations.filter(
      (face) => face.family === fontFamily(regular.assetId, regular.version),
    ),
  ).toEqual([
    {
      family: fontFamily(regular.assetId, regular.version),
      path: 1,
      weight: "400",
    },
  ]);
  const groups = new Map<string, typeof registrations>();
  for (const face of registrations) {
    if (!face.family.includes("-group-")) continue;
    const group = groups.get(face.family) ?? [];
    group.push(face);
    groups.set(face.family, group);
  }
  expect(
    [...groups.values()].map((faces) =>
      faces.map(({ path, weight }) => [path, weight]),
    ),
  ).toEqual([
    [
      [1, "400"],
      [2, "700"],
    ],
    [
      [3, "400"],
      [2, "700"],
    ],
  ]);
});
