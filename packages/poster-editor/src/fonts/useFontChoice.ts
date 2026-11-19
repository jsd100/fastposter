import { useEffect, useRef, useState } from "react";
import {
  loadDocumentFonts,
  loadFonts,
  type FontSource,
} from "@fastposter/poster-renderer";
import type { InlineStyle, PosterDocument } from "@fastposter/poster-schema";
import { useNotify } from "@fastposter/ui";
import {
  prepareFontChange,
  fontTargetIds,
  type FontChoiceIntent,
  type PreparedFontChange,
} from "./prepare-change";
import type { FontTarget } from "../text/selection";
import { documentFontSources } from "./catalog";

export type FontChoiceSnapshot = {
  document: PosterDocument;
  target: FontTarget | null;
  scope: string;
  cursorStyle?: InlineStyle;
  cursorItalic?: boolean;
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
    a.cursorItalic === b.cursorItalic &&
    JSON.stringify(a.cursorStyle ?? null) ===
      JSON.stringify(b.cursorStyle ?? null)
  );
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
  const errorTarget = useRef<FontChoiceSnapshot | null>(null);
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
    errorTarget.current = null;
    setPending(false);
    setError(null);
  }, [scope]);
  useEffect(() => {
    if (errorTarget.current && !sameSnapshot(errorTarget.current, snapshot())) {
      errorTarget.current = null;
      setError(null);
    }
  });

  async function choose(
    font: FontSource,
    intent: FontChoiceIntent = "family",
    requestedWeight?: number,
    expected?: FontChoiceSnapshot,
  ) {
    if (pendingRef.current) return;
    const started = snapshotRef.current();
    if (!started.target || (expected && !sameSnapshot(expected, started)))
      return;
    const run = ++generation.current;
    const current = () => {
      if (!alive.current || run !== generation.current) return false;
      return sameSnapshot(started, snapshotRef.current());
    };
    pendingRef.current = true;
    setPending(true);
    setError(null);
    errorTarget.current = null;
    try {
      const sources = documentFontSources(
        [...fontsRef.current, font],
        started.document.fonts,
      );
      const selected =
        sources.find((item) => item.assetId === font.assetId) ?? font;
      const families = new Set([selected.family]);
      const block = started.document.textBlocks.find(
        (item) => item.id === started.target?.blockId,
      );
      if (intent === "weight" && block) {
        for (const id of fontTargetIds(
          block,
          started.target.target,
          started.cursorStyle?.fontId,
        )) {
          const source = sources.find((item) => item.assetId === id);
          if (source) families.add(source.family);
        }
      }
      // The catalog carries nominal weights. Inspect the chosen immutable data
      // before resolving a continuous weight, even if no preview was opened.
      await loadFonts([selected]);
      await Promise.allSettled(
        sources
          .filter(
            (source) =>
              source.assetId !== selected.assetId &&
              families.has(source.family),
          )
          .map((source) => loadFonts([source])),
      );
      if (!current()) return;
      const change = prepareFontChange(
        started.document,
        started.target,
        selected,
        sources,
        {
          cursorStyle: started.cursorStyle,
          cursorItalic: started.cursorItalic,
          intent,
          requestedWeight,
        },
      );
      await loadDocumentFonts(change.nextDocument.fonts);
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
      errorTarget.current = started;
      setError({
        message,
        action: useChinese
          ? {
              label: "改用思源黑体",
              run: () => void choose(alternative, "family", undefined, started),
            }
          : {
              label: "重试",
              run: () => void choose(font, intent, requestedWeight, started),
            },
      });
    } finally {
      if (run === generation.current) pendingRef.current = false;
      if (alive.current && run === generation.current) setPending(false);
    }
  }

  return { choose, pending, error };
}
