import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: "/admin/",
  publicDir: "../../packages/ui/public",
  plugins: [react()],
  server: {
    proxy: {
      "/api": loadEnv(mode, ".", "API_").API_PROXY ?? "http://127.0.0.1:8080",
    },
  },
}));
