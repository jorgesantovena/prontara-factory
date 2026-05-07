import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuración de Vitest para Prontara.
 *
 * - environment: "node" porque los tests son de libs server-side (auth,
 *   billing, runtime-env, contract content). NO testeamos componentes
 *   React aquí (sería otro setup con jsdom y React Testing Library).
 * - paths: respeta el alias @/ del tsconfig.
 *
 * Ejecutar: pnpm test  (one-shot)  ó  pnpm test:watch  (modo watch).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    reporters: ["default"],
  },
});
