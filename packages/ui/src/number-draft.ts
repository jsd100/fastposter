export type NumberDraft =
  { kind: "pending" } | { kind: "invalid" } | { kind: "valid"; value: number };

const UNFINISHED = /^-?(\d*\.)?$/;
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

export function classifyNumberDraft(
  raw: string,
  min?: number,
  max?: number,
): NumberDraft {
  const text = raw.normalize("NFKC").replace(/−/g, "-").trim();
  if (UNFINISHED.test(text)) return { kind: "pending" };
  if (!DECIMAL.test(text)) return { kind: "invalid" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  if (min !== undefined && value < min) return { kind: "invalid" };
  if (max !== undefined && value > max) return { kind: "invalid" };
  return { kind: "valid", value };
}

/**
 * One step from `base`, clamped to the same inclusive bounds the draft
 * validator enforces, and rounded to hide binary fraction noise.
 */
export function stepNumber(
  base: number,
  delta: number,
  min?: number,
  max?: number,
): number {
  let next = base + delta;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return Number(next.toPrecision(12));
}
