/**
 * Engine de pre-facturación estilo SISPYME (H7-S2 / H7-S3).
 *
 * Replica el cálculo del informe "Servicios Facturables" de Velneo
 * Control Diario:
 *
 *   Por cada cliente y periodo:
 *     hPeriodo            = Σ tareas del periodo
 *     hFacturable         = Σ tareas con tipoFacturacion in (contra-bolsa, fuera-bolsa)
 *     hContraCuota        = Σ tareas tipoFacturacion=contra-bolsa
 *     hGastadasAnteriores = saldo bolsa antes del periodo
 *     hImputadasCliente   = total imputado al cliente del periodo
 *     hOtrasFacturadas    = ya facturadas en otros periodos
 *     hAFacturar          = max(0, hContraCuota + hGastadasAnteriores - bolsaContratada) + hFueraBolsa
 *     importe             = hAFacturar × tarifa
 *
 * Estado prefactura: Pendiente | Prefacturada | Facturada
 */

export type Actividad = {
  id: string;
  fecha: string; // YYYY-MM-DD
  cliente: string;
  proyecto?: string;
  empleado?: string;
  actividad?: string;
  tipoServicio?: string;
  tiempoHoras: number;
  tipoFacturacion: "contra-bolsa" | "fuera-bolsa" | "no-facturable";
  estado: string;
  descripcion?: string;
  horaDesde?: string;
  horaHasta?: string;
  lugar?: string;
};

export type BolsaCliente = {
  cliente: string;
  bolsaContratadaHoras: number;
  bolsaConcepto: string; // "Mant. Nivel 1", "Soporte 30h/año"...
  tarifaHora: number;
  vigenciaInicio?: string;
  vigenciaFin?: string;
};

export type LineaPrefactura = {
  cliente: string;
  bolsaConcepto: string;
  bolsaContratada: number;
  hPeriodo: number;
  hFacturable: number;
  hContraCuota: number;
  hFueraBolsa: number;
  hNoFacturable: number;
  hGastadasAnteriores: number;
  hImputadasCliente: number;
  hOtrasFacturadas: number;
  saldo: number;
  hAFacturar: number;
  tarifaHora: number;
  importe: number;
  tareasIncluidas: number;
  estado: "pendiente" | "prefacturada" | "facturada";
};

function parseHoras(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calcula la línea de pre-facturación de un cliente para un periodo.
 *
 * @param actividades — tareas del periodo (filtradas previamente por fecha y cliente)
 * @param bolsa — datos de la bolsa de horas contratada del cliente
 * @param actividadesAnteriores — tareas del cliente en periodos anteriores (para calcular saldo previo y otras facturadas)
 */
export function calcularPrefactura(
  actividades: Actividad[],
  bolsa: BolsaCliente,
  actividadesAnteriores: Actividad[] = [],
): LineaPrefactura {
  let hPeriodo = 0;
  let hContraCuota = 0;
  let hFueraBolsa = 0;
  let hNoFacturable = 0;

  for (const a of actividades) {
    const h = parseHoras(a.tiempoHoras);
    hPeriodo += h;
    if (a.tipoFacturacion === "contra-bolsa") hContraCuota += h;
    else if (a.tipoFacturacion === "fuera-bolsa") hFueraBolsa += h;
    else hNoFacturable += h;
  }

  const hFacturable = hContraCuota + hFueraBolsa;

  // Saldo previo: horas contra-bolsa de periodos anteriores
  let hGastadasAnteriores = 0;
  let hOtrasFacturadas = 0;
  for (const a of actividadesAnteriores) {
    const h = parseHoras(a.tiempoHoras);
    if (a.tipoFacturacion === "contra-bolsa") hGastadasAnteriores += h;
    if (a.estado === "facturada") hOtrasFacturadas += h;
  }

  // Saldo de bolsa = contratadas − ya gastadas anteriormente − contra-cuota del periodo
  const saldoAntes = bolsa.bolsaContratadaHoras - hGastadasAnteriores;
  const sobreconsumoCuota = Math.max(0, hContraCuota - saldoAntes);
  const saldoFinal = Math.max(0, saldoAntes - hContraCuota);

  // hAFacturar = sobreconsumo de bolsa + horas fuera-bolsa
  const hAFacturar = sobreconsumoCuota + hFueraBolsa;
  const importe = hAFacturar * bolsa.tarifaHora;

  return {
    cliente: bolsa.cliente,
    bolsaConcepto: bolsa.bolsaConcepto,
    bolsaContratada: bolsa.bolsaContratadaHoras,
    hPeriodo,
    hFacturable,
    hContraCuota,
    hFueraBolsa,
    hNoFacturable,
    hGastadasAnteriores,
    hImputadasCliente: hContraCuota + hFueraBolsa + hNoFacturable,
    hOtrasFacturadas,
    saldo: saldoFinal,
    hAFacturar,
    tarifaHora: bolsa.tarifaHora,
    importe,
    tareasIncluidas: actividades.length,
    estado: actividades.every((a) => a.estado === "facturada") ? "facturada" : actividades.some((a) => a.estado === "validada") ? "prefacturada" : "pendiente",
  };
}

/**
 * Filtra actividades por cliente + periodo (YYYY-MM o rango).
 */
export function filtrarPorClientePeriodo(actividades: Actividad[], cliente: string, periodoYYYYMM: string): Actividad[] {
  return actividades.filter((a) => {
    if (a.cliente !== cliente) return false;
    return String(a.fecha).slice(0, 7) === periodoYYYYMM;
  });
}

export function actividadesAnterioresAlPeriodo(actividades: Actividad[], cliente: string, periodoYYYYMM: string): Actividad[] {
  return actividades.filter((a) => a.cliente === cliente && String(a.fecha).slice(0, 7) < periodoYYYYMM);
}

/**
 * Agrupa actividades por TipoServicio (para el PDF de detalle estilo SISPYME).
 */
export function agruparPorTipoServicio(actividades: Actividad[]): Map<string, Actividad[]> {
  const m = new Map<string, Actividad[]>();
  for (const a of actividades) {
    const key = a.tipoServicio || "Otros servicios";
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(a);
  }
  // Ordenar tareas dentro de cada grupo por fecha + horaDesde
  for (const arr of m.values()) {
    arr.sort((a, b) => {
      const f = String(a.fecha).localeCompare(String(b.fecha));
      if (f !== 0) return f;
      return String(a.horaDesde || "").localeCompare(String(b.horaDesde || ""));
    });
  }
  return m;
}
