/**
 * Engine de pre-facturación estilo SISPYME (H7-S2 / H7-S3).
 *
 * Facturación.pptx (Pedro) — Rediseño completo del modelo:
 *
 *   El método de facturación vive en el CONTRATO (no en el cliente).
 *   Un cliente puede tener varios contratos a la vez.
 *
 *   Modelos de contrato:
 *
 *     - "cuota" (Mantenimiento o Tarifa Plana, niveles 1..4 o A):
 *         Importe periódico = 1 × precio (cuota fija).
 *         Si bolsa > 0, las horas hasta bolsa están cubiertas; el
 *         exceso se factura como "Excesos" (línea aparte) con la
 *         misma tarifa €/h asociada al nivel.
 *
 *     - "horas" (variable por consumo, niveles 1..4):
 *         Importe periódico = horas consumidas × precio (€/h).
 *
 *     - "bono" (Bono puntual, nivel B, periodo "discreto"):
 *         Importe = bolsa × precio (UN único disparo al activar el
 *         bono; no se factura periódicamente).
 *
 *   Las TAREAS suman al consumo del contrato heredado vía
 *   proyecto.contrato (si proyecto.facturable === "si"). Las FACTURAS
 *   suman al facturado del contrato referenciado por factura.contrato.
 *
 * Una línea de prefactura por contrato + (si aplica) una línea de
 * "exceso" por contrato cuota con sobreconsumo.
 */

export type Actividad = {
  id: string;
  fecha: string; // YYYY-MM-DD
  cliente: string;
  proyecto?: string;
  contrato?: string;
  empleado?: string;
  actividad?: string;
  tipoServicio?: string;
  tiempoHoras: number;
  // Legacy — solo se usa si el proyecto no informa facturable y la tarea
  // viene de datos antiguos. Nueva fuente canónica: proyecto.facturable.
  tipoFacturacion?: "contra-bolsa" | "fuera-bolsa" | "no-facturable" | string;
  proyectoFacturable?: "si" | "no" | string; // resuelto por el caller
  proyectoContrato?: string; // resuelto por el caller (proyecto.contrato)
  estado: string;
  descripcion?: string;
  horaDesde?: string;
  horaHasta?: string;
  lugar?: string;
};

export type Contrato = {
  id: string;
  numero: string;
  cliente: string;
  nivel: string;
  modelo: "cuota" | "horas" | "bono" | string;
  periodo: "mensual" | "trimestral" | "semestral" | "anual" | "discreto" | string;
  bolsaHoras: number;
  precio: number;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
};

