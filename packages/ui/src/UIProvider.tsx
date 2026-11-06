import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { noticeLayer } from "./notice-layer";
import { fastPosterTheme } from "./theme";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Follow the OS motion preference and keep it live: the setting can be flipped
 * while an editor is open, so the shared theme has to re-render with the new
 * value instead of reading it once at startup.
 */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const theme = useMemo(
    () => ({
      ...fastPosterTheme,
      /* antd's public `motion` seed reaches every rc-motion layer through
         MotionWrapper. Turning it off is the supported way to skip the
         appear/leave animations while keeping their lifecycle callbacks. A
         blanket `animation: none !important` used to freeze popups at their
         0x0 enter frame and never fire the end callbacks, so they stayed
         invisible, unclickable and kept the page scroll lock. */
      token: { ...fastPosterTheme.token, motion: !reducedMotion },
    }),
    [reducedMotion],
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
