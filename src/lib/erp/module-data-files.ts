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

  return MODULE_DATA_FILES[normalized] || (normalized + ".json");
}