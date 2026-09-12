import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.ts"),
        options: resolve(__dirname, "src/options.ts"),
        background: resolve(__dirname, "src/background.ts"),
        "network-main": resolve(__dirname, "src/injected/network-main.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
        "purchase-history": resolve(__dirname, "src/purchase-history.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
