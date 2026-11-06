import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo, type ReactNode } from "react";
import { noticeLayer } from "./notice-layer";
import { fastPosterTheme } from "./theme";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Read the OS motion preference once, when the app loads. Changing the system
 * setting mid-session takes effect only after a page reload: we deliberately
 * do NOT subscribe to `matchMedia` changes. Re-rendering ConfigProvider with a
 * flipped `motion` seed makes antd's MotionWrapper re-wrap its subtree, which
 * remounts the editor and drops unsaved drafts. See the A01 fix report (Ruling
 * 9) for the trade-off against the plan's "subscribe to changes" wording.
 */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

export function UIProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(
    () => ({
      ...fastPosterTheme,
      /* antd's public `motion` seed reaches every rc-motion layer through
         MotionWrapper. Turning it off is the supported way to skip the
         appear/leave animations while keeping their lifecycle callbacks. A
         blanket `animation: none !important` used to freeze popups at their
         0x0 enter frame and never fire the end callbacks, so they stayed
         invisible, unclickable and kept the page scroll lock. */
      token: { ...fastPosterTheme.token, motion: !prefersReducedMotion() },
    }),
    [],
  );
  return (
    <ConfigProvider
      locale={zhCN}
      theme={theme}
      /* antd pads a space between two-character Chinese labels, which would
         change every accessible name the browser tests address ("取 消"). */
      button={{ autoInsertSpace: false }}
    >
      <App
        component={false}
        message={{ getContainer: noticeLayer, maxCount: 3, top: 12 }}
      >
        {children}
      </App>
    </ConfigProvider>
  );
}
