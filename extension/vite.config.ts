import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// One build produces the extension pages and service worker:
// - popup.html / dashboard.html at the dist root
// - background.js at the dist root (MV3 module service worker)
// - shared chunks under assets/, imported relatively (allowed for module SWs)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: "popup.html",
        dashboard: "dashboard.html",
        background: "src/background/index.ts",
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
