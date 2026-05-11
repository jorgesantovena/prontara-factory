import { test, expect } from "@playwright/test";

/**
 * Tests E2E del refactor de URLs H13 (H14-D).
 *
 * Verifica:
 *   - `/` redirige a `/factory` (la home es la Factory CEO).
 *   - `/softwarefactory`, `/dental`, `/veterinaria`, etc. son rutas
 *     reconocidas (responden, aunque sea 302 al login si no hay sesión).
 *   - `/clientes` (sin sesión) hace redirect a `/acceso?redirectTo=/clientes`.
 *   - `/software-factory` (con guión) sigue siendo la landing comercial pública.
 *   - `/api/health` responde.
 *
 * No requiere tenant autenticado — solo valida routing + middleware.
 */

const VERTICAL_SLUGS = [
  "softwarefactory",
  "dental",
  "veterinaria",
  "colegio",
  "peluqueria",
  "taller",
  "hosteleria",
  "abogados",
  "inmobiliaria",
  "asesoria",
  "gimnasio",
];

const TENANT_MODULES = [
  "clientes",
  "crm",
  "proyectos",
  "facturacion",
  "presupuestos",
  "productos",
  "tareas",
];

test.describe("H13 routing — base", () => {
  test("/ redirige a /factory", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(500);
    // Tras el redirect, la URL final es /factory
    expect(page.url()).toMatch(/\/factory\/?$/);
  });

  test("/factory carga (puede pedir login)", async ({ page }) => {
    const response = await page.goto("/factory");
    expect(response?.status()).toBeLessThan(500);
  });

  test("/software-factory (landing pública) carga sin redirect", async ({ page }) => {
    const response = await page.goto("/software-factory", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(500);
    expect(page.url()).toContain("/software-factory");
    expect(page.url()).not.toContain("/softwarefactory");
  });
});

test.describe("H13 routing — verticales", () => {
  for (const slug of VERTICAL_SLUGS) {
    test(`/${slug} responde sin error 500`, async ({ page }) => {
      const response = await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
      // Posibles outcomes:
      //   - 200 si el [vertical]/layout no bloquea (raro sin sesión)
      //   - 302/307 redirect a /acceso (esperado sin cookie)
      //   - 404 si el slug no se reconoce (NO debe pasar)
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
    });
  }
});

test.describe("H13 routing — redirect rutas viejas", () => {
  for (const modulo of TENANT_MODULES) {
    test(`/${modulo} (sin sesión) redirige a /acceso`, async ({ page }) => {
      const response = await page.goto(`/${modulo}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
      // Tras el redirect, la URL final debe contener /acceso
      expect(page.url()).toContain("/acceso");
      // Y debe llevar redirectTo con el path original
      expect(page.url()).toContain("redirectTo");
    });
  }
});

test.describe("API endpoints — sigue sano", () => {
  test("/api/health responde", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json).toHaveProperty("overall");
  });

  test("/api/erp/module sin sesión devuelve 401/403", async ({ request }) => {
    const r = await request.get("/api/erp/module?moduleKey=clientes");
    expect([401, 403]).toContain(r.status());
  });
});
