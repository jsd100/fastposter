import { describe, expect, it } from "vitest";
import { ASSET_TITLE_LIMIT, titleFromFileName } from "./asset-title";

describe("titleFromFileName", () => {
  it("drops the last extension so the title reads like a name", () => {
    expect(titleFromFileName("风景.png")).toBe("风景");
    expect(titleFromFileName("my.photo.jpeg")).toBe("my.photo");
    expect(titleFromFileName("cover.WEBP")).toBe("cover");
  });

  it("keeps names that have no extension to drop", () => {
    expect(titleFromFileName("background")).toBe("background");
    expect(titleFromFileName(".png")).toBe(".png");
    expect(titleFromFileName("a.")).toBe("a.");
  });

  it("trims incidental whitespace", () => {
    expect(titleFromFileName("  a.png  ")).toBe("a");
  });

  it("cuts to the server's 120-code-point limit", () => {
    const title = titleFromFileName("名".repeat(130) + ".png");
    expect(Array.from(title)).toHaveLength(ASSET_TITLE_LIMIT);
    expect(title).toBe("名".repeat(ASSET_TITLE_LIMIT));
  });

  it("counts surrogate pairs as one character", () => {
    const title = titleFromFileName("🎨".repeat(130) + ".png");
    expect(Array.from(title)).toHaveLength(ASSET_TITLE_LIMIT);
    expect(title.endsWith("🎨")).toBe(true);
  });

  it("honours an explicit limit", () => {
    expect(titleFromFileName("abcdef.png", 3)).toBe("abc");
  });
});
