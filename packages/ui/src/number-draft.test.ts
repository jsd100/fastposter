import { describe, expect, it } from "vitest";
import { classifyNumberDraft, stepNumber } from "./number-draft";

describe("stepNumber", () => {
  it("rounds floating point steps to twelve significant digits", () => {
    expect(stepNumber(0.2, 0.1)).toBe(0.3);
    expect(stepNumber(64, 1)).toBe(65);
  });

  it("clamps to inclusive bounds and stays at the bound", () => {
    expect(stepNumber(4096, 1, 1, 4096)).toBe(4096);
    expect(stepNumber(1, -1, 1, 4096)).toBe(1);
    expect(stepNumber(100, 1, 0, 100.099)).toBe(100.099);
  });

  it("steps negative and fractional amounts in both directions", () => {
    expect(stepNumber(80, -1, 1, 4096)).toBe(79);
    expect(stepNumber(-0.1, -0.2, -100, 1000)).toBe(-0.3);
    expect(stepNumber(-0.3, 0.2, -100, 1000)).toBe(-0.1);
  });

  it("keeps a missing bound open", () => {
    expect(stepNumber(500, 1, 1)).toBe(501);
    expect(stepNumber(500, 1, undefined, 100)).toBe(100);
    expect(stepNumber(-5, -1)).toBe(-6);
  });
});

describe("classifyNumberDraft", () => {
  it.each([
    ["１２．５", 12.5],
    ["−2.5", -2.5],
  ] as const)("accepts normalized numeric text %j", (raw, value) => {
    expect(classifyNumberDraft(raw)).toEqual({ kind: "valid", value });
  });
  it.each(["", " ", "-", ".", "-.", "1.", "12.", "0.", "4096."])(
    "treats %j as an unfinished draft instead of a number",
    (raw) => {
      expect(classifyNumberDraft(raw)).toEqual({ kind: "pending" });
    },
  );

  it.each(["0", "-12.5", "1", "4096", "0.05", "-0.5", ".5", "-.5", "1234"])(
    "accepts %j as a finite number",
    (raw) => {
      expect(classifyNumberDraft(raw)).toEqual({
        kind: "valid",
        value: Number(raw),
      });
    },
  );

  it.each([
    "NaN",
    "Infinity",
    "-Infinity",
    "1x",
    "1.2.3",
    "1e5",
    "--1",
    "+1",
    "0x10",
  ])("rejects %j as invalid", (raw) => {
    expect(classifyNumberDraft(raw)).toEqual({ kind: "invalid" });
  });

  it("keeps the bounds inclusive and rejects only outside them", () => {
    expect(classifyNumberDraft("4097", 1, 4096)).toEqual({ kind: "invalid" });
    expect(classifyNumberDraft("4096", 1, 4096)).toEqual({
      kind: "valid",
      value: 4096,
    });
    expect(classifyNumberDraft("0.9", 1, 4096)).toEqual({ kind: "invalid" });
    expect(classifyNumberDraft("-101", -100, 1000)).toEqual({
      kind: "invalid",
    });
    expect(classifyNumberDraft("-2.5", -100, 1000)).toEqual({
      kind: "valid",
      value: -2.5,
    });
  });

  it("stays a draft when a bound is missing", () => {
    expect(classifyNumberDraft("-", undefined, 100)).toEqual({
      kind: "pending",
    });
    expect(classifyNumberDraft("500", 1)).toEqual({
      kind: "valid",
      value: 500,
    });
  });

  it("never turns an empty or partial draft into zero", () => {
    for (const raw of ["", "-", ".", "-.", "1."]) {
      expect(classifyNumberDraft(raw, 0, 1)).not.toEqual({
        kind: "valid",
        value: 0,
      });
    }
  });
});
