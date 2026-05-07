/**
 * Emisión real de facturas mensuales para el vertical Software Factory (SF-02).
 *
 * Toma el output del billing-preview (cruce actividades × proyectos × catálogo)
 * y, por cada cliente con horas pendientes en el mes, emite UNA factura:
 *
 *   1. Reserva número correlativo (FAC-YYYY-NNN) vía SF-01.
 *   2. Crea registro en módulo "facturacion".
 *   3. Marca cada actividad incluida como facturado="si" + facturaNumero.
 *
 * Es idempotente sobre las actividades: las que ya estaban marcadas como
 * facturado="si" no aparecen en el preview, así que no se vuelven a tocar.
 *
 * Si emit falla a mitad de un cliente (ej. update de actividad rompe), la
 * factura ya está creada y las actividades ya marcadas hasta ese punto
 * quedan parcialmente actualizadas. Para SISPYME real esto es aceptable:
 * el operador ve qué se quedó a medias y completa manualmente. Una
 * transacción atómica completa es trabajo de SF-12 (Veri*factu) — entonces
 * sí necesitaremos atomicidad estricta.
 */

import {
  createModuleRecordAsync,
  listModuleRecordsAsync,
  updateModuleRecordAsync,
} from "@/lib/persistence/active-client-data-store-async";
import { allocateNextSequenceNumberAsync } from "@/lib/persistence/sequence-counter-async";
import { getMonthlyBillingPreview } from "@/lib/verticals/software-factory/billing-preview";

export type EmittedInvoice = {
  cliente: string;
  numero: string;
  importe: number;
  horas: number;
  actividadesIds: string[];
  facturaId: string;
};

export type EmissionResult = {
  mes: string;
  facturas: EmittedInvoice[];
  totalImporte: number;
  totalActividadesMarcadas: number;
  notas: string[];
};

export type EmissionInput = {
  /** Tenant cuyas actividades se facturan. */
  clientId: string;
  /** Mes en formato YYYY-MM. Si se omite, usa el mes actual UTC. */
  mes?: string;
  /** Si se indica, solo emite la factura de ese cliente. Si se omite,
   *  emite una factura por cada cliente con horas pendientes. */
  cliente?: string;
};

/**
 * Resuelve el "concepto" que se pone en la factura. Resumen del mes con
 * cantidad total de horas. El operador puede editarlo después si quiere
 * detallar más.
 */
function buildInvoiceConcept(mes: string, totalHoras: number, projectsCount: number): string {
  const partProjects = projectsCount === 1 ? "1 proyecto" : projectsCount + " proyectos";
  const partHoras = totalHoras === 1 ? "1 hora" : totalHoras + " horas";
  return "Servicios " + mes + " — " + partHoras + " · " + partProjects;
}

/**
 * Formatea un importe numérico a string con sufijo " EUR" para que coincida
 * con la convención del campo "importe" del módulo facturacion.
 */
function formatAmountEur(value: number): string {
  return value.toFixed(2) + " EUR";
}

/**
 * Calcula la fecha de vencimiento por defecto: 30 días después de la fecha
 * de emisión (hoy). Esto es estándar B2B en España; el operador puede
 * ajustarla por factura editando el registro.
 */
function defaultDueDateIso(emisionIso: string): string {
  const base = new Date(emisionIso + "T00:00:00Z");
  const due = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

export async function emitMonthlyBilling(input: EmissionInput): Promise<EmissionResult> {
  const cid = String(input.clientId || "").trim();
  if (!cid) {
    throw new Error("emitMonthlyBilling: clientId vacío.");
  }

  const preview = await getMonthlyBillingPreview(cid, input.mes);
  const targetClients = input.cliente
    ? preview.clientes.filter(
        (c) => c.cliente.trim().toLowerCase() === input.cliente!.trim().toLowerCase(),
      )
    : preview.clientes;

  if (targetClients.length === 0) {
    return {
      mes: preview.mes,
      facturas: [],
      totalImporte: 0,
      totalActividadesMarcadas: 0,
      notas: [
        "No hay actividades pendientes de facturar para " + preview.mes +
          (input.cliente ? " del cliente '" + input.cliente + "'" : "") +
          ".",
      ],
    };
  }

  // Cargamos las actividades una sola vez fuera del bucle. Las usaremos
  // para resolver los registros completos al actualizarlos.
  const allActivities = await listModuleRecordsAsync("actividades", cid);
  const activitiesById = new Map<string, Record<string, string>>();
  for (const act of allActivities) {
    if (act?.id) activitiesById.set(String(act.id), act);
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const dueIso = defaultDueDateIso(todayIso);

  const facturas: EmittedInvoice[] = [];
  const notas: string[] = [];
  let totalActividadesMarcadas = 0;

  for (const clientGroup of targetClients) {
    // 1. Reservar número correlativo.
    const allocation = await allocateNextSequenceNumberAsync(cid, "facturas", "FAC");

    // 2. Crear registro en módulo facturacion. NOTA: pasamos el "numero"
    //    explícito para que applySequenceToPayloadAsync lo respete y no
    //    asigne otro número distinto al ya reservado.
    const concept = buildInvoiceConcept(
      preview.mes,
      Math.round(clientGroup.totalHoras * 100) / 100,
      clientGroup.proyectos.length,
    );
    const facturaPayload: Record<string, string> = {
      numero: allocation.formatted,
      cliente: clientGroup.cliente,
      concepto: concept,
      importe: formatAmountEur(clientGroup.totalImporte),
      estado: "emitida",
      fechaEmision: todayIso,
      fechaVencimiento: dueIso,
      notas: "Generada automáticamente desde actividades del mes " + preview.mes + ".",
    };

    const facturaCreated = await createModuleRecordAsync(
      "facturacion",
      facturaPayload,
      cid,
    );

    // 3. Marcar todas las actividades del cliente como facturado=si y
    //    asignarles el número de factura.
    const actividadesIds: string[] = [];
    for (const proj of clientGroup.proyectos) {
      for (const line of proj.actividades) {
        if (!line.id) {
          notas.push(
            "Actividad de " +
              line.fecha +
              " (" +
              line.persona +
              ") sin id — no se pudo marcar como facturada. Revisa manualmente.",
          );
          continue;
        }
        const original = activitiesById.get(line.id);
        if (!original) {
          notas.push(
            "Actividad id=" + line.id + " no encontrada al actualizar — saltada.",
          );
          continue;
        }
        try {
          await updateModuleRecordAsync(
            "actividades",
            line.id,
            {
              ...original,
              facturado: "si",
              facturaNumero: allocation.formatted,
            },
            cid,
          );
          actividadesIds.push(line.id);
          totalActividadesMarcadas += 1;
        } catch (err) {
          notas.push(
            "Error marcando actividad " +
              line.id +
              ": " +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      }
    }

    facturas.push({
      cliente: clientGroup.cliente,
      numero: allocation.formatted,
      importe: Math.round(clientGroup.totalImporte * 100) / 100,
      horas: Math.round(clientGroup.totalHoras * 100) / 100,
      actividadesIds,
      facturaId: String(facturaCreated.id || ""),
    });
  }

  const totalImporte = facturas.reduce((acc, f) => acc + f.importe, 0);

  return {
    mes: preview.mes,
    facturas,
    totalImporte: Math.round(totalImporte * 100) / 100,
    totalActividadesMarcadas,
    notas: [...preview.notas, ...notas],
  };
}
