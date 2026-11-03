import {
  fontFamily,
  loadFonts,
  type FontSource,
} from "@fastposter/poster-renderer";
import { useEffect, useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@fastposter/ui";
import { fontWeights } from "../panels/font-options";
import { fontCategory, fontDisplayName, orderFamilies } from "./catalog";
import styles from "./FontPicker.module.css";

const categoryOrder = ["通用", "文艺", "标题", "西文", "其他"] as const;

export function FontPicker({
  fonts,
  value,
  sample,
  disabled,
  onChoose,
}: {
  fonts: FontSource[];
  value: string;
  sample: string;
  disabled?: boolean;
  onChoose: (font: FontSource) => void;
}) {
  const families = useMemo(() => {
    const names = orderFamilies([
      ...new Set(
        fonts.filter((font) => font.style === "normal").map((font) => font.family),
      ),
    ]);
    return names.flatMap((family) => {
      const faces = fontWeights(fonts, family);
      const face = faces.find((candidate) => candidate.weight === 400) ?? faces[0];
      if (!face) return [];
      return [
        {
          face,
          family,
          category: fontCategory(family) ?? "其他",
        },
      ];
    });
  }, [fonts]);
  const options = useMemo<ComboboxOption[]>(
    () =>
      [...families]
        .sort(
          (a, b) =>
            categoryOrder.indexOf(a.category as (typeof categoryOrder)[number]) -
            categoryOrder.indexOf(b.category as (typeof categoryOrder)[number]),
        )
        .map(({ face, family, category }) => ({
          value: face.assetId,
          label: fontDisplayName(family),
          group: category,
        })),
    [families],
  );
  const activeFamily = fonts.find((font) => font.assetId === value)?.family;
  const selected = families.find((entry) => entry.family === activeFamily);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const preview = families.find(
    (entry) =>
      entry.family ===
      (highlighted
        ? fonts.find((font) => font.assetId === highlighted)?.family
        : activeFamily),
  );
  const previewId = preview?.face.assetId ?? null;
  useEffect(() => {
    if (!previewId || previewId === loaded) return;
    const face = fonts.find((font) => font.assetId === previewId);
    if (!face) return;
    let active = true;
    setFailed(null);
    loadFonts([face])
      .then(() => {
        if (active) setLoaded(previewId);
      })
      .catch(() => {
        if (active) setFailed(previewId);
      });
    return () => {
      active = false;
    };
  }, [previewId, loaded, fonts]);
  return (
    <Combobox
      aria-label="文字字体"
      value={selected?.face.assetId ?? ""}
      options={options}
      placeholder={activeFamily ? "搜索字体" : "混合"}
      disabled={disabled}
      onValueChange={(assetId) => {
        const face = fonts.find((font) => font.assetId === assetId);
        if (face) onChoose(face);
      }}
      onHighlightChange={setHighlighted}
      preview={
        preview ? (
          <div
            className={styles.preview}
            data-fp-font-preview=""
            data-font-family={preview.family}
            style={{ fontFamily: fontFamily(preview.face.assetId) }}
          >
            <span className={styles.sample}>{sample}</span>
            <span className={styles.caption}>
              {fontDisplayName(preview.family)}
              {failed === previewId ? " · 预览加载失败" : " · 预览"}
            </span>
          </div>
        ) : undefined
      }
    />
  );
}
