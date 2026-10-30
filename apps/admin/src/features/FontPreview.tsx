import { useEffect, useState } from "react";
import type { ResourceDTO } from "@fastposter/api-client";
import { loadFonts, fontFamily } from "@fastposter/poster-renderer";
export function FontPreview({ resource }: { resource: ResourceDTO }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const asset = resource.asset;
    if (!asset?.url || !resource.family) return;
    loadFonts([
      {
        assetId: asset.id,
        version: asset.version,
        family: resource.family,
        weight: resource.weight ?? 400,
        style: resource.style === "italic" ? "italic" : "normal",
        url: asset.url,
      },
    ])
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    resource.asset?.id,
    resource.asset?.version,
    resource.family,
    resource.weight,
    resource.style,
  ]);
  return (
    <div className="font-card-preview">
      <strong
        style={
          ready && resource.asset
            ? {
                fontFamily: fontFamily(resource.asset.id),
                fontWeight: resource.weight,
                fontStyle: resource.style,
                fontSynthesis: "none",
              }
            : undefined
        }
      >
        {ready ? "Poster 2026" : "字体预览载入中…"}
      </strong>
      <span>
        {resource.family} · {resource.weight} ·{" "}
        {resource.style === "italic" ? "斜体" : "正常"}
      </span>
    </div>
  );
}
