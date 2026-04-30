/**
 * Implementación Prisma del TenantDataStore.
 *
 * Está gated detrás de `PERSISTENCE_BACKEND=prisma`. El objetivo de esta
 * ronda arquitectónica es dejar la pieza lista para que, cuando el plan de
 * migración de `docs/persistence-migration-plan.md` avance dominio a
 * dominio, baste con cambiar el flag para redirigir las lecturas/escrituras
 * de ese dominio a la base de datos.
 *
 * Por ahora soporta los dominios cuyo modelo Prisma ya existe en
 * `prisma/schema.prisma`: cliente, venta, factura, ajuste, documento,
 * proyecto, tarea, movimiento-tesoreria, cobro, pago. Para módulos no
 * mapeados lanza `UnsupportedModuleError`, que el caller puede capturar
 * para quedarse con el backend JSON en ese dominio concreto.
 */

import type {
  ListOptions,
  TenantDataStore,
  TenantRecordBase,
} from "./tenant-data-store";

// Import tipado perezoso: `@prisma/client` solo se carga cuando el flag
// está activo y este fichero se instancia.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientLike = any;

const MODULE_TO_DELEGATE: Record<string, string> = {
  clientes: "cliente",
  ventas: "venta",
  facturas: "factura",
  ajustes: "ajuste",
  documentos: "documento",
  proyectos: "proyecto",
  tareas: "tarea",
  "movimientos-tesoreria": "movimientoTesoreria",
  tesoreria: "movimientoTesoreria",
  cobros: "cobro",
  pagos: "pago",
};

export class UnsupportedModuleError extends Error {
  constructor(moduleKey: string) {
    super("Módulo no soportado por el backend Prisma: " + moduleKey);
    this.name = "UnsupportedModuleError";
  }
}

function resolveDelegate(prisma: PrismaClientLike, moduleKey: string): PrismaClientLike {
  const name = MODULE_TO_DELEGATE[moduleKey];
  if (!name) throw new UnsupportedModuleError(moduleKey);
  const delegate = prisma[name];
  if (!delegate) throw new UnsupportedModuleError(moduleKey);
  return delegate;
}

async function resolveTenantPk(prisma: PrismaClientLike, clientId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { clientId },
    select: { id: true },
  });
  if (!tenant) {
    throw new Error("Tenant no encontrado para clientId=" + clientId);
  }
  return tenant.id;
}

function toRecord<T extends TenantRecordBase>(row: Record<string, unknown>): T {
  const { createdAt, updatedAt, ...rest } = row as Record<string, unknown> & {
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };
  return {
    ...rest,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? new Date().toISOString()),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? new Date().toISOString()),
  } as T;
}

export class PrismaTenantDataStore implements TenantDataStore {
  private prisma: PrismaClientLike;

  constructor() {
    // Carga dinámica vía createRequire para no forzar al bundler a incluir
    // @prisma/client cuando el flag está en `json`. Este constructor solo se
    // ejecuta si `PERSISTENCE_BACKEND=prisma`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRequire } = require("node:module") as { createRequire: (url: string) => (id: string) => unknown };
    const localRequire = createRequire(import.meta.url);
    const mod = localRequire("@prisma/client") as { PrismaClient: new () => PrismaClientLike };
    this.prisma = new mod.PrismaClient();
  }

  async list<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    options?: ListOptions,
  ): Promise<T[]> {
    const tenantId = await resolveTenantPk(this.prisma, clientId);
    const delegate = resolveDelegate(this.prisma, moduleKey);

    const orderBy = options?.orderBy
      ? { [options.orderBy.field]: options.orderBy.direction }
      : { createdAt: "desc" as const };

    const rows = await delegate.findMany({
      where: { tenantId },
      orderBy,
      skip: options?.offset,
      take: options?.limit,
    });
    return rows.map((r: Record<string, unknown>) => toRecord<T>(r));
  }

  async get<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
  ): Promise<T | null> {
    const tenantId = await resolveTenantPk(this.prisma, clientId);
    const delegate = resolveDelegate(this.prisma, moduleKey);
    const row = await delegate.findFirst({ where: { id, tenantId } });
    return row ? toRecord<T>(row) : null;
  }

  async create<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    record: Omit<T, "id" | "createdAt" | "updatedAt">,
  ): Promise<T> {
    const tenantId = await resolveTenantPk(this.prisma, clientId);
    const delegate = resolveDelegate(this.prisma, moduleKey);
    const row = await delegate.create({
      data: { ...record, tenantId },
    });
    return toRecord<T>(row);
  }

  async update<T extends TenantRecordBase = TenantRecordBase>(
    clientId: string,
    moduleKey: string,
    id: string,
    patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
  ): Promise<T | null> {
    const tenantId = await resolveTenantPk(this.prisma, clientId);
    const delegate = resolveDelegate(this.prisma, moduleKey);

    // updateMany garantiza aislamiento: solo actualiza si tenantId coincide.
    const { count } = await delegate.updateMany({
      where: { id, tenantId },
      data: patch,
    });
    if (count === 0) return null;

    const row = await delegate.findFirst({ where: { id, tenantId } });
    return row ? toRecord<T>(row) : null;
  }

  async remove(clientId: string, moduleKey: string, id: string): Promise<boolean> {
    const tenantId = await resolveTenantPk(this.prisma, clientId);
    const delegate = resolveDelegate(this.prisma, moduleKey);
    const { count } = await delegate.deleteMany({ where: { id, tenantId } });
    return count > 0;
  }

  async dropTenant(clientId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId },
      select: { id: true },
    });
    if (!tenant) return;
    // onDelete: Cascade en todas las relaciones → borrar el Tenant arrastra todo.
    await this.prisma.tenant.delete({ where: { id: tenant.id } });
  }
}
