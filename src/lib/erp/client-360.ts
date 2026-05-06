import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type Client360RelatedItem = {
  id: string;
  moduleKey: string;
  moduleLabel: string;
  title: string;
  subtitle: string;
  href: string;
  status: string;
  updatedAt: string;
};

export type Client360Snapshot = {
  ok: boolean;
  clientId: string;
  clientName: string;
  clientRecord: Record<string, string> | null;
  summary: {
    oportunidades: number;
    proyectos: number;
    presupuestos: number;
    facturas: number;
    documentos: number;
  };
  related: Client360RelatedItem[];
};

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function sameClient(left: string, right: string) {
  return normalize(left) && normalize(left) === normalize(right);
}

function buildItems(
  rows: Array<Record<string, string>>,
  moduleKey: string,
  moduleLabel: string,
  clientName: string,
  titleField: string,
  subtitleField: string,
  statusField: string,
  href: string
): Client360RelatedItem[] {
  return rows
    .filter((item) => sameClient(String(item.cliente || item.empresa || ""), clientName))
    .map((item) => ({
      id: String(item.id || Math.random()),
      moduleKey,
      moduleLabel,
      title: String(item[titleField] || "Sin título"),
      subtitle: String(item[subtitleField] || ""),
      href,
      status: String(item[statusField] || item.estado || item.fase || ""),
      updatedAt: String(item.updatedAt || item.createdAt || ""),
    }));
}

export async function getClient360Snapshot(clientName: string, activeClientId?: string): Promise<Client360Snapshot> {
  const [clientes, crm, proyectos, presupuestos, facturacion, documentos] =
    await Promise.all([
      listModuleRecordsAsync("clientes", activeClientId),
      listModuleRecordsAsync("crm", activeClientId),
      listModuleRecordsAsync("proyectos", activeClientId),
      listModuleRecordsAsync("presupuestos", activeClientId),
      listModuleRecordsAsync("facturacion", activeClientId),
      listModuleRecordsAsync("documentos", activeClientId),
    ]);

  const clientRecord =
    clientes.find((item) => sameClient(String(item.nombre || ""), clientName)) || null;

  const crmItems = buildItems(crm, "crm", "CRM", clientName, "contacto", "fase", "fase", "/crm");
  const proyectoItems = buildItems(proyectos, "proyectos", "Trabajos", clientName, "nombre", "responsable", "estado", "/proyectos");
  const presupuestoItems = buildItems(presupuestos, "presupuestos", "Propuestas", clientName, "numero", "concepto", "estado", "/presupuestos");
  const facturaItems = buildItems(facturacion, "facturacion", "Facturas", clientName, "numero", "concepto", "estado", "/facturacion");
  const documentoItems = documentos
    .filter((item) =>
      sameClient(String(item.cliente || item.empresa || item.entidadOrigen || ""), clientName)
    )
    .map((item) => ({
      id: String(item.id || Math.random()),
      moduleKey: "documentos",
      moduleLabel: "Documentos",
      title: String(item.nombre || "Documento"),
      subtitle: String(item.tipo || ""),
      href: "/documentos",
      status: String(item.estado || ""),
      updatedAt: String(item.updatedAt || item.createdAt || ""),
    }));

  const related = [
    ...crmItems,
    ...proyectoItems,
    ...presupuestoItems,
    ...facturaItems,
    ...documentoItems,
  ].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  return {
    ok: true,
    clientId: activeClientId || "",
    clientName,
    clientRecord,
    summary: {
      oportunidades: crmItems.length,
      proyectos: proyectoItems.length,
      presupuestos: presupuestoItems.length,
      facturas: facturaItems.length,
      documentos: documentoItems.length,
    },
    related,
  };
}