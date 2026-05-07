/**
 * Saldo de bolsas de horas para el vertical Software Factory (SF-06).
 *
 * Para cada proyecto con codigoTipo=BOLSA cruza con el módulo
 * "actividades" (parte de horas) para sumar las horas imputadas y
 * calcular el saldo restante respecto a las horasTotales contratadas.
 *
 * Devuelve un array por bolsa con horas totales, consumidas, restantes
 * y porcentaje consumido. El consumidor puede pintar cards en el
 * dashboard, alertas operativas (ver alerts.ts) o columnas en /proyectos.
 *
 * Caveat: la actividad cuenta para el consumo SI:
 *   - act.proyecto matchea con bolsa.nombre (string compare trimmed).
 * No filtramos por estado ni por facturable: la imputación de tiempo
 * consume bolsa independientemente de si se factura o no.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type BolsaSaldo = {
  proyectoId: string;
  proyecto: string;
  cliente: string;
  fechaCaducidad: string;
  horasTotales: number;
  horasConsumidas: number;
  horasRestantes: number;
  porcentajeConsumido: number;
  /** Severidad calculada: ok (<70%), watch (70-85%), warn (85-100%), depleted (>=100%) */
  severidad: "ok" | "watch" | "warn" | "depleted";
};

function parseHoras(value: string | undefined): number {
  if (!value) return 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;
  const match = trimmed.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const n = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function severidadFor(porcentaje: number): BolsaSaldo["severidad"] {
  if (porcentaje >= 100) return "depleted";
  if (porcentaje >= 85) return "warn";
  if (porcentaje >= 70) return "watch";
  return "ok";
}

export async function getBolsasSaldoAsync(clientId: string): Promise<BolsaSaldo[]> {
  const cid = String(clientId || "").trim();
  if (!cid) return [];

  let projects: Array<Record<string, string>> = [];
  let activities: Array<Record<string, string>> = [];
  try {
    [projects, activities] = await Promise.all([
      listModuleRecordsAsync("proyectos", cid),
      listModuleRecordsAsync("actividades", cid),
    ]);
  } catch {
    return [];
  }

  const bolsas = projects.filter(
    (p) => String(p.codigoTipo || "").trim().toUpperCase() === "BOLSA",
  );
  if (bolsas.length === 0) return [];

  const out: BolsaSaldo[] = [];

  for (const b of bolsas) {
    const proyecto = String(b.nombre || "").trim();
    const horasTotales = parseHoras(b.horasTotales);
    const consumidas = activities
      .filter((a) => String(a.proyecto || "").trim() === proyecto)
      .reduce((acc, a) => acc + parseHoras(a.horas), 0);

    const restantes = Math.max(0, horasTotales - consumidas);
    const porcentaje =
      horasTotales > 0 ? Math.min(999, Math.round((consumidas / horasTotales) * 100)) : 0;

    out.push({
      proyectoId: String(b.id || ""),
      proyecto,
      cliente: String(b.cliente || ""),
      fechaCaducidad: String(b.fechaCaducidad || ""),
      horasTotales: Math.round(horasTotales * 100) / 100,
      horasConsumidas: Math.round(consumidas * 100) / 100,
      horasRestantes: Math.round(restantes * 100) / 100,
      porcentajeConsumido: porcentaje,
      severidad: severidadFor(porcentaje),
    });
  }

  // Más críticas primero (las agotadas arriba)
  out.sort((a, b) => b.porcentajeConsumido - a.porcentajeConsumido);
  return out;
}
