/**
 * KPIs específicos del vertical Software Factory para el dashboard runtime
 * (SF-09).
 *
 * Reutiliza las piezas existentes:
 *   - billing-preview → horas e importe pendientes de facturar este mes
 *   - bolsa-saldo → saldo total de bolsas + cuántas agotadas
 *   - project-expiration → contratos por renovar
 *
 * No persiste nada — solo agrega y devuelve. El consumidor decide cómo
 * pintarlo (dashboard cards, asistente, alertas, etc.).
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { getMonthlyBillingPreview } from "@/lib/verticals/software-factory/billing-preview";
import { getBolsasSaldoAsync } from "@/lib/verticals/software-factory/bolsa-saldo";
import { buildProjectExpirationAlerts } from "@/lib/verticals/software-factory/project-expiration";

export type SoftwareFactoryKpis = {
  /** YYYY-MM efectivamente calculado (puede diferir del solicitado si era inválido). */
  mes: string;
  /** Total horas pendientes de facturar este mes (facturable=si, facturado!=si). */
  horasPdteFacturarMes: number;
  /** Importe estimado de esas horas según tarifa cascada (€). */
  importePdteFacturarMes: number;
  /** Número de contratos en estado derivado por_renovar (caduca en <=30 días). */
  contratosPorRenovar: number;
  /** Suma de horas restantes en todas las bolsas activas. */
  saldoTotalBolsas: number;
  /** Bolsas con saldo agotado (consumido >=100%). */
  bolsasAgotadas: number;
  /** Bolsas en estado warn (consumido >=85% pero <100%). */
  bolsasCriticas: number;
};

export async function getSoftwareFactoryKpisAsync(
  clientId: string,
  mes?: string,
): Promise<SoftwareFactoryKpis> {
  const cid = String(clientId || "").trim();
  if (!cid) {
    return {
      mes: "",
      horasPdteFacturarMes: 0,
      importePdteFacturarMes: 0,
      contratosPorRenovar: 0,
      saldoTotalBolsas: 0,
      bolsasAgotadas: 0,
      bolsasCriticas: 0,
    };
  }

  const [preview, bolsas, proyectos] = await Promise.all([
    getMonthlyBillingPreview(cid, mes).catch(() => null),
    getBolsasSaldoAsync(cid).catch(() => []),
    listModuleRecordsAsync("proyectos", cid).catch(() => []),
  ]);

  const expirations = buildProjectExpirationAlerts(proyectos);
  const porRenovar = expirations.filter((e) => e.estadoDerivado === "por_renovar").length;

  const saldoTotal = bolsas.reduce((acc, b) => acc + (b.horasRestantes || 0), 0);
  const bolsasAgotadas = bolsas.filter((b) => b.severidad === "depleted").length;
  const bolsasCriticas = bolsas.filter((b) => b.severidad === "warn").length;

  return {
    mes: preview?.mes || "",
    horasPdteFacturarMes: preview ? preview.totalHoras : 0,
    importePdteFacturarMes: preview ? preview.totalImporte : 0,
    contratosPorRenovar: porRenovar,
    saldoTotalBolsas: Math.round(saldoTotal * 100) / 100,
    bolsasAgotadas,
    bolsasCriticas,
  };
}
