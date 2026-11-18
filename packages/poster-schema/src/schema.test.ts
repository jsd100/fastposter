import { describe, it, expect } from "vitest";
import valid from "../../../tests/fixtures/documents/valid-mixed.json";
import overflow from "../../../tests/fixtures/documents/overflow-width.json";
import unknown from "../../../tests/fixtures/documents/unknown-mark.json";
import gradientV2 from "../../../tests/fixtures/documents/gradient-v2.json";
import gradientInV1 from "../../../tests/fixtures/documents/gradient-in-v1.json";
import gradientConflicting from "../../../tests/fixtures/documents/gradient-conflicting-range.json";
import gradientNineStops from "../../../tests/fixtures/documents/gradient-nine-stops.json";
import gradientOffsetRange from "../../../tests/fixtures/documents/gradient-offset-out-of-range.json";
import gradientUnknownKey from "../../../tests/fixtures/documents/gradient-unknown-key.json";
import gradientAngle from "../../../tests/fixtures/documents/gradient-angle-normalize.json";
import { parseDocument, migrateDocument } from "./index";
describe("versioned document boundary", () => {
  it("preserves mixed inline marks on round trip", () =>
    expect(parseDocument(JSON.parse(JSON.stringify(valid)))).toEqual(valid));
  it.each([overflow, unknown])("rejects geometry or unknown marks", (value) =>
    expect(() => parseDocument(value)).toThrow(),
  );
  it("rejects 101 blocks", () =>
    expect(() =>
      parseDocument({
        ...valid,
        textBlocks: Array.from({ length: 101 }, (_, i) => ({
          ...valid.textBlocks[0],
          id: `b${i}`,
        })),
      }),
    ).toThrow());
  it("rejects 10001 characters", () => {
    const d = structuredClone(valid);
    d.textBlocks[0].content.content[0].content[0].text = "a".repeat(10001);
    expect(() => parseDocument(d)).toThrow();
  });
  it("enforces area and side independently", () => {
    expect(() =>
      parseDocument({ ...valid, canvas: { width: 8192, height: 4800 } }),
    ).not.toThrow();
    for (const canvas of [
      { width: 8193, height: 100 },
      { width: 8192, height: 8192 },
    ])
      expect(() => parseDocument({ ...valid, canvas })).toThrow();
  });
  it("rejects unknown versions, dangling font ids and oversized data", () => {
    expect(() => migrateDocument({ ...valid, schemaVersion: 3 })).toThrow();
    const d = structuredClone(valid);
    d.textBlocks[0].defaultStyle.fontId = "missing";
    expect(() => parseDocument(d)).toThrow();
    expect(() =>
      parseDocument({ ...valid, extra: "x".repeat(2 * 1024 * 1024) }),
    ).toThrow();
  });
});

describe("schema v2 text gradients", () => {
  it("round-trips a v2 document with default and inline gradients", () => {
    expect(parseDocument(JSON.parse(JSON.stringify(gradientV2)))).toEqual(
      gradientV2,
    );
  });
  it("accepts a v1 solid document unchanged", () => {
    expect(parseDocument(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });
  it.each([
    ["gradient in v1", gradientInV1],
    ["conflicting range config", gradientConflicting],
    ["nine stops", gradientNineStops],
    ["offset out of range", gradientOffsetRange],
    ["unknown key", gradientUnknownKey],
  ])("rejects %s", (_label, doc) => {
    expect(() => parseDocument(JSON.parse(JSON.stringify(doc)))).toThrow();
  });
  it("normalizes a linear angle into [0,360)", () => {
    const parsed = parseDocument(JSON.parse(JSON.stringify(gradientAngle)));
    const angle = (parsed.textBlocks[0].defaultStyle.color as { angle: number })
      .angle;
    expect(angle).toBe(45);
  });
});
