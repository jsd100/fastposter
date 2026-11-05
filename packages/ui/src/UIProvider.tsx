import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { ReactNode } from "react";
import { fastPosterTheme } from "./theme";

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={fastPosterTheme}>
      <App component={false}>{children}</App>
    </ConfigProvider>
  );
}
