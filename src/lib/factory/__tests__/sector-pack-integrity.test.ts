import { describe, expect, it } from "vitest";
import { SECTOR_PACKS } from "@/lib/factory/sector-pack-registry";

/**
 * Test de integridad de packs sectoriales (AUDIT-05).
 *
 * Verifica las invariantes que `docs/vertical-pattern.md §13` exige:
 *
 *   1. Cada pack tiene accentColor único.
 *   2. Cada pack tiene los 6 módulos del núcleo (clientes, crm, proyectos,
 *      presupuestos, facturacion, documentos) con enabled: true.
 *   3. Cada módulo enabled (excluyendo asistente, ajustes y los hub-children
 *      del SF) tiene al menos 1 field y 1 tableColumn.
 *   4. Cada pack tiene demoData para clientes, proyectos y facturacion como
 *      mínimo (los 3 módulos que el dashboard espera siempre).
 *   5. Cada moduleKey citado en fields y tableColumns está enabled en el
 *      pack (no hay fields huérfanos para módulos que no existen).
 *
 * Si añades un pack nuevo y este test falla, ve al doc y completa lo que
 * indique el error. Antipatron #1 / #2 del § 12.
 */

const CORE_MODULES = [
  "clientes",
  "crm",
  "proyectos",
  "presupuestos",
  "facturacion",
  "documentos",
];

const REQUIRED_DEMO_MODULES = ["clientes", "proyectos", "facturacion"];

// Módulos del Hub Producción del Software Factory: tienen enabled:true para
// existir como TenantModuleRecord pero NO tienen página propia ni se
// renderizan como tabla genérica. Se acceden como tabs de /produccion.
const HUB_CHILDREN_OF_SF = new Set([
  "tareas",
  "incidencias",
  "actividades",
  "versiones",
  "mantenimientos",
  "justificantes",
  "descripciones-proyecto",
]);

// Módulos sistema sin tabla genérica (tienen UI custom).
const SYSTEM_MODULES = new Set(["asistente", "ajustes"]);

// SF tiene una página /clientes custom (no usa GenericModuleRuntimePage)
// así que su pack puede no declarar fields/cols para clientes sin que
// falle nada visualmente.
const PACKS_WITH_CUSTOM_CLIENTES = new Set(["software-factory"]);

describe("sector-pack-integrity", () => {
  it("hay al menos un pack registrado", () => {
    expect(SECTOR_PACKS.length).toBeGreaterThan(0);
  });

  it("cada pack tiene accentColor único", () => {
    const colors = SECTOR_PACKS.map((p) => p.branding.accentColor.toLowerCase());
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });

  it("cada pack tiene los 6 módulos del núcleo con enabled: true", () => {
    for (const pack of SECTOR_PACKS) {
      const enabledKeys = new Set(
        pack.modules.filter((m) => m.enabled).map((m) => m.moduleKey),
      );
      for (const core of CORE_MODULES) {
        expect(
          enabledKeys.has(core),
          "[pack=" + pack.key + "] Falta módulo del núcleo: " + core,
        ).toBe(true);
      }
    }
  });

  it("cada módulo enabled con UI genérica tiene al menos 1 field y 1 tableColumn", () => {
    for (const pack of SECTOR_PACKS) {
      const enabledModules = pack.modules
        .filter((m) => m.enabled)
        .map((m) => m.moduleKey);

      for (const mod of enabledModules) {
        if (SYSTEM_MODULES.has(mod)) continue;
        if (pack.key === "software-factory" && HUB_CHILDREN_OF_SF.has(mod)) continue;
        if (mod === "clientes" && PACKS_WITH_CUSTOM_CLIENTES.has(pack.key)) continue;

        const fieldsCount = pack.fields.filter((f) => f.moduleKey === mod).length;
        const colsCount = pack.tableColumns.filter((c) => c.moduleKey === mod).length;

        expect(
          fieldsCount,
          "[pack=" + pack.key + "][module=" + mod + "] Sin fields. Antipatrón #1 del vertical-pattern.md.",
        ).toBeGreaterThan(0);
        expect(
          colsCount,
          "[pack=" + pack.key + "][module=" + mod + "] Sin tableColumns. Antipatrón #2 del vertical-pattern.md.",
        ).toBeGreaterThan(0);
      }
    }
  });

  it("cada pack tiene demoData para clientes, proyectos y facturacion", () => {
    for (const pack of SECTOR_PACKS) {
      const demoKeys = new Set(pack.demoData.map((d) => d.moduleKey));
      for (const required of REQUIRED_DEMO_MODULES) {
        expect(
          demoKeys.has(required),
          "[pack=" + pack.key + "] Falta demoData para " + required,
        ).toBe(true);
      }
    }
  });

  it("ningún field/tableColumn referencia un módulo no enabled", () => {
    for (const pack of SECTOR_PACKS) {
      const enabledKeys = new Set(
        pack.modules.filter((m) => m.enabled).map((m) => m.moduleKey),
      );

      for (const f of pack.fields) {
        expect(
          enabledKeys.has(f.moduleKey),
          "[pack=" + pack.key + "] field con moduleKey '" + f.moduleKey + "' que no está enabled en modules.",
        ).toBe(true);
      }
      for (const c of pack.tableColumns) {
        expect(
          enabledKeys.has(c.moduleKey),
          "[pack=" + pack.key + "] tableColumn con moduleKey '" + c.moduleKey + "' que no está enabled en modules.",
        ).toBe(true);
      }
    }
  });

  it("ningún campo de los packs tiene fieldKey vacío o duplicado", () => {
    for (const pack of SECTOR_PACKS) {
      const seen = new Map<string, number>();
      for (const f of pack.fields) {
        expect(
          f.fieldKey,
          "[pack=" + pack.key + "] field sin fieldKey en moduleKey=" + f.moduleKey,
        ).toBeTruthy();
        const composite = f.moduleKey + "::" + f.fieldKey;
        seen.set(composite, (seen.get(composite) || 0) + 1);
      }
      for (const [key, count] of seen) {
        expect(
          count,
          "[pack=" + pack.key + "] field duplicado: " + key,
        ).toBe(1);
      }
    }
  });

  it("cada pack tiene branding mínimo (displayName, accentColor)", () => {
    for (const pack of SECTOR_PACKS) {
      expect(
        pack.branding.displayName,
        "[pack=" + pack.key + "] sin displayName",
      ).toBeTruthy();
      expect(
        pack.branding.accentColor,
        "[pack=" + pack.key + "] sin accentColor",
      ).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
