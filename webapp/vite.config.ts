import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Относительные пути — чтобы билд работал из любого подкаталога хостинга.
  base: "./",
  resolve: { alias: { "@": "/src" } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
