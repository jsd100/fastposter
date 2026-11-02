import { describe, expect, it } from "vitest";
import { classifyNumberDraft } from "./number-draft";

describe("classifyNumberDraft", () => {
  it.each(["", " ", "-", ".", "-.", "1.", "12.", "0.", "4096."])(
    "treats %j as an unfinished draft instead of a number",
    (raw) => {
      expect(classifyNumberDraft(raw)).toEqual({ kind: "pending" });
    },
  );

  it.each(["0", "-12.5", "1", "4096", "0.05", "-0.5", "1234"])(
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
