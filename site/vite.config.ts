import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "shared"),
      "@marketMovement": path.resolve(__dirname, "../lib/marketMovement.mjs"),
    },
  },
  publicDir: "public",
});
