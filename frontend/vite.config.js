import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento (npm run dev), /api é repassado para a API em :8080.
// Em produção, o build (dist/) é servido pela própria API.
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 }, // o Recharts sozinho tem ~450 kB; aceitável para o painel
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
});
