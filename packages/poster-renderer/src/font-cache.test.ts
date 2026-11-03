import { expect, test } from "vitest";
import { loadOnce } from "./font-cache";

test("loadOnce shares one pending loader between callers with the same key", async () => {
  const cache = new Map<string, Promise<string>>();
  let calls = 0;
  let release: (value: string) => void = () => {};
  const gate = new Promise<string>((resolve) => {
    release = resolve;
  });
  const loader = () => {
    calls++;
    return gate;
  };
  const first = loadOnce(cache, "family-400", loader);
  const second = loadOnce(cache, "family-400", loader);
  expect(calls).toBe(1);
  release("loaded");
  await expect(Promise.all([first, second])).resolves.toEqual([
    "loaded",
    "loaded",
  ]);
  await expect(loadOnce(cache, "family-400", loader)).resolves.toBe("loaded");
  expect(calls).toBe(1);
  await expect(loadOnce(cache, "family-700", loader)).resolves.toBe("loaded");
  expect(calls).toBe(2);
});

test("loadOnce retries after a rejection instead of caching it forever", async () => {
  const cache = new Map<string, Promise<string>>();
  let calls = 0;
  await expect(
    loadOnce(cache, "font.ttf", async () => {
      calls++;
      throw new Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(cache.size).toBe(0);
  await expect(
    loadOnce(cache, "font.ttf", async () => {
      calls++;
      return "loaded";
    }),
  ).resolves.toBe("loaded");
  expect(calls).toBe(2);
});
