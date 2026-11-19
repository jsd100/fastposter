/**
 * Both sites share this deployment switch: gradient writes are enabled only
 * when the server write gate is enabled in the same release. Reads and exports
 * of v2 documents never consult it.
 */
type EnvLike = Record<string, string | undefined>;

export function gradientWritesEnabled(env?: EnvLike): boolean {
  const source =
    env ?? (import.meta as ImportMeta & { env?: EnvLike }).env ?? {};
  return source.VITE_GRADIENT_WRITES === "1";
}
