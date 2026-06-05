/**
 * Saldo de bolsas de horas para el vertical Software Factory (SF-06).
 *
 * TEST-20 F.8 — Pedro: la bolsa pasa a vivir en el Cliente (campo
 * `bolsaCantidad` del módulo `clientes`), no en un proyecto separado.
 * Devolvemos UNA bolsa por cliente (no por proyecto):
 *   - horasTotales      = cliente.bolsaCantidad
 *   - horasConsumidas   = Σ tiempoHoras de tareas del cliente cuyo
 *                         proyecto tenga facturable === "si"
 *   - horasRestantes    = max(0, totales − consumidas)
 *   - porcentaje        = consumidas / totales × 100
 *
 * Fallback legacy: si un cliente NO tiene bolsaCantidad pero existe un
 * proyecto suyo con codigoTipo=BOLSA/MANT y `horasTotales` informado,
 * usamos ese proyecto como bolsa (modelo viejo). Coherente con el
 * adaptador de `/api/erp/prefacturacion` y `/api/erp/detalle-servicios-pdf`.
 *
 * El consumidor puede pintar cards en el dashboard, alertas operativas
 * (ver alerts.ts) o columnas en /proyectos. La key estable para
 * deduplicar entre invocaciones es `proyectoId` (id del cliente o, en
 * legacy, id del proyecto BOLSA).
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
  // TEST-12 #1 — soporte para hh:mm legacy.
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
  let customers: Array<Record<string, string>> = [];
  try {
    [projects, activities, customers] = await Promise.all([
      listModuleRecordsAsync("proyectos", cid),
      listModuleRecordsAsync("actividades", cid),
      listModuleRecordsAsync("clientes", cid),
    ]);
  } catch {
    return [];
  }

  // TEST-20 F.8 — Mapa proyecto → facturable (sí/no) para sumar
  // consumo únicamente de proyectos cuya bandera lo marque facturable.
  const facturablePorProyecto = new Map<string, boolean>();
  for (const p of projects) {
    const facturable = String(p.facturable || "").toLowerCase() === "si";
    if (p.nombre) facturablePorProyecto.set(String(p.nombre), facturable);
    if (p.id) facturablePorProyecto.set(String(p.id), facturable);
  }

  const out: BolsaSaldo[] = [];
  const clientesConBolsaPropia = new Set<string>();

  // 1) Bolsas por Cliente (modelo nuevo TEST-20 F).
  for (const c of customers) {
    const nombre = String(c.nombre || "").trim();
    if (!nombre) continue;
    const horasTotales = parseHoras(c.bolsaCantidad);
    if (horasTotales <= 0) continue; // sin bolsa contratada — no genera línea
    clientesConBolsaPropia.add(nombre);
    const consumidas = activities
      .filter((a) => {
        if (String(a.cliente || "").trim() !== nombre) return false;
        return facturablePorProyecto.get(String(a.proyecto || "")) === true;
      })
      .reduce((acc, a) => acc + parseHoras(a.tiempoHoras || a.horas), 0);
    out.push(build(
      "cli-" + String(c.id || nombre),
      "Bolsa contratada", // proyecto = etiqueta; cliente ya va aparte
      nombre,
      "", // los clientes no tienen fechaCaducidad en el modelo
      horasTotales,
      consumidas,
    ));
  }

  // 2) Fallback legacy: proyectos BOLSA/MANT del cliente que aún no
  //    fue cubierto por el modelo nuevo. Conserva el comportamiento
  //    histórico (informe estilo SISPYME por proyecto).
  const bolsasLegacy = projects.filter(
    (p) => String(p.codigoTipo || "").trim().toUpperCase() === "BOLSA",
  );
  for (const b of bolsasLegacy) {
    const proyecto = String(b.nombre || "").trim();
    const cliente = String(b.cliente || "").trim();
    if (clientesConBolsaPropia.has(cliente)) continue; // ya lo sacamos por el modelo nuevo
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

  // Más críticas primero (las agotadas arriba)
  out.sort((a, b) => b.porcentajeConsumido - a.porcentajeConsumido);
  return out;
}
