const brandIconUrl = new URL("./brand/fastposter-icon.png", import.meta.url)
  .href;

/** Decorative mark; the adjacent brand name supplies the accessible label. */
export function BrandIcon() {
  return (
    <img
      className="brand-mark"
      src={brandIconUrl}
      alt=""
      aria-hidden="true"
      width={36}
      height={36}
    />
  );
}
