#!/usr/bin/env node
// Checks that each app's statically imported entry modules stay within their
// intended dependency boundary. Expects a Vite build with --manifest and
// --sourcemap. Usage: node tools/check-entry-boundary.mjs <build-dir>...
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const forbidden = {
  web: [/@tiptap\//, /prosemirror-/],
  admin: [/@tiptap\//, /prosemirror-/],
  renderer: [/node_modules\/antd\//, /packages\/ui\/src\//, /@fastposter\+ui@/],
};

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: node tools/check-entry-boundary.mjs <build-dir>...");
  process.exit(2);
}

let failed = false;

for (const dir of dirs) {
  const name = dir.replace(/\/+$/, "").split("/").pop();
  const patterns = forbidden[name];
  if (!patterns) {
    console.error(`${name}: FAIL unknown app boundary check`);
    failed = true;
    continue;
  }
  let raw;
  for (const candidate of [
    join(dir, ".vite", "manifest.json"),
    join(dir, "manifest.json"),
  ]) {
    try {
      raw = await readFile(candidate, "utf8");
      break;
    } catch {
      // try the next location
    }
  }
  if (!raw) {
    console.error(`${name}: FAIL manifest not found in ${dir}`);
    failed = true;
    continue;
  }
  const manifest = JSON.parse(raw);
  const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry);
  if (!entry) {
    console.error(`${name}: FAIL no entry chunk in manifest`);
    failed = true;
    continue;
  }
  const seen = new Set();
  const queue = [entry[1]];
  while (queue.length > 0) {
    const chunk = queue.shift();
    const key = chunk.file;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const imported of chunk.imports ?? []) {
      if (manifest[imported]) queue.push(manifest[imported]);
    }
  }
  const sources = new Set();
  let missingMap = false;
  for (const file of seen) {
    if (!file.endsWith(".js")) continue;
    let map;
    try {
      map = JSON.parse(await readFile(join(dir, `${file}.map`), "utf8"));
    } catch {
      // Rolldown emits a small runtime shim without a sourcemap.
      if (/^assets\/rolldown-runtime-/.test(file)) continue;
      console.error(`${name}: FAIL missing sourcemap for ${file}`);
      missingMap = true;
      continue;
    }
    for (const source of map.sources ?? []) sources.add(source);
  }
  const hits = [...sources]
    .filter((source) => patterns.some((pattern) => pattern.test(source)))
    .sort();
  if (hits.length > 0 || missingMap) {
    failed = true;
    if (hits.length > 0)
      console.error(`${name}: FAIL entry reaches forbidden modules`);
    for (const hit of hits) console.error(`  ${hit}`);
  } else {
    console.log(
      `${name}: PASS ${seen.size} entry chunk(s), ${sources.size} source(s)`,
    );
  }
}

process.exit(failed ? 1 : 0);
