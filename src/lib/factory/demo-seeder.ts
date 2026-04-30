/**
 * Materialización de demo data del vertical en los ficheros de datos del tenant.
 *
 * Cada SectorPackDefinition trae un `demoData: Array<{moduleKey, records}>`.
 * Este módulo copia esos registros a `data/saas/<clientId>/<module>.json` para
 * que el ERP del cliente arranque con datos coherentes en vez de listas vacías.
 *
 * Dos modos:
 *   - "merge": añade los registros que no existan (por id sintético estable
 *     generado desde el contenido) a lo que ya haya en disco.
 *   - "replace": borra todo y deja solo los demo rows.
 *
 * La seed asigna id + createdAt + updatedAt a los registros que no los tengan,
 * así el ERP y las UIs los tratan como filas normales. No re-seedea los mismos
 * datos en modo merge gracias al id estable.
 */
import { createHash } from "node:crypto";
import { resolveTenantByClientId } from "@/lib/saas/tenant-registry";
import { getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import {
  listModuleRecords,
  saveModuleRecords,
} from "@/lib/erp/active-client-data-store";
import type { SectorPackDefinition } from "@/lib/factory/sector-pack-definition";

export type DemoSeedMode = "merge" | "replace";

export type DemoSeedInput = {
  clientId: string;
  mode?: DemoSeedMode;
  /** Si se indica, solo se siembran esos moduleKeys. */
  modules?: string[];
};

export type DemoSeedModuleResult = {
  moduleKey: string;
  insertedRows: number;
  skippedRows: number;
  totalRowsAfter: number;
};

export type DemoSeedResult = {
  clientId: string;
  tenantDisplayName: string;
  packKey: string;
  mode: DemoSeedMode;
  modulesProcessed: DemoSeedModuleResult[];
  totalInserted: number;
  totalSkipped: number;
  notes: string[];
};

/** Genera un id estable a partir del contenido del registro — evita duplicar. */
function stableIdFromRow(moduleKey: string, row: Record<string, unknown>): string {
  const keys = Object.keys(row).filter((k) => k !== "id" && k !== "createdAt" && k !== "updatedAt").sort();
  const payload = keys.map((k) => k + "=" + String(row[k] ?? "")).join("||");
  const digest = createHash("sha1").update(moduleKey + "::" + payload).digest("hex").slice(0, 16);
  return "demo-" + digest;
}

function normalizeRow(
  moduleKey: string,
  row: Record<string, unknown>,
  now: string,
): Record<string, string> {
  const id = String(row.id || stableIdFromRow(moduleKey, row));
  const normalized: Record<string, string> = {
    id,
    createdAt: String(row.createdAt || now),
    updatedAt: now,
  };
  for (const [k, v] of Object.entries(row)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    normalized[k] = v == null ? "" : String(v);
  }
  return normalized;
}

function resolvePackForTenant(clientId: string): {
  pack: SectorPackDefinition;
  displayName: string;
} {
  const tenant = resolveTenantByClientId(clientId);
  if (!tenant) {
    throw new Error("No existe el tenant con clientId '" + clientId + "'.");
  }
  const businessType = String(tenant.businessType || "").trim();
  if (!businessType) {
    throw new Error("El tenant '" + clientId + "' no tiene businessType definido.");
  }
  const pack = getSectorPackByKey(businessType);
  if (!pack) {
    throw new Error(
      "No existe el sector pack para businessType '" + businessType + "' del tenant '" + clientId + "'.",
    );
  }
  return { pack, displayName: tenant.displayName };
}

export function seedDemoDataForTenant(input: DemoSeedInput): DemoSeedResult {
  const mode: DemoSeedMode = input.mode === "replace" ? "replace" : "merge";
  const clientId = String(input.clientId || "").trim();
  if (!clientId) throw new Error("Falta clientId.");

  const { pack, displayName } = resolvePackForTenant(clientId);

  const allowedModules = input.modules && input.modules.length > 0 ? new Set(input.modules) : null;
  const now = new Date().toISOString();
  const modulesProcessed: DemoSeedModuleResult[] = [];
  const notes: string[] = [];

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const demoModule of pack.demoData || []) {
    if (allowedModules && !allowedModules.has(demoModule.moduleKey)) continue;

    const normalized = (demoModule.records || []).map((r) => normalizeRow(demoModule.moduleKey, r, now));

    if (mode === "replace") {
      saveModuleRecords(demoModule.moduleKey, normalized, clientId);
      modulesProcessed.push({
        moduleKey: demoModule.moduleKey,
        insertedRows: normalized.length,
        skippedRows: 0,
        totalRowsAfter: normalized.length,
      });
      totalInserted += normalized.length;
      continue;
    }

    // merge
    const current = listModuleRecords(demoModule.moduleKey, clientId);
    const existingIds = new Set(current.map((r) => String(r.id || "")));
    const toAppend: Array<Record<string, string>> = [];
    let skipped = 0;
    for (const row of normalized) {
      if (existingIds.has(row.id)) {
        skipped += 1;
        continue;
      }
      toAppend.push(row);
      existingIds.add(row.id);
    }
    const merged = [...current, ...toAppend];
    if (toAppend.length > 0) {
      saveModuleRecords(demoModule.moduleKey, merged, clientId);
    }
    modulesProcessed.push({
      moduleKey: demoModule.moduleKey,
      insertedRows: toAppend.length,
      skippedRows: skipped,
      totalRowsAfter: merged.length,
    });
    totalInserted += toAppend.length;
    totalSkipped += skipped;
  }

  if (modulesProcessed.length === 0) {
    if (allowedModules) {
      notes.push("Ninguno de los módulos pedidos tenía demoData definida en el vertical.");
    } else {
      notes.push("Este vertical no tiene demoData configurada todavía.");
    }
  }

  return {
    clientId,
    tenantDisplayName: displayName,
    packKey: pack.key,
    mode,
    modulesProcessed,
    totalInserted,
    totalSkipped,
    notes,
  };
}
