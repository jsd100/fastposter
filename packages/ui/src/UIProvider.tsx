import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";
import { noticeLayer } from "./notice-layer";
import { fastPosterTheme } from "./theme";

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={fastPosterTheme}>
      <App
        component={false}
        message={{ getContainer: noticeLayer, maxCount: 3, top: 12 }}
      >
        {children}
      </App>
    </ConfigProvider>
  );
}
