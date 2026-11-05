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
};
