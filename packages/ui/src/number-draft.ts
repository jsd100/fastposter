export type NumberDraft =
  { kind: "pending" } | { kind: "invalid" } | { kind: "valid"; value: number };

const UNFINISHED = /^-?(\d*\.)?$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

export function classifyNumberDraft(
  raw: string,
  min?: number,
  max?: number,
): NumberDraft {
  const text = raw.trim();
  if (UNFINISHED.test(text)) return { kind: "pending" };
  if (!DECIMAL.test(text)) return { kind: "invalid" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  if (min !== undefined && value < min) return { kind: "invalid" };
  if (max !== undefined && value > max) return { kind: "invalid" };
  return { kind: "valid", value };
}
