import { assertSafePathSegment } from "@/lib/persistence/path-safety";

export const MODULE_DATA_FILES: Record<string, string> = {
  clientes: "clientes.json",
  crm: "crm.json",
  proyectos: "proyectos.json",
  presupuestos: "presupuestos.json",
  facturacion: "facturacion.json",
  documentos: "documentos.json",
};

export function resolveModuleDataFile(moduleKey: string): string {
  const normalized = String(moduleKey || "").trim().toLowerCase();

  if (!normalized) {
    throw new Error("Falta moduleKey.");
  }

  // SEGURIDAD — el moduleKey llega desde el request (?module=...) y se
  // concatena a una ruta de fichero. Rechazamos `../`, `/`, `.` etc. para
  // impedir path traversal cross-tenant. Ver path-safety.ts.
  assertSafePathSegment(normalized, "moduleKey");

  return MODULE_DATA_FILES[normalized] || (normalized + ".json");
}