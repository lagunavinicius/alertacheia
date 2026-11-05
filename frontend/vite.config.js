import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const raiz = path.dirname(fileURLToPath(import.meta.url));

// Em desenvolvimento (npm run dev), /api é repassado para a API em :8080.
// Em produção, o build (dist/) é servido pela própria API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(raiz, "src") } },
  build: {
    chunkSizeWarningLimit: 1200, // o MapLibre (WebGL) sozinho tem ~800 kB e só carrega nas telas de mapa
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
});
