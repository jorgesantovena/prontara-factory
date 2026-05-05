/**
 * Versión async dual-mode de listTenantClientsIndex.
 *
 * En postgres mode lee directamente la tabla Tenant y reconstruye los
 * `TenantClientIndexItem`. Los flags `hasRuntimeConfig`, `hasArtifacts`,
 * `hasEvolution` se devuelven con valores por defecto razonables (en
 * Postgres no tenemos rutas de filesystem).
 *
 * En filesystem mode delega en la versión sync.
 */
import {
  listTenantClientsIndex as fsListTenantClientsIndex,
  type TenantClientIndexItem,
} from "@/lib/saas/tenant-clients-index";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";

type TenantRow = {
  clientId: string;
  slug: string;
  displayName: string;
  brandingJson: unknown;
  definition: unknown;
  updatedAt: Date;
};

export async function listTenantClientsIndexAsync(): Promise<
  TenantClientIndexItem[]
> {
  if (getPersistenceBackend() === "filesystem") {
    return fsListTenantClientsIndex();
  }

  const rows = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      tenant: {
        findMany: (a: {
          select: {
            clientId: true;
            slug: true;
            displayName: true;
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
        brandingJson: true,
        definition: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  });

  return ((rows as TenantRow[]) || []).map((row) => {
    const branding =
      row.brandingJson && typeof row.brandingJson === "object"
        ? (row.brandingJson as Record<string, unknown>)
        : {};

    const def =
      row.definition && typeof row.definition === "object"
        ? (row.definition as Record<string, unknown>)
        : {};

    return {
      tenantId: String(def.tenantId || row.clientId),
      clientId: row.clientId,
      slug: row.slug,
      displayName: row.displayName,
      // En Postgres no tenemos paths de filesystem; estos flags se
      // devuelven heurísticamente: hasBranding según si hay JSON, los
      // demás siempre false porque la noción de "fichero existe" no
      // aplica. Los consumers que usen estos flags para decidir UX
      // tendrán que migrarse para usar señales reales de Postgres
      // (e.g. preguntar si hay BillingSubscription, OnboardingState,
      // etc.) cuando llegue el momento.
      hasRuntimeConfig: false,
      hasBranding: Boolean(
        branding && Object.keys(branding).length > 0,
      ),
      hasArtifacts: false,
      hasEvolution: false,
      lastUpdatedAt: row.updatedAt.toISOString(),
    } satisfies TenantClientIndexItem;
  });
}
