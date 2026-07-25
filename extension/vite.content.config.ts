import { defineConfig } from "vite";

// Second build pass: MV3 content scripts cannot be ES modules, so the
// Google banner script is bundled separately as a self-contained IIFE.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/content/google.ts",
      formats: ["iife"],
      name: "SearchbackContent",
      fileName: () => "content.js",
    },
  },
});
