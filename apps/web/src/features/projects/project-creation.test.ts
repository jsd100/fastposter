import { describe, it, expect } from "vitest";
import {
  buildProjectFromBackground,
  normalizeTitle,
  type ProjectBackground,
} from "./project-creation";

const background: ProjectBackground = {
  id: "asset-123",
  version: "7",
  width: 1600,
  height: 900,
};

describe("buildProjectFromBackground / normalizeTitle (FP-05, FP-06)", () => {
  it("caps a long Chinese title at 120 Unicode code points, not UTF-16 units", () => {
    const title = normalizeTitle("春".repeat(130) + ".png");
    expect(Array.from(title).length).toBe(120);
    expect(title).toBe("春".repeat(120));
    // Supplementary-plane characters are one code point but two UTF-16 units;
    // a code-point cap must not split the surrogate pair.
    const astral = "a" + "😀".repeat(130);
    const capped = normalizeTitle(astral);
    expect(Array.from(capped).length).toBe(120);
    expect(Array.from(capped).at(-1)).toBe("😀");
  });

  it("strips control characters so the title is acceptable to the server", () => {
    expect(normalizeTitle("海\u0000报\n\t.png")).toBe("海报");
    expect(normalizeTitle("标\u007f题\u0085.png")).toBe("标题");
    expect(normalizeTitle("春日\u001f海报.png")).toBe("春日海报");
  });

  it("falls back to 未命名海报 when the file name has no usable title", () => {
    expect(normalizeTitle("")).toBe("未命名海报");
    expect(normalizeTitle(".png")).toBe("未命名海报");
    // Control characters / whitespace only become empty once they are removed.
    expect(normalizeTitle("\u0000\u0001\u0002.png")).toBe("未命名海报");
    expect(normalizeTitle("   \t\n.png")).toBe("未命名海报");
  });

  it("keeps the asset's original dimensions and reference in the document", () => {
    const input = buildProjectFromBackground("春日海报", background);
    expect(input.title).toBe("春日海报");
    expect(JSON.parse(input.document)).toEqual({
      schemaVersion: 1,
      canvas: { width: 1600, height: 900 },
      background: { assetId: "asset-123", version: "7" },
      fonts: [],
      textBlocks: [],
    });
  });
});
