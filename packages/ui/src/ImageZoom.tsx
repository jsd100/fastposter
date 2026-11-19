import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Image } from "antd";
import { restoreLayerFocus } from "./modal-layer";
import { Status } from "./Status";

/**
 * The fallback magnifier keeps the affordance visible when a caller does not
 * pass its own icon set; lucide's `ZoomIn` is the shape both sites use.
 */
function DefaultZoomIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export type ImageZoomProps = {
  /** What the card shows. Absent for an asset without a generated preview. */
  thumbnailSrc?: string;
  /** The full-size source; requested only once the preview opens. */
  previewSrc?: string;
  /** Names the trigger 「放大预览 {title}」 and the preview dialog. */
  title: string;
  /** Replaces the default 暂无缩略图 copy for a missing or failed thumbnail. */
  fallback?: ReactNode;
  /**
   * Page-owned sizing class. The component only fills its parent, so a picker
   * can keep a 4:5 box while an admin card keeps a fixed-height one.
   */
  className?: string;
  /** Drawn over the thumbnail on hover, focus and touch. */
  zoomIcon?: ReactNode;
  /**
   * Last-resort focus target when the card itself disappeared while the
   * preview was open (the catalog refetched, the filter changed).
   */
  restoreFocusTo?: () => HTMLElement | null;
};

/**
 * A thumbnail that opens the original in antd's image preview.
 *
 * Three details are deliberate rather than incidental:
 *
 * - the preview `src` is separate from the thumbnail, so the list never pays
 *   for the originals;
 * - closing mid-appear would leave the portal waiting for a transition that
 *   never fires, so preview motion is disabled and close + focus hand-back are
 *   one atomic step;
 * - rc-image neither moves focus into the dialog nor returns it, so Escape is
 *   owned here while open and focus goes back to the trigger on close.
 */
export function ImageZoom({
  thumbnailSrc,
  previewSrc,
  title,
  fallback = "暂无缩略图",
  className = "",
  zoomIcon,
  restoreFocusTo,
}: ImageZoomProps) {
  const [open, setOpen] = useState(false);
  // Failures are keyed by source, so a refetched asset retries on its own.
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const restoreOnRemoval = useRef(false);
  const fallbackFocus = useRef(restoreFocusTo);
  fallbackFocus.current = restoreFocusTo;

  const thumbnailMissing = !thumbnailSrc || failedThumbnail === thumbnailSrc;
  const previewFailed = !previewSrc || failedPreview === previewSrc;
  const trigger = () =>
    wrapper.current?.querySelector<HTMLElement>(".fp-image-zoom-trigger") ??
    null;

  useLayoutEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      // The preview portal registers after any parent dialog. Own Escape as
      // soon as this controlled preview opens, including its enter motion.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [open]);

  useEffect(
    () => () => {
      // The card can disappear while viewing it if the catalog changes.
      if (restoreOnRemoval.current)
        restoreLayerFocus(null, () => fallbackFocus.current?.() ?? null);
    },
    [],
  );

  return (
    <div className={`fp-image-zoom ${className}`.trim()} ref={wrapper}>
      {thumbnailMissing && (
        <span className="fp-image-zoom-fallback">{fallback}</span>
      )}
      <Image
        src={thumbnailSrc}
        alt={title}
        aria-label={`放大预览 ${title}`}
        aria-haspopup="dialog"
        classNames={{
          root: "fp-image-zoom-trigger",
          image: thumbnailMissing ? "fp-image-zoom-missing" : undefined,
          cover: "fp-image-zoom-mask",
        }}
        styles={{
          image: {
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          },
        }}
        onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
        onError={() => thumbnailSrc && setFailedThumbnail(thumbnailSrc)}
        preview={{
          open,
          // Closing mid-appear can leave the portal waiting for a transition
          // end that never fires. Keep closing and focus restoration atomic.
          motionName: "",
          src: previewSrc,
          cover: zoomIcon ?? <DefaultZoomIcon />,
          onOpenChange: (next) => {
            if (next) {
              restoreOnRemoval.current = true;
              setFailedPreview(null);
            }
            setOpen(next);
          },
          afterOpenChange: (visible) => {
            if (visible || !restoreOnRemoval.current) return;
            restoreOnRemoval.current = false;
            restoreLayerFocus(
              trigger(),
              () => fallbackFocus.current?.() ?? null,
            );
          },
          imageRender: (image) =>
            previewFailed ? (
              <Status tone="error">原图加载失败，请关闭预览后重试。</Status>
            ) : (
              cloneElement(image as ReactElement<{ onError: () => void }>, {
                onError: () => previewSrc && setFailedPreview(previewSrc),
              })
            ),
          actionsRender: (actions) => (previewFailed ? null : actions),
        }}
      />
    </div>
  );
}
