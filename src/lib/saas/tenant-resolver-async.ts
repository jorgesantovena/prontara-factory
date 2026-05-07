/**
 * Versiones async de tenant-resolver.ts que funcionan con Postgres.
 *
 * Por qué duplicar en lugar de refactorizar el sync:
 *   tenant-resolver.ts está consumido por 28+ módulos repartidos por el
 *   código, muchos de ellos sync (legacy). Convertirlo todo a async exige
 *   un cambio cascada enorme. Como el primer punto crítico que se rompe
 *   en serverless prod es el login (no resuelve el tenant porque
 *   `.prontara/clients/*.json` no existe en el bundle), creamos aquí la
 *   cadena async mínima que necesita el endpoint /api/runtime/login y
 *   migramos el resto poco a poco.
 *
 * Modo dual:
 *   - PRONTARA_PERSISTENCE=postgres → consulta Postgres directamente.
 *   - PRONTARA_PERSISTENCE=filesystem → delega en las funciones sync de
 *     tenant-resolver.ts (que leen `.prontara/clients/*.json`).
 */
import type { NextRequest } from "next/server";
import type {
  TenantBranding,
  TenantDefinition,
  TenantStatus,
} from "@/lib/saas/tenant-definition";
import {
  resolveTenantBySlug as fsResolveTenantBySlug,
  resolveTenantFromRequest as fsResolveTenantFromRequest,
  type TenantResolutionResult,
  type TenantResolutionSource,
} from "@/lib/saas/tenant-resolver";
import { resolveActiveTenant as fsResolveActiveTenant } from "@/lib/saas/tenant-registry";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import { requireTenantSession } from "@/lib/saas/auth-session";
import {
  getTenantArtifactsRoot,
  getTenantDataRoot,
} from "@/lib/factory/tenant-context";

type TenantRow = {
  clientId: string;
  slug: string;
  displayName: string;
  status: string;
  sector: string | null;
  businessType: string | null;
  brandingJson: unknown;
  definition: unknown;
  updatedAt: Date;
};

function normalizeSlug(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function rowToTenantDefinition(row: TenantRow): TenantDefinition {
  // Construimos un TenantDefinition estricto a partir de la fila Postgres.
  // La columna `definition` Json es el JSON legacy migrado; solo lo
  // usamos para rellenar branding cuando brandingJson esté vacío.
  const def =
    row.definition && typeof row.definition === "object"
      ? (row.definition as Record<string, unknown>)
      : {};

  const brandingSrc =
    row.brandingJson && typeof row.brandingJson === "object"
      ? (row.brandingJson as Record<string, unknown>)
      : def.branding && typeof def.branding === "object"
      ? (def.branding as Record<string, unknown>)
      : {};

  const sector =
    row.sector ||
    (typeof def.sector === "string" ? (def.sector as string) : undefined);
  const businessType =
    row.businessType ||
    (typeof def.businessType === "string"
      ? (def.businessType as string)
      : undefined);

  const branding: TenantBranding = {
    displayName:
      typeof brandingSrc.displayName === "string"
        ? (brandingSrc.displayName as string)
        : row.displayName,
    sector:
      typeof brandingSrc.sector === "string"
        ? (brandingSrc.sector as string)
        : sector,
    businessType:
      typeof brandingSrc.businessType === "string"
        ? (brandingSrc.businessType as string)
        : businessType,
    logoUrl:
      typeof brandingSrc.logoUrl === "string"
        ? (brandingSrc.logoUrl as string)
        : undefined,
    accentColor:
      typeof brandingSrc.accentColor === "string"
        ? (brandingSrc.accentColor as string)
        : typeof brandingSrc.primaryColor === "string"
        ? (brandingSrc.primaryColor as string)
        : undefined,
  };

  // El status del schema Postgres es un string libre; lo coercemos al
  // union TenantStatus aceptado por el dominio. Anything no-conocido cae
  // a "active" para no bloquear sesiones legítimas.
  const validStatus: TenantStatus =
    row.status === "inactive" || row.status === "draft" ? row.status : "active";

  return {
    tenantId: row.clientId,
    clientId: row.clientId,
    slug: row.slug,
    displayName: row.displayName,
    sector,
    businessType,
    status: validStatus,
    branding,
    paths: {
      // En serverless no hay paths reales — devolvemos placeholders que
      // los consumers downstream pueden usar pero NO leer/escribir.
      clientFilePath: "",
      runtimeConfigPath: "",
      dataPath: getTenantDataRoot(row.clientId),
      artifactsPath: getTenantArtifactsRoot(row.clientId),
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function resolveTenantBySlugAsync(
  slug: string,
): Promise<TenantDefinition | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  if (getPersistenceBackend() === "postgres") {
    const row = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: {
            where: { slug: string };
            select: {
              clientId: true;
              slug: true;
              displayName: true;
              status: true;
              sector: true;
              businessType: true;
              brandingJson: true;
              definition: true;
              updatedAt: true;
            };
          }) => Promise<TenantRow | null>;
        };
      };
      return await c.tenant.findUnique({
        where: { slug: normalized },
        select: {
          clientId: true,
          slug: true,
          displayName: true,
          status: true,
          sector: true,
          businessType: true,
          brandingJson: true,
          definition: true,
          updatedAt: true,
        },
      });
    });
    if (!row) return null;
    return rowToTenantDefinition(row);
  }

  return fsResolveTenantBySlug(normalized);
}

