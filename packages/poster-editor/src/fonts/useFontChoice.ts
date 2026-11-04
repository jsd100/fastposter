import { useEffect, useRef, useState } from "react";
import { loadFonts, type FontSource } from "@fastposter/poster-renderer";
import type { InlineStyle, PosterDocument } from "@fastposter/poster-schema";
import { useNotify } from "@fastposter/ui";
import {
  prepareFontChange,
  type FontChoiceIntent,
  type PreparedFontChange,
} from "./prepare-change";
import type { FontTarget } from "../text/selection";

export type FontChoiceSnapshot = {
  document: PosterDocument;
  target: FontTarget | null;
  scope: string;
  cursorStyle?: InlineStyle;
};

export type FontChoiceError = {
  message: string;
  action?: { label: string; run: () => void };
};

export function sameTarget(a: FontTarget | null, b: FontTarget | null) {
  return (
    !!a &&
    !!b &&
    a.blockId === b.blockId &&
    a.target.kind === b.target.kind &&
    a.target.from === b.target.from &&
    a.target.to === b.target.to
  );
}

function sameSnapshot(a: FontChoiceSnapshot, b: FontChoiceSnapshot) {
  return (
    a.scope === b.scope &&
    a.document === b.document &&
    sameTarget(a.target, b.target) &&
    JSON.stringify(a.cursorStyle ?? null) ===
      JSON.stringify(b.cursorStyle ?? null)
  );
}

function sourcesFor(
  previous: PosterDocument,
  next: PosterDocument,
  fonts: FontSource[],
  chosen: FontSource,
) {
  const key = (font: { assetId: string; version: string }) =>
    `${font.assetId}@${font.version}`;
  const existing = new Set(previous.fonts.map(key));
  const sources = new Map<string, FontSource>([[key(chosen), chosen]]);
  for (const ref of next.fonts) {
    if (existing.has(key(ref))) continue;
    const source =
      fonts.find(
        (font) => font.assetId === ref.assetId && font.version === ref.version,
      ) ?? fonts.find((font) => font.assetId === ref.assetId);
    if (source) sources.set(key(source), source);
  }
  return [...sources.values()];
}

export function useFontChoice({
  scope,
  fonts,
  checkFonts,
  snapshot,
  apply,
}: {
  scope: string;
  fonts: FontSource[];
  checkFonts: (candidate: PosterDocument) => Promise<void>;
  snapshot: () => FontChoiceSnapshot;
  apply: (change: PreparedFontChange) => void;
}) {
  const { show } = useNotify();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FontChoiceError | null>(null);
  const pendingRef = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const fontsRef = useRef(fonts);
  fontsRef.current = fonts;
  const checkRef = useRef(checkFonts);
  checkRef.current = checkFonts;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    generation.current += 1;
    pendingRef.current = false;
    setPending(false);
    setError(null);
  }, [scope]);

  async function choose(font: FontSource, intent: FontChoiceIntent = "family") {
    if (pendingRef.current) return;
    const started = snapshotRef.current();
    if (!started.target) return;
    const run = ++generation.current;
    const current = () => {
      if (!alive.current || run !== generation.current) return false;
      return sameSnapshot(started, snapshotRef.current());
    };
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const change = prepareFontChange(
        started.document,
        started.target,
        font,
        fontsRef.current,
        { cursorStyle: started.cursorStyle, intent },
      );
      await loadFonts(
        sourcesFor(started.document, change.nextDocument, fontsRef.current, font),
      );
      if (!current()) return;
      await checkRef.current(change.probeDocument);
      if (!current()) return;
      applyRef.current(change);
      if (change.adjustments.length)
        show({
          tone: "info",
          title: "字体样式已调整",
          description: change.adjustments.join("；"),
        });
    } catch (e) {
      if (!current()) return;
      const message = e instanceof Error ? e.message : "更换字体失败";
      const alternative = fontsRef.current.find(
        (candidate) =>
          candidate.family === "Noto Sans SC" &&
          candidate.weight === 400 &&
          candidate.style === "normal" &&
          candidate.assetId !== font.assetId,
      );
      const useChinese = message.includes("缺少字形") && alternative;
      setError({
        message,
        action: useChinese
          ? {
              label: "改用思源黑体",
              run: () => void choose(alternative, intent),
            }
          : { label: "重试", run: () => void choose(font, intent) },
      });
    } finally {
      if (run === generation.current) pendingRef.current = false;
      if (alive.current && run === generation.current) setPending(false);
    }
  }

  return { choose, pending, error };
}
