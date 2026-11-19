/**
 * The admin form's display title for a freshly picked file.
 *
 * The server rejects titles longer than 120 runes, and `maxLength` does not
 * constrain a programmatic value, so the cut happens here as well. A name that
 * is nothing but an extension (".png") keeps its name instead of becoming
 * empty.
 */
export const ASSET_TITLE_LIMIT = 120;

export function titleFromFileName(
  name: string,
  limit = ASSET_TITLE_LIMIT,
): string {
  const trimmed = name.trim();
  const base = trimmed.replace(/\.[^.]+$/, "").trim();
  const title = base || trimmed;
  return Array.from(title).slice(0, Math.max(1, limit)).join("");
}
