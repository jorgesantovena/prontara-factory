/**
 * Engine de pre-facturación estilo SISPYME (H7-S2 / H7-S3).
 *
 * TEST-20 F.4 — Pedro: rediseño completo del método de facturación.
 * El método ya NO vive en el Proyecto (campo eliminado); vive en el
 * Cliente como (Modo, Bolsa, Unidad, Margen, Periodo).
 *
 *   Cliente.modoFacturacion = "fijo"     → cuota fija periódica; las
 *                                          tareas consumen contra esa
 *                                          bolsa; el sobreconsumo se
 *                                          factura fuera.
 *   Cliente.modoFacturacion = "variable" → cada hora/€ consumido se
 *                                          factura directamente. La
 *                                          bolsa, si existe, descuenta
 *                                          un anticipo.
 *
 *   Tarea facturable ⇔ Proyecto.facturable === "si"
 *   (Compatibilidad con datos legacy: si la tarea trae el viejo
 *   tipoFacturacion="no-facturable" lo respetamos como "no facturable",
 *   y si trae "contra-bolsa"/"fuera-bolsa" lo respetamos como facturable
 *   aunque el proyecto no esté marcado.)
 *
 * Por cada cliente y periodo:
 *     hPeriodo            = Σ horas de tareas del periodo
 *     hFacturable         = Σ horas de tareas facturables del periodo
 *     hContraCuota        = min(bolsaContratada − gastadasAnteriores, hFacturable)
 *     hFueraBolsa         = hFacturable − hContraCuota
 *     hAFacturar (variable) = hFacturable
 *     hAFacturar (fijo)     = hFueraBolsa
 *     importe                = hAFacturar × tarifa × (1 + margen%)
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
  // Legacy — solo se usa si el proyecto no informa facturable y la tarea
  // viene de datos antiguos. Nueva fuente canónica: proyecto.facturable.
  tipoFacturacion?: "contra-bolsa" | "fuera-bolsa" | "no-facturable" | string;
  proyectoFacturable?: "si" | "no" | string; // resuelto por el caller
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
  // TEST-20 F.4 — Nuevos campos heredados del schema clientes.
  modoFacturacion?: "fijo" | "variable" | string;
  unidadFacturacion?: "h" | "eur" | string;
  margenPorcentaje?: number;
  periodoFacturacion?: "mes" | "trimestre" | "anio" | "discreto" | string;
  vigenciaInicio?: string;
  vigenciaFin?: string;
};

export type LineaPrefactura = {
  cliente: string;
  bolsaConcepto: string;
  bolsaContratada: number;
  modoFacturacion: string;
  unidadFacturacion: string;
  margenPorcentaje: number;
  periodoFacturacion: string;
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
  // TEST-12 #1 — tolerar hh:mm legacy y decimal con coma o punto.
  const s = String(v ?? "0").trim();
  if (s.includes(":")) {
    const [hh = "0", mm = "0"] = s.split(":");
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isFinite(h) && Number.isFinite(m)) return h + m / 60;
    return 0;
  }
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// TEST-20 F.4 — Una tarea es FACTURABLE si el proyecto lo dice. Para
// datos legacy (sin proyectoFacturable resuelto), caemos en el viejo
// tipoFacturacion.
function tareaEsFacturable(a: Actividad): boolean {
  const fproy = String(a.proyectoFacturable || "").toLowerCase();
  if (fproy === "si") return true;
  if (fproy === "no") return false;
  // legacy fallback
  const tf = String(a.tipoFacturacion || "").toLowerCase();
  if (tf === "no-facturable") return false;
  if (tf === "contra-bolsa" || tf === "fuera-bolsa") return true;
  // Sin info: por defecto facturable (la mayoría de tareas SF lo son).
  return true;
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
  let hFacturable = 0;
  let hNoFacturable = 0;

  for (const a of actividades) {
    const h = parseHoras(a.tiempoHoras);
    hPeriodo += h;
    if (tareaEsFacturable(a)) hFacturable += h;
    else hNoFacturable += h;
  }

  // Saldo previo de bolsa: horas facturables de periodos anteriores
  // (gastadas ya contra la bolsa contratada).
  let hGastadasAnteriores = 0;
  let hOtrasFacturadas = 0;
  for (const a of actividadesAnteriores) {
    const h = parseHoras(a.tiempoHoras);
    if (tareaEsFacturable(a)) hGastadasAnteriores += h;
    if (a.estado === "facturada") hOtrasFacturadas += h;
  }

  // Bolsa restante antes de aplicar el periodo.
  const saldoAntes = Math.max(0, bolsa.bolsaContratadaHoras - hGastadasAnteriores);

  // Horas del periodo que caben en la bolsa restante vs las que se
  // facturan fuera.
  const hContraCuota = Math.min(saldoAntes, hFacturable);
  const hFueraBolsa = Math.max(0, hFacturable - hContraCuota);
  const saldoFinal = Math.max(0, saldoAntes - hFacturable);

  // TEST-20 F.4 — Cálculo del importe según Modo:
  //   - fijo:     se factura solo lo que excede la bolsa (la cuota
  //               periódica ya cobra "lo que cabe dentro").
  //   - variable: se factura todo lo facturable, independientemente
  //               de la bolsa (la bolsa es un anticipo separado).
  const modo = String(bolsa.modoFacturacion || "fijo").toLowerCase();
  const hAFacturar = modo === "variable" ? hFacturable : hFueraBolsa;
  const margen = Number(bolsa.margenPorcentaje || 0);
  const factor = 1 + (Number.isFinite(margen) ? margen : 0) / 100;
  const importe = hAFacturar * bolsa.tarifaHora * factor;

  return {
    cliente: bolsa.cliente,
    bolsaConcepto: bolsa.bolsaConcepto,
    bolsaContratada: bolsa.bolsaContratadaHoras,
    modoFacturacion: modo,
    unidadFacturacion: String(bolsa.unidadFacturacion || "h"),
    margenPorcentaje: Number.isFinite(margen) ? margen : 0,
    periodoFacturacion: String(bolsa.periodoFacturacion || "mes"),
    hPeriodo,
    hFacturable,
    hContraCuota,
    hFueraBolsa,
    hNoFacturable,
    hGastadasAnteriores,
    hImputadasCliente: hFacturable + hNoFacturable,
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
