import type { ThemeConfig } from "antd";

/**
 * Shared theme for the user site and the admin site. Page-level redesigns may
 * extend component tokens, but the semantic seed values stay here.
 */
export const fastPosterTheme: ThemeConfig = {
  token: {
    colorPrimary: "#2E694F",
    colorError: "#A63232",
    colorBgLayout: "#F3F5F4",
    colorBgContainer: "#FFFFFF",
    colorText: "#202C25",
    colorTextSecondary: "#526159",
    colorBorder: "#DCE3DE",
    controlHeight: 36,
    fontSize: 14,
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  /**
   * Controls take their size and ink from these tokens, so the shared classes
   * in `styles.css` stay geometry the pages own. The scale is UI-02: regular
   * controls 36px/14px, compact property-area actions 32px/12px, secondary text
   * 12px.
   */
  components: {
    Button: {
      fontWeight: 500,
      contentFontSize: 14,
      contentFontSizeSM: 12,
      controlHeightSM: 32,
      paddingInline: 16,
      paddingInlineSM: 10,
      // antd gives every default, primary and danger button a 2px resting
      // shadow. FP-01 removes that projection on both sites through the
      // shared theme while keeping the border, disabled, busy, pressed and
      // focus-visible feedback (the focus ring comes from styles.css).
      defaultShadow: "none",
      primaryShadow: "none",
      dangerShadow: "none",
    },
    Alert: {
      defaultPadding: "12px 14px",
      containerBorderRadius: 6,
    },
    Tooltip: {
      maxWidth: 240,
    },
    /**
     * The copy tree nests five levels inside a 250px sidebar, so the default
     * 24px indent plus its switcher would leave nothing for the label. The
     * selected and hovered fills are the brand greens the hand-built rows had.
     */
    Tree: {
      indentSize: 14,
      titleHeight: 30,
      nodeSelectedBg: "#edf5e3",
      nodeSelectedColor: "#4d6140",
      nodeHoverBg: "#f2f7ec",
    },
  },
};
