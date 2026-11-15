import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const firms = process.env.FIRMS_PROXY || "http://127.0.0.1:8002";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: firms, changeOrigin: true } }
  }
});
