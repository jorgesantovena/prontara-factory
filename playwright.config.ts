import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config (H3-ARQ-04).
 *
 * Tests E2E sobre flujos críticos. Por defecto contra `pnpm start` en
 * 3000 con persistencia filesystem (sin Postgres requerido).
 *
 * En CI, el workflow .github/workflows/ci.yml monta el server con
 * `pnpm start` y los tests le pegan en localhost.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
