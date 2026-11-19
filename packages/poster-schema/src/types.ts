export type FontRef = {
  assetId: string;
  version: string;
  family: string;
  weight: number;
  style: "normal" | "italic";
};
export type GradientStop = {
  color: string;
  offset: number;
};
export type LinearGradient = {
  type: "linear";
  /** Block-local id; repeated uses of one id must share the same config. */
  rangeId: string;
  /** Degrees in [0,360) after normalization. */
  angle: number;
  stops: GradientStop[];
};
export type RadialGradient = {
  type: "radial";
  rangeId: string;
  /** Percentages in [0,100]. */
  centerX: number;
  centerY: number;
  stops: GradientStop[];
};
export type TextColor = string | LinearGradient | RadialGradient;
export type InlineStyle = {
  fontId: string;
  fontSize: number;
  color: TextColor;
  fontWeight: number;
};
export type RichMark = {
  type: "textStyle" | "bold" | "italic" | "underline" | "strike";
  attrs?: Partial<InlineStyle>;
};
export type RichNode = {
  type: "doc" | "paragraph" | "text" | "hardBreak";
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};
export type TextBlock = {
  id: string;
  x: number;
  y: number;
  width: number;
  zIndex: number;
  defaultStyle: InlineStyle;
  paragraphStyle: {
    align: "left" | "center" | "right";
    lineHeight: number;
    letterSpacing: number;
  };
  effects: {
    opacity: number;
    padding: number;
    backgroundColor: string;
    strokeWidth: number;
    strokeColor: string;
    shadowColor: string;
    shadowBlur: number;
    shadowX: number;
    shadowY: number;
  };
  content: RichNode;
};
export type PosterDocument = {
  schemaVersion: 1 | 2;
  canvas: { width: number; height: number };
  background: { assetId: string; version: string };
  fonts: FontRef[];
  textBlocks: TextBlock[];
};
