/**
 * Cliente agregador bancario PSD2 (H6-PSD2).
 *
 * Diseñado como adaptador genérico — el agregador concreto
 * (Fintecture, Tink, Salt Edge, GoCardless) se elige vía env var
 * PSD2_PROVIDER. Si no está configurado, las funciones retornan
 * { ok: false, reason: "not_configured" }.
 *
 * Soporte inicial: Fintecture (más simple para pyme española).
 *
 * Env vars:
 *   PSD2_PROVIDER         = "fintecture" | "tink" | "salt-edge"
 *   PSD2_CLIENT_ID
 *   PSD2_CLIENT_SECRET
 *   PSD2_ENV              = "sandbox" | "production"
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { captureError } from "@/lib/observability/error-capture";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("psd2");

export type Movement = {
  externalId: string;
  account?: string;
  date: Date;
  amountEur: number;
  description: string;
  direction: "credit" | "debit";
  rawJson?: Record<string, unknown>;
};

export type PSD2Provider = "fintecture" | "tink" | "salt-edge";

function getProvider(): PSD2Provider | null {
  const p = String(process.env.PSD2_PROVIDER || "").trim().toLowerCase() as PSD2Provider;
  if (p === "fintecture" || p === "tink" || p === "salt-edge") return p;
  return null;
}

/**
 * Devuelve la URL de iniciación de consentimiento PSD2 — el tenant
 * abre esta URL, autoriza el acceso a su banco, y vuelve al callback.
 */
export async function getConsentUrl(clientId: string, returnUrl: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const provider = getProvider();
  if (!provider) return { ok: false, reason: "not_configured" };

  if (provider === "fintecture") {
    const baseUrl = process.env.PSD2_ENV === "production"
      ? "https://api.fintecture.com"
      : "https://api-sandbox.fintecture.com";
    const appId = String(process.env.PSD2_CLIENT_ID || "").trim();
    if (!appId) return { ok: false, reason: "missing_credentials" };
    // En real haríamos POST /pis/v2/connect con body — aquí construimos
    // el URL de demo para que la UI funcione sin las credenciales reales.
    const consentUrl = baseUrl + "/auth/connect?app_id=" + appId + "&state=" + encodeURIComponent(clientId) + "&return_url=" + encodeURIComponent(returnUrl);
    return { ok: true, url: consentUrl };
  }

  return { ok: false, reason: "provider_not_implemented" };
}

/**
 * Importa movimientos del banco del tenant. Implementación stub —
 * cuando estén las credenciales reales, sustituir el bloque mock por
 * la llamada al endpoint del proveedor.
 */
export async function fetchMovements(clientId: string, sinceISO?: string): Promise<{ ok: true; movements: Movement[] } | { ok: false; reason: string }> {
  const provider = getProvider();
  if (!provider) return { ok: false, reason: "not_configured" };
  log.info("psd2 fetch", { clientId, provider, since: sinceISO });

  // STUB: cuando esté contratado el agregador, sustituir esto por la
  // llamada real. Por ahora devolvemos vacío para que el resto del flow
  // se pueda probar end-to-end.
  return { ok: true, movements: [] };
}

/**
 * Persiste los movimientos en la BD (idempotente vía externalId unique).
 */
export async function persistMovements(clientId: string, tenantId: string, movements: Movement[]): Promise<{ inserted: number; skipped: number }> {
  if (getPersistenceBackend() !== "postgres") return { inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  for (const m of movements) {
    try {
      await withPrisma(async (prisma) => {
        const c = prisma as unknown as {
          bankMovement: {
            upsert: (a: { where: { clientId_externalId: { clientId: string; externalId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
          };
        };
        await c.bankMovement.upsert({
          where: { clientId_externalId: { clientId, externalId: m.externalId } },
          create: {
            tenantId,
            clientId,
            externalId: m.externalId,
            account: m.account,
            date: m.date,
            amountEur: m.amountEur,
            description: m.description,
            direction: m.direction,
            rawJson: m.rawJson || null,
          },
          update: {}, // idempotente — no sobrescribimos si ya existe
        });
      });
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }
  return { inserted, skipped };
}

/**
 * Casa movimientos sin matchear con facturas pendientes del tenant
 * por importe + fecha (±7 días tolerancia).
 */
export async function autoMatchMovements(clientId: string): Promise<{ matched: number }> {
  if (getPersistenceBackend() !== "postgres") return { matched: 0 };

  const facturas = await listModuleRecordsAsync("facturacion", clientId);
  const pendientes = facturas.filter((f) => {
    const estado = String(f.estado || "");
    return estado !== "cobrada" && estado !== "anulada";
  }).map((f) => ({
    id: String(f.id),
    importe: parseFloat(String(f.importe || "0").replace(/[^\d,.-]/g, "").replace(",", ".")),
    fecha: new Date(String(f.fechaEmision || f.fecha || new Date().toISOString())),
  }));

  let matched = 0;
  await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      bankMovement: {
        findMany: (a: { where: Record<string, unknown> }) => Promise<Array<{ id: string; amountEur: number; date: Date }>>;
        update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
      };
    };
    const movs = await c.bankMovement.findMany({
      where: { clientId, matchedFacturaId: null, direction: "credit" },
    });
    for (const m of movs) {
      const candidata = pendientes.find((f) =>
        Math.abs(f.importe - m.amountEur) < 0.05 &&
        Math.abs(m.date.getTime() - f.fecha.getTime()) < 7 * 24 * 60 * 60 * 1000,
      );
      if (candidata) {
        await c.bankMovement.update({
          where: { id: m.id },
          data: { matchedFacturaId: candidata.id, matchedAt: new Date() },
        });
        matched += 1;
      }
    }
  }).catch((err) => captureError(err, { scope: "psd2.autoMatch", tags: { clientId } }));

  return { matched };
}

export function isPsd2Configured(): boolean {
  return getProvider() !== null && !!process.env.PSD2_CLIENT_ID;
}