export type LineaPrefactura = {
  cliente: string;
  contrato: string;
  nivel: string;
  modelo: string;
  periodo: string;
  bolsaContratada: number;
  hPeriodo: number;
  hFacturable: number;
  hCubiertasPorCuota: number; // horas dentro de la bolsa (modelo cuota)
  hExceso: number; // horas sobre la bolsa (modelo cuota → línea aparte)
  hGastadasAnteriores: number;
  hImputadasCliente: number;
  hOtrasFacturadas: number;
  saldoBolsa: number;
  hAFacturar: number;
  tarifaHora: number; // precio del contrato
  importe: number; // total de la línea
  importeExceso: number;
  // Campos de compat con UI vieja (alias) — se mantienen para no
  // romper bindings.
  bolsaConcepto: string;
  hContraCuota: number;
  hFueraBolsa: number;
  hNoFacturable: number;
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

// Facturación.pptx — Una tarea es FACTURABLE si el proyecto lo dice.
// Compatibilidad con datos legacy: si no hay proyectoFacturable
// resuelto, miramos tipoFacturacion de la tarea (modelo viejo). Si
// nada está informado, asumimos facturable (default optimista).
export function tareaEsFacturable(a: Actividad): boolean {
  const fproy = String(a.proyectoFacturable || "").toLowerCase();
  if (fproy === "si") return true;
  if (fproy === "no") return false;
  const tf = String(a.tipoFacturacion || "").toLowerCase();
  if (tf === "no-facturable") return false;
  if (tf === "contra-bolsa" || tf === "fuera-bolsa") return true;
  return true;
}

/**
 * Calcula la línea de pre-facturación de un contrato para un periodo.
 *
 * @param actividades — tareas del periodo que tributan a este contrato
 *                     (filtradas previamente por contrato + fecha)
 * @param contrato — datos del contrato (modelo, periodo, bolsa, precio)
 * @param actividadesAnteriores — tareas del mismo contrato en periodos
 *                                anteriores (para saldo previo de bolsa)
 */
export function calcularPrefactura(
  actividades: Actividad[],
  contrato: Contrato,
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

  // Saldo previo de bolsa (cuántas horas facturables ya consumidas
  // antes del periodo cuentan contra la bolsa).
  let hGastadasAnteriores = 0;
  let hOtrasFacturadas = 0;
  for (const a of actividadesAnteriores) {
    const h = parseHoras(a.tiempoHoras);
    if (tareaEsFacturable(a)) hGastadasAnteriores += h;
    if (a.estado === "facturada") hOtrasFacturadas += h;
  }

  const bolsa = contrato.bolsaHoras;
  const saldoAntes = Math.max(0, bolsa - hGastadasAnteriores);
  const hCubiertasPorCuota = Math.min(saldoAntes, hFacturable);
  const hExceso = Math.max(0, hFacturable - hCubiertasPorCuota);
  const saldoFinal = Math.max(0, saldoAntes - hFacturable);

  const modelo = String(contrato.modelo || "cuota").toLowerCase();
  const precio = Number(contrato.precio) || 0;

  // Cálculo del importe según modelo Pedro:
  //   - Cuota: 1 × precio (cuota periódica). El exceso se reporta
  //            aparte como `importeExceso` (línea adicional).
  //   - Horas: horas facturables × precio (€/h).
  //   - Bono:  bolsa × precio (UN disparo al activar el bono; no
  //            periódico). Aquí devolvemos siempre el importe del
  //            bono — el caller decide si emitirlo o no según
  //            estado del contrato.
  let hAFacturar = 0;
  let importe = 0;
  let importeExceso = 0;
  if (modelo === "cuota") {
    hAFacturar = 0; // la cuota no factura horas, factura "1 cuota"
    importe = 1 * precio;
    // Exceso: si hay sobreconsumo, se factura como horas extra a
    // tarifa precio €/h (Pedro: "Importe = Horas-Bolsa-Facturadas x Precio").
    importeExceso = hExceso * precio;
  } else if (modelo === "horas") {
    hAFacturar = hFacturable;
    importe = hFacturable * precio;
  } else if (modelo === "bono") {
    hAFacturar = bolsa;
    importe = bolsa * precio;
  }

  return {
    cliente: contrato.cliente,
    contrato: contrato.numero || contrato.id,
    nivel: contrato.nivel,
    modelo,
    periodo: String(contrato.periodo || "mensual"),
    bolsaContratada: bolsa,
    hPeriodo,
    hFacturable,
    hCubiertasPorCuota,
    hExceso,
    hGastadasAnteriores,
    hImputadasCliente: hFacturable + hNoFacturable,
    hOtrasFacturadas,
    saldoBolsa: saldoFinal,
    hAFacturar,
    tarifaHora: precio,
    importe,
    importeExceso,
    bolsaConcepto: bolsa > 0 ? "Bolsa " + String(bolsa) + "h" : "Sin bolsa",
    hContraCuota: hCubiertasPorCuota, // alias compat con UI vieja
    hFueraBolsa: hExceso, // alias compat
    hNoFacturable,
    tareasIncluidas: actividades.length,
    estado: actividades.every((a) => a.estado === "facturada") ? "facturada" : actividades.some((a) => a.estado === "validada") ? "prefacturada" : "pendiente",
  };
}

/**
 * Filtra actividades por CONTRATO + periodo (YYYY-MM). El "contrato"
 * de una tarea es tarea.contrato (heredado) o, si vacío, el
 * proyectoContrato resuelto por el caller.
 */
export function filtrarPorContratoPeriodo(actividades: Actividad[], contrato: string, periodoYYYYMM: string): Actividad[] {
  return actividades.filter((a) => {
    const cRef = String(a.contrato || a.proyectoContrato || "");
    if (cRef !== contrato) return false;
    return String(a.fecha).slice(0, 7) === periodoYYYYMM;
  });
}

export function actividadesAnterioresAlPeriodoContrato(actividades: Actividad[], contrato: string, periodoYYYYMM: string): Actividad[] {
  return actividades.filter((a) => {
    const cRef = String(a.contrato || a.proyectoContrato || "");
    return cRef === contrato && String(a.fecha).slice(0, 7) < periodoYYYYMM;
  });
}

// Compat con consumidores antiguos por cliente — los mantenemos por
// si alguien los importa, pero ya no se usan en el flujo nuevo.
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
  for (const arr of m.values()) {
    arr.sort((a, b) => {
      const f = String(a.fecha).localeCompare(String(b.fecha));
      if (f !== 0) return f;
      return String(a.horaDesde || "").localeCompare(String(b.horaDesde || ""));
    });
  }
  return m;
}

// Type alias para back-compat con consumidores que aún importan
// `BolsaCliente` (PDF detalle-servicios route, bolsa-saldo legacy):
// ahora el contenedor de la bolsa es el Contrato.
export type BolsaCliente = Contrato & {
  cliente: string;
  bolsaContratadaHoras: number; // alias compat
  bolsaConcepto: string;
  tarifaHora: number;
  modoFacturacion?: string;
  unidadFacturacion?: string;
  margenPorcentaje?: number;
  periodoFacturacion?: string;
};
