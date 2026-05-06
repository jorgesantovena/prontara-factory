/**
 * Previsión de factura mensual para el vertical Software Factory.
 *
 * Cruza actividades del módulo "actividades" (parte de horas) con sus
 * proyectos para identificar las horas que están pendientes de facturar
 * en un mes concreto, agruparlas por cliente y proyecto y calcular el
 * importe total previsto.
 *
 * Lógica:
 *   - Una actividad cuenta para la previsión si:
 *       facturable === "si" Y facturado !== "si" Y la fecha cae en el mes consultado.
 *   - El importe = horas * tarifaHora (de la actividad si la trae,
 *     si no de tarifaHoraOverride del proyecto, si no del catálogo del tipo).
 *   - Las actividades se agrupan por (cliente, proyecto) en el output.
 *
 * No genera facturas aquí — es una previsión de solo lectura. La generación
 * se hará desde la UI cuando el operador confirme.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type BillingLineActivity = {
  fecha: string;
  persona: string;
  concepto: string;
  horas: number;
  tarifaHora: number;
  importe: number;
};

export type BillingPreviewProjectGroup = {
  cliente: string;
  proyecto: string;
  codigoTipo: string;
  totalHoras: number;
  totalImporte: number;
  actividades: BillingLineActivity[];
};

export type BillingPreviewClientGroup = {
  cliente: string;
  totalHoras: number;
  totalImporte: number;
  proyectos: BillingPreviewProjectGroup[];
};

export type BillingPreview = {
  mes: string; // YYYY-MM
  totalHoras: number;
  totalImporte: number;
  clientes: BillingPreviewClientGroup[];
  notas: string[];
};

type ActivityRow = Record<string, string>;
type ProjectRow = Record<string, string>;
type CatalogRow = Record<string, string>;

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const trimmed = String(value).trim();
  // Soporta "55", "55.5", "55,5", "60 EUR" — extraemos el primer número.
  const match = trimmed.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;
  return parseFloat(match[0].replace(",", "."));
}

function isCurrentMonth(fechaIso: string, mes: string): boolean {
  // mes: "YYYY-MM". fechaIso esperada "YYYY-MM-DD".
  if (!fechaIso || !mes) return false;
  return fechaIso.startsWith(mes);
}

function findProject(name: string, projects: ProjectRow[]): ProjectRow | null {
  if (!name) return null;
  return projects.find((p) => String(p.nombre || "").trim() === name.trim()) || null;
}

function findCatalogEntry(
  codigoTipo: string,
  catalog: CatalogRow[],
): CatalogRow | null {
  if (!codigoTipo) return null;
  return (
    catalog.find(
      (c) => String(c.codigo || "").trim().toUpperCase() ===
        codigoTipo.trim().toUpperCase(),
    ) || null
  );
}

function resolveTarifa(
  activity: ActivityRow,
  project: ProjectRow | null,
  catalog: CatalogRow | null,
): number {
  // Orden de prioridad: actividad → proyecto → catálogo → 0.
  const fromActivity = parseNumber(activity.tarifaHora, NaN);
  if (Number.isFinite(fromActivity) && fromActivity > 0) return fromActivity;
  const fromProject = parseNumber(project?.tarifaHoraOverride, NaN);
  if (Number.isFinite(fromProject) && fromProject > 0) return fromProject;
  const fromCatalog = parseNumber(catalog?.tarifaHoraDefault, NaN);
  if (Number.isFinite(fromCatalog) && fromCatalog > 0) return fromCatalog;
  return 0;
}

/**
 * Calcula la previsión de factura del mes para un tenant del vertical SF.
 * @param clientId tenant del runtime (no la cuenta admin).
 * @param mes formato "YYYY-MM". Si se omite, usa el mes actual UTC.
 */
export async function getMonthlyBillingPreview(
  clientId: string,
  mes?: string,
): Promise<BillingPreview> {
  const month =
    mes && /^\d{4}-\d{2}$/.test(mes)
      ? mes
      : (() => {
          const now = new Date();
          const yyyy = now.getUTCFullYear();
          const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
          return yyyy + "-" + mm;
        })();

  const [activities, projects, catalog] = await Promise.all([
    listModuleRecordsAsync("actividades", clientId),
    listModuleRecordsAsync("proyectos", clientId),
    listModuleRecordsAsync("catalogo-servicios", clientId),
  ]);

  const notas: string[] = [];
  const clientesMap = new Map<string, BillingPreviewClientGroup>();

  for (const act of activities) {
    if (!isCurrentMonth(String(act.fecha || ""), month)) continue;
    if (String(act.facturable || "").toLowerCase() !== "si") continue;
    if (String(act.facturado || "").toLowerCase() === "si") continue;

    const project = findProject(String(act.proyecto || ""), projects);
    if (!project) {
      notas.push(
        "Actividad del " +
          act.fecha +
          " (" +
          act.persona +
          ") apunta al proyecto '" +
          act.proyecto +
          "' que no existe en el módulo proyectos.",
      );
      continue;
    }

    const catalogEntry = findCatalogEntry(
      String(project.codigoTipo || ""),
      catalog,
    );
    const tarifaHora = resolveTarifa(act, project, catalogEntry);
    const horas = parseNumber(act.horas, 0);
    const importe = Math.round(horas * tarifaHora * 100) / 100;
    const cliente = String(project.cliente || "").trim() || "(sin cliente)";

    let clientGroup = clientesMap.get(cliente);
    if (!clientGroup) {
      clientGroup = {
        cliente,
        totalHoras: 0,
        totalImporte: 0,
        proyectos: [],
      };
      clientesMap.set(cliente, clientGroup);
    }

    let projectGroup = clientGroup.proyectos.find(
      (p) => p.proyecto === project.nombre,
    );
    if (!projectGroup) {
      projectGroup = {
        cliente,
        proyecto: String(project.nombre || ""),
        codigoTipo: String(project.codigoTipo || ""),
        totalHoras: 0,
        totalImporte: 0,
        actividades: [],
      };
      clientGroup.proyectos.push(projectGroup);
    }

    projectGroup.actividades.push({
      fecha: String(act.fecha || ""),
      persona: String(act.persona || ""),
      concepto: String(act.concepto || ""),
      horas,
      tarifaHora,
      importe,
    });
    projectGroup.totalHoras += horas;
    projectGroup.totalImporte += importe;
    clientGroup.totalHoras += horas;
    clientGroup.totalImporte += importe;
  }

  const clientes = Array.from(clientesMap.values()).sort(
    (a, b) => b.totalImporte - a.totalImporte,
  );
  const totalHoras = clientes.reduce((acc, c) => acc + c.totalHoras, 0);
  const totalImporte = clientes.reduce((acc, c) => acc + c.totalImporte, 0);

  return {
    mes: month,
    totalHoras: Math.round(totalHoras * 100) / 100,
    totalImporte: Math.round(totalImporte * 100) / 100,
    clientes,
    notas,
  };
}
