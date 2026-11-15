import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const firms = process.env.FIRMS_PROXY || "http://127.0.0.1:8002";
const context = process.env.CONTEXT_PROXY || "http://127.0.0.1:8003";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: firms, changeOrigin: true },
      "/context": { target: context, changeOrigin: true, rewrite: path => path.replace(/^\/context/, "") }
    }
  }
});
