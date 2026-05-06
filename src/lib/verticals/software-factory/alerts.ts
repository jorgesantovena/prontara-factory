/**
 * Alertas operativas específicas del vertical Software Factory.
 *
 * Hoy solo añade las de caducidad de proyectos. El módulo
 * `src/lib/erp/operational-alerts.ts` cubre las alertas universales
 * (facturas vencidas, propuestas paradas, clientes inactivos). Este
 * módulo se llama además, no en lugar de, el genérico.
 *
 * Solo aplica si el tenant es del vertical software-factory. El caller
 * decide cuándo invocarlo.
 */
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { buildProjectExpirationAlerts } from "@/lib/verticals/software-factory/project-expiration";
import type { OperationalAlert } from "@/lib/erp/operational-alerts";

/**
 * Construye alertas operativas de caducidad de proyectos para el
 * dashboard runtime de un tenant SF. No falla si el tenant no tiene
 * proyectos — devuelve array vacío.
 */
export async function buildSoftwareFactoryAlertsAsync(
  clientId: string,
  now = new Date(),
): Promise<OperationalAlert[]> {
  if (!clientId) return [];
  let projects: Array<Record<string, string>> = [];
  try {
    projects = await listModuleRecordsAsync("proyectos", clientId);
  } catch {
    return [];
  }

  const expirationAlerts = buildProjectExpirationAlerts(projects, now);
  const out: OperationalAlert[] = [];

  for (const alert of expirationAlerts) {
    const days = alert.diasRestantes;
    if (alert.estadoDerivado === "expirado") {
      out.push({
        key: "sf-proyecto-expirado-" + alert.proyecto,
        severity: "danger",
        title:
          "Proyecto expirado: " +
          alert.proyecto +
          " (" +
          alert.cliente +
          ")",
        detail:
          "El contrato caducó el " +
          alert.fechaCaducidad +
          " hace " +
          Math.abs(days) +
          " días. No acepta nuevas horas. Renueva o márcalo como finalizado.",
        href: "/proyectos",
      });
    } else if (alert.estadoDerivado === "por_renovar") {
      out.push({
        key: "sf-proyecto-por-renovar-" + alert.proyecto,
        severity: alert.severidad === "media" ? "danger" : "warn",
        title:
          "Renueva pronto: " +
          alert.proyecto +
          " (" +
          alert.cliente +
          ")",
        detail:
          alert.codigoTipo +
          " caduca el " +
          alert.fechaCaducidad +
          " — quedan " +
          days +
          " días. Si quieres renovar, hazlo antes para que no haya corte.",
        href: "/proyectos",
      });
    }
  }

  return out;
}
