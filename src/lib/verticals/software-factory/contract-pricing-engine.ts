/**
 * Engine de pricing avanzado con contratos (H8-S6).
 *
 * Aplica sobre cada actividad:
 *   1. Tarifa €/h base = contrato.tarifasPorTipoServicio[tipoServicio]
 *      (fallback: tarifa actividad-catálogo / empleado / default 55)
 *   2. Recargo por urgencia (% del tipo-urgencia)
 *   3. Recargo fuera horario (% del contrato si la tarea cae en
 *      horario nocturno / fin de semana / festivo)
 *
 * Y para desplazamientos: precioFijo + km × precioKm del contrato.
 *
 * Es PURO — no toca BD. Recibe datos planos y devuelve cálculos.
 * El caller (endpoint pre-facturación) los inyecta tras consultar.
 */

export type ContractType = {
  id: string;
  codigo: string;
  nombre: string;
  llamadasPermitidasMes: number;
  precioExcesoLlamada: number;
  cambiosUrgPermitidos: number;
  precioCambioNorUrg: number;
  precioCambioUrgMU: number;
  recargoFueraHorarioPct: number;
  horasContratadas: number;
  periodicidadHoras: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  desplPrecioFijo: number;
  desplPrecioKm: number;
  tarifasPorTipoServicio: Record<string, number>;
};

export type TipoUrgencia = {
  codigo: string;
  nombre: string;
  nivel: number;
  recargoPct: number;
};

export type ActividadInput = {
  tiempoHoras: number;
  tipoServicio: string;
  urgenciaCodigo?: string;
  horaDesde?: string; // HH:MM
  fecha: string; // YYYY-MM-DD
};

const HORA_INICIO_LABORAL = 8;
const HORA_FIN_LABORAL = 19;

function isFueraHorario(act: ActividadInput): boolean {
  // Fin de semana
  const d = new Date(act.fecha);
  if (!isNaN(d.getTime())) {
    const day = d.getDay();
    if (day === 0 || day === 6) return true; // domingo / sábado
  }
  // Hora fuera de 8-19
  if (act.horaDesde) {
    const h = parseInt(act.horaDesde.slice(0, 2), 10);
    if (Number.isFinite(h) && (h < HORA_INICIO_LABORAL || h >= HORA_FIN_LABORAL)) return true;
  }
  return false;
}

export type CalcLinea = {
  tarifaBase: number;
  recargoUrgenciaPct: number;
  recargoHorarioPct: number;
  tarifaFinal: number;
  importe: number;
  fueraHorario: boolean;
};

export function calcularImporteActividad(
  act: ActividadInput,
  contract: ContractType | null,
  tiposUrgencia: TipoUrgencia[],
  fallbackTarifa: number = 55,
): CalcLinea {
  const tarifaBase = contract?.tarifasPorTipoServicio?.[act.tipoServicio] ?? fallbackTarifa;
  const urg = act.urgenciaCodigo ? tiposUrgencia.find((u) => u.codigo === act.urgenciaCodigo) : null;
  const recargoUrgenciaPct = urg?.recargoPct ?? 0;
  const fueraHorario = isFueraHorario(act);
  const recargoHorarioPct = fueraHorario ? (contract?.recargoFueraHorarioPct ?? 0) : 0;
  const tarifaFinal = tarifaBase * (1 + recargoUrgenciaPct / 100) * (1 + recargoHorarioPct / 100);
  const importe = tarifaFinal * act.tiempoHoras;
  return {
    tarifaBase,
    recargoUrgenciaPct,
    recargoHorarioPct,
    tarifaFinal: Math.round(tarifaFinal * 100) / 100,
    importe: Math.round(importe * 100) / 100,
    fueraHorario,
  };
}

export type DesplazamientoInput = {
  kilometros: number;
  precioFijoOverride?: number;
  precioKmOverride?: number;
  facturable: boolean;
};

export function calcularImporteDesplazamiento(d: DesplazamientoInput, contract: ContractType | null): number {
  if (!d.facturable) return 0;
  const fijo = d.precioFijoOverride ?? contract?.desplPrecioFijo ?? 0;
  const km = d.precioKmOverride ?? contract?.desplPrecioKm ?? 0;
  const total = fijo + d.kilometros * km;
  return Math.round(total * 100) / 100;
}
