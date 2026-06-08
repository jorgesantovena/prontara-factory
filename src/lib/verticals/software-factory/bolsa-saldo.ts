/**
 * Saldo de bolsas de horas para el vertical Software Factory (SF-06).
 *
 * Facturación.pptx (Pedro) — La bolsa vive en el Contrato (campo
 * `bolsaHoras`), no en el cliente ni en un proyecto separado.
 * Devolvemos UNA línea por contrato vigente con bolsa > 0:
 *   - horasTotales      = contrato.bolsaHoras
 *   - horasConsumidas   = Σ tiempoHoras de tareas asignadas a este
 *                         contrato (proyecto.contrato = contrato y
 *                         proyecto.facturable = "si")
 *   - horasRestantes    = max(0, totales − consumidas)
 *   - porcentaje        = consumidas / totales × 100
 *
 * Fallback legacy: si no hay contratos definidos pero existe un
 * proyecto BOLSA/MANT con `horasTotales` informado, se sigue
 * mostrando el modelo viejo (informe estilo SISPYME por proyecto).
 *
 * El consumidor puede pintar cards en el dashboard, alertas
 * operativas (ver alerts.ts) o columnas en /contratos. La key
 * estable para deduplicar es `proyectoId` (id del contrato o del
 * proyecto BOLSA en el caso legacy).
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
  if (trimmed.includes(":")) {
    const [hh = "0", mm = "0"] = trimmed.split(":");
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
    return 0;
  }
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

function build(
  proyectoId: string,
  proyectoLabel: string,
  cliente: string,
  fechaCaducidad: string,
  horasTotales: number,
  consumidas: number,
): BolsaSaldo {
  const restantes = Math.max(0, horasTotales - consumidas);
  const porcentaje =
    horasTotales > 0 ? Math.min(999, Math.round((consumidas / horasTotales) * 100)) : 0;
  return {
    proyectoId,
    proyecto: proyectoLabel,
    cliente,
    fechaCaducidad,
    horasTotales: Math.round(horasTotales * 100) / 100,
    horasConsumidas: Math.round(consumidas * 100) / 100,
    horasRestantes: Math.round(restantes * 100) / 100,
    porcentajeConsumido: porcentaje,
    severidad: severidadFor(porcentaje),
  };
}

export async function getBolsasSaldoAsync(clientId: string): Promise<BolsaSaldo[]> {
  const cid = String(clientId || "").trim();
  if (!cid) return [];

  let projects: Array<Record<string, string>> = [];
  let activities: Array<Record<string, string>> = [];
  let contracts: Array<Record<string, string>> = [];
  try {
    [projects, activities, contracts] = await Promise.all([
      listModuleRecordsAsync("proyectos", cid),
      listModuleRecordsAsync("actividades", cid),
      listModuleRecordsAsync("contratos", cid).catch(() => []),
    ]);
  } catch {
    return [];
  }

  // Mapa proyecto → (facturable, contrato).
  const proyectoFacturablePorRef = new Map<string, boolean>();
  const proyectoContratoPorRef = new Map<string, string>();
  for (const p of projects) {
    const facturable = String(p.facturable || "").toLowerCase() === "si";
    const contrato = String(p.contrato || "");
    if (p.nombre) { proyectoFacturablePorRef.set(String(p.nombre), facturable); proyectoContratoPorRef.set(String(p.nombre), contrato); }
    if (p.id)     { proyectoFacturablePorRef.set(String(p.id),     facturable); proyectoContratoPorRef.set(String(p.id),     contrato); }
  }

  const out: BolsaSaldo[] = [];
  const contratosConSaldo = new Set<string>();

  // 1) Saldo por Contrato (modelo nuevo Facturación.pptx).
  for (const c of contracts) {
    const numero = String(c.numero || c.id || "").trim();
    if (!numero) continue;
    const horasTotales = parseHoras(c.bolsaHoras);
    if (horasTotales <= 0) continue; // contrato sin bolsa (Horas puras / Bono ya consumido)
    contratosConSaldo.add(numero);
    const consumidas = activities.reduce((acc, a) => {
      const proyRef = String(a.proyecto || "");
      const cRef = String(a.contrato || "") || proyectoContratoPorRef.get(proyRef) || "";
      if (cRef !== numero) return acc;
      if (!proyectoFacturablePorRef.get(proyRef)) return acc;
      return acc + parseHoras(a.tiempoHoras || a.horas);
    }, 0);
    out.push(build(
      String(c.id || numero),
      "Contrato " + numero,
      String(c.cliente || ""),
      String(c.fechaFin || ""),
      horasTotales,
      consumidas,
    ));
  }

  // 2) Fallback legacy: proyectos BOLSA/MANT con `horasTotales` para
  //    tenants que aún no han migrado a contratos.
  if (out.length === 0) {
    const bolsasLegacy = projects.filter(
      (p) => String(p.codigoTipo || "").trim().toUpperCase() === "BOLSA",
    );
    for (const b of bolsasLegacy) {
      const proyecto = String(b.nombre || "").trim();
      const cliente = String(b.cliente || "").trim();
      const horasTotales = parseHoras(b.horasTotales);
      const consumidas = activities
        .filter((a) => String(a.proyecto || "").trim() === proyecto)
        .reduce((acc, a) => acc + parseHoras(a.tiempoHoras || a.horas), 0);
      out.push(build(
        String(b.id || ""),
        proyecto,
        cliente,
        String(b.fechaCaducidad || ""),
        horasTotales,
        consumidas,
      ));
    }
  }

  out.sort((a, b) => b.porcentajeConsumido - a.porcentajeConsumido);
  return out;
}
