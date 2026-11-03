export function loadOnce<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = loader().catch((error: unknown) => {
    if (cache.get(key) === pending) cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  return pending;
}
