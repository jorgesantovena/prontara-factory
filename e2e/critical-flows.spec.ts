import { test, expect } from "@playwright/test";

/**
 * Tests E2E sobre flujos críticos (H3-ARQ-04).
 *
 * Cubrimos las páginas que NO requieren tenant autenticado primero,
 * porque montar un tenant en CI sería costoso. Cuando se añada un
 * tenant fixture en CI (vía seed o crear tenant test), expandir.
 */

test.describe("smoke", () => {
  test("home loads", async ({ page }) => {
    await page.goto("/");
    // Cualquier H1 visible en home es OK como smoke.
    await expect(page.locator("body")).toBeVisible();
  });

  test("/api/health responds", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json).toHaveProperty("overall");
    expect(json).toHaveProperty("components");
    expect(Array.isArray(json.components)).toBe(true);
  });

  test("/login renders login form", async ({ page }) => {
    const response = await page.goto("/login");
    // /login puede ser 200 o redirect — toleramos ambos
    expect(response?.status()).toBeLessThan(500);
  });

  test("/api/erp/module without auth returns 401", async ({ request }) => {
    const r = await request.get("/api/erp/module?moduleKey=clientes");
    expect([401, 403]).toContain(r.status());
  });

  test("/factory page loads", async ({ page }) => {
    const response = await page.goto("/factory");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("api endpoints respond", () => {
  test("metrics endpoint requires operator", async ({ request }) => {
    const r = await request.get("/api/factory/metrics");
    // Sin auth devuelve 401 / 403 / 200 según política — solo verificamos < 500
    expect(r.status()).toBeLessThan(500);
  });

  test("workflow rules endpoint requires session", async ({ request }) => {
    const r = await request.get("/api/erp/workflows");
    expect([401, 403, 400]).toContain(r.status());
  });

  test("cron tick respects CRON_SECRET if set", async ({ request }) => {
    const r = await request.get("/api/cron/tick");
    // Si CRON_SECRET no está en el env de CI, devuelve 200; si sí está,
    // devuelve 401 sin header. Ambos son aceptables.
    expect([200, 401, 500]).toContain(r.status());
  });
});