export async function resolveTenantByClientIdAsync(
  clientId: string,
): Promise<TenantDefinition | null> {
  const trimmed = String(clientId || "").trim();
  if (!trimmed) return null;

  if (getPersistenceBackend() === "postgres") {
    const row = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        tenant: {
          findUnique: (a: {
            where: { clientId: string };
            select: {
              clientId: true;
              slug: true;
              displayName: true;
              status: true;
              sector: true;
              businessType: true;
              brandingJson: true;
              definition: true;
              updatedAt: true;
            };
          }) => Promise<TenantRow | null>;
        };
      };
      return await c.tenant.findUnique({
        where: { clientId: trimmed },
        select: {
          clientId: true,
          slug: true,
          displayName: true,
          status: true,
          sector: true,
          businessType: true,
          brandingJson: true,
          definition: true,
          updatedAt: true,
        },
      });
    });
    if (!row) return null;
    return rowToTenantDefinition(row);
  }

  // Fallback fs: el sync resolveTenantByClientId vive en tenant-registry.ts
  // pero se importa indirectamente. Para no añadir dependencia circular,
  // usamos resolveTenantBySlug del fs (que internamente buscará por slug).
  // En filesystem mode los slugs y clientIds suelen coincidir.
  return fsResolveTenantBySlug(trimmed);
}

export async function listAllTenantsAsync(): Promise<TenantDefinition[]> {
  if (getPersistenceBackend() === "filesystem") {
    // Importamos perezosamente para evitar dependencia circular con
    // tenant-registry.ts.
    const { listDiskTenants } = await import("@/lib/saas/tenant-registry");
    return listDiskTenants();
  }

  const rows = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenant: {
        findMany: (a: {
          select: {
            clientId: true;
            slug: true;
            displayName: true;
            status: true;
            sector: true;
            businessType: true;
            brandingJson: true;
            definition: true;
            updatedAt: true;
          };
          orderBy: { updatedAt: "desc" };
        }) => Promise<TenantRow[]>;
      };
    };
    return await c.tenant.findMany({
      select: {
        clientId: true,
        slug: true,
        displayName: true,
        status: true,
        sector: true,
        businessType: true,
        brandingJson: true,
        definition: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  return ((rows as TenantRow[]) || []).map(rowToTenantDefinition);
}

export async function resolveActiveTenantAsync(): Promise<TenantDefinition | null> {
  if (getPersistenceBackend() === "postgres") {
    // En Postgres no hay concepto de "active tenant" como en filesystem
    // (que viene de data/factory/active-client.json). En producción el
    // active fallback no aplica — el tenant siempre se determina por slug
    // explícito en query/header.
    return null;
  }
  return fsResolveActiveTenant();
}

export async function resolveTenantFromRequestAsync(
  request?: NextRequest | null,
): Promise<TenantResolutionResult> {
  if (getPersistenceBackend() === "filesystem") {
    return fsResolveTenantFromRequest(request);
  }

  // Modo Postgres: replicamos la lógica de resolveTenantFromRequest pero
  // usando resolveTenantBySlugAsync.
  const querySlug = normalizeSlug(
    String(request?.nextUrl?.searchParams?.get("tenant") || ""),
  );

  if (querySlug) {
    const tenant = await resolveTenantBySlugAsync(querySlug);
    return {
      ok: tenant !== null,
      source: (tenant ? "query" : "not-found") as TenantResolutionSource,
      requestedSlug: querySlug,
      tenant,
    };
  }

  const headerSlug = normalizeSlug(
    String(request?.headers?.get?.("x-tenant-slug") || ""),
  );

  if (headerSlug) {
    const tenant = await resolveTenantBySlugAsync(headerSlug);
    return {
      ok: tenant !== null,
      source: (tenant ? "header" : "not-found") as TenantResolutionSource,
      requestedSlug: headerSlug,
      tenant,
    };
  }

  // SF-13: si no hay slug en query ni header, intentamos resolver por la
  // cookie de sesión firmada. Sin esto, cuando el usuario navega su runtime
  // (ej. app.prontara.com/facturacion) sin ?tenant=... explícito, no hay
  // forma de identificar su tenant en modo Postgres y todos los modales
  // del ERP salen sin campos. La cookie es trusted (HMAC firmado) — el
  // tenant que indique es el dueño de la sesión.
  if (request) {
    const session = requireTenantSession(request);
    if (session?.clientId) {
      const tenant = await resolveTenantByClientIdAsync(session.clientId);
      if (tenant) {
        return {
          ok: true,
          source: "active-fallback" as TenantResolutionSource,
          requestedSlug: tenant.slug,
          tenant,
        };
      }
    }
  }

  return {
    ok: false,
    source: "not-found" as TenantResolutionSource,
    requestedSlug: null,
    tenant: null,
  };
}
