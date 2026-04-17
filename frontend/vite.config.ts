import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true,
        // Suppress EPIPE errors when backend restarts during dev
        configure: (proxy) => {
          proxy.on("error", () => {});
          proxy.on("proxyReqWs", (_proxyReq, _req, socket) => {
            socket.on("error", () => {});
          });
        },
      },
    },
  },
});
