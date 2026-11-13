import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  publicDir: "../../packages/ui/public",
  plugins: [react()],
  cacheDir: loadEnv(mode, ".", "FASTPOSTER_VITE_CACHE_DIR")
    .FASTPOSTER_VITE_CACHE_DIR,
  resolve: { dedupe: ["react", "react-dom"] },
  // Prebundle the lazy editor with the same React used by the app shell.
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-text-style",
      "@tiptap/pm/transform",
    ],
  },
  server: {
    proxy: {
      "/api": loadEnv(mode, ".", "API_").API_PROXY ?? "http://127.0.0.1:8080",
    },
  },
}));
