import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy web3/chart libs in their own long-lived chunks.
        manualChunks: {
          ethers: ["ethers"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
