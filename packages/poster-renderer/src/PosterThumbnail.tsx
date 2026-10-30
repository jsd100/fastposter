import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PosterDocument } from "@fastposter/poster-schema";
import { PosterFrame } from "./PosterFrame";

export function PosterThumbnail({
  document: d,
  backgroundUrl,
  className,
  style,
  alt,
}: {
  document: PosterDocument;
  backgroundUrl?: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  const scale = width > 0 ? width / d.canvas.width : 0;
  return (
    <div
      ref={host}
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${d.canvas.width} / ${d.canvas.height}`,
        overflow: "hidden",
        background: "#eef3e6",
        ...style,
      }}
    >
      {scale > 0 && (
        <div
          aria-hidden={alt ? true : undefined}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: d.canvas.width,
            height: d.canvas.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <PosterFrame document={d} backgroundUrl={backgroundUrl} />
        </div>
      )}
    </div>
  );
}
