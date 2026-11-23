import { defineConfig } from "vitest/config";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solid()],
  // NO_HMR=1: a stable server for automated screenshots while data files are being written
  server: process.env.NO_HMR ? { hmr: false, watch: null } : undefined,
  build: {
    rolldownOptions: {
      output: {
        // vendor libraries change rarely: separate chunks cache well and keep the app chunk small
        codeSplitting: {
          groups: [
            { name: "maplibre", test: /node_modules[\\/].*maplibre/ },
            { name: "d3", test: /node_modules[\\/].*d3-/ },
            { name: "solid", test: /node_modules[\\/].*(solid-js|@solidjs)/ }
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1100
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
