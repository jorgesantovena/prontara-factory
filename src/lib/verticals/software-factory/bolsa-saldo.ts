/**
 * Saldo de bolsas de horas — TEST 19 (Pedro).
 *
 * Una línea por Contrato Tipo M activo con Nivel Cuota que tenga
 * Bolsa > 0. Para cada uno calcula:
 *   - horasTotales   = nivel.bolsa (Bolsa contratada del Nivel Cuota)
 *   - horasConsumidas = contrato.consumo (alimentado por trigger,
 *                        reset anual)
 *   - horasRestantes  = max(0, totales − consumidas − facturadas)
 *
 * Los contratos Tipo A (tarifa plana) y Tipo B (bonos) no se cuentan
 * aquí: A no tiene tope, B no recurre.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";

export type BolsaSaldo = {
  proyectoId: string; // estable: id del contrato
  proyecto: string;   // label "Contrato CON-..."
  cliente: string;
  fechaCaducidad: string;
  horasTotales: number;
  horasConsumidas: number;
  horasRestantes: number;
  porcentajeConsumido: number;
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

export async function getBolsasSaldoAsync(clientId: string): Promise<BolsaSaldo[]> {
  const cid = String(clientId || "").trim();
  if (!cid) return [];

  let contracts: Array<Record<string, string>> = [];
  let niveles: Array<Record<string, string>> = [];
  try {
    [contracts, niveles] = await Promise.all([
      listModuleRecordsAsync("contratos", cid).catch(() => []),
      listModuleRecordsAsync("niveles", cid).catch(() => []),
    ]);
  } catch {
    return [];
  }

  // Index niveles por (tipoNivel, subtipo, modelo).
  function nivelOf(tipoNivel: string, subtipo: string, modelo: "cuota" | "horas"): Record<string, string> | undefined {
    return niveles.find((n) =>
      String(n.tipoNivel).toUpperCase() === String(tipoNivel).toUpperCase() &&
      String(n.subtipo) === String(subtipo) &&
      String(n.modelo).toLowerCase() === modelo);
  }

  const out: BolsaSaldo[] = [];
  for (const c of contracts) {
    const tipoNivel = String(c.tipoNivel || "").toUpperCase();
    if (tipoNivel !== "M") continue; // solo mantenimiento
    const estado = String(c.estado || "").toLowerCase();
    if (estado === "cancelado" || estado === "finalizado") continue;
    const subtipo = String(c.subtipo || "");
    const nivelCuota = nivelOf("M", subtipo, "cuota");
    if (!nivelCuota) continue;
    const bolsa = parseHoras(nivelCuota.bolsa);
    if (bolsa <= 0) continue;
    const consumo = parseHoras(c.consumo);
    const facturadas = parseHoras(c.facturadas);
    const restantes = Math.max(0, bolsa - consumo - facturadas);
    const consumidasEfectivas = Math.min(bolsa, consumo + facturadas);
    const porcentaje = Math.min(999, Math.round((consumidasEfectivas / bolsa) * 100));
    out.push({
      proyectoId: String(c.id || c.codigo || ""),
      proyecto: "Contrato " + String(c.codigo || c.numero || c.id || ""),
      cliente: String(c.cliente || ""),
      fechaCaducidad: String(c.fechaFin || ""),
      horasTotales: Math.round(bolsa * 100) / 100,
      horasConsumidas: Math.round(consumidasEfectivas * 100) / 100,
      horasRestantes: Math.round(restantes * 100) / 100,
      porcentajeConsumido: porcentaje,
      severidad: severidadFor(porcentaje),
    });
  }

  out.sort((a, b) => b.porcentajeConsumido - a.porcentajeConsumido);
  return out;
}
