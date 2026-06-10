/**
 * Engine de pre-facturación — TEST 19 (Pedro).
 *
 * El proceso se ejecuta para una combinación (Modelo, Periodo) elegida
 * en un diálogo previo (UI). Devuelve una línea por Contrato a
 * facturar. Hay dos casos:
 *
 *   Caso A — Cuotas / Tarifa plana / Bonos
 *     Parámetros: Modelo=Cuota, Periodo=cualquiera.
 *     Selección: contratos con `periodo` indicado y Tipo Nivel
 *                cualquiera (M/A/B).
 *     Cálculo:   busca el Nivel (tipoNivel, subtipo, modelo=Cuota).
 *                Importe = Precio (el Precio del Nivel Cuota es el importe
 *                de la cuota del periodo — Test 19 bis G).
 *
 *   Caso B — Excesos sobre cuota de mantenimiento
 *     Parámetros: Modelo=Horas, Periodo=Mensual.
 *     Selección: contratos con periodo Mensual + Tipo Nivel = M.
 *     Cálculo:   recupera Consumo y Facturadas del contrato.
 *                Busca el Nivel (tipoNivel=M, mismo subtipo,
 *                modelo=Horas) → Bolsa, Precio.
 *                Importe = max(0, Consumo − Bolsa − Facturadas) × Precio.
 *
 * La key de Nivel es (tipoNivel, subtipo, modelo). Hay típicamente
 * dos rows por subtipo M (una Cuota, una Horas).
 *
 * Compatibilidad: este engine ya NO mantiene la firma antigua basada
 * en (Actividad, BolsaCliente). Los call sites (route /api/erp/
 * prefacturacion y /api/erp/detalle-servicios-pdf) se han actualizado.
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
  // Legacy — solo se usa si el proyecto no informa facturable.
  tipoFacturacion?: string;
  proyectoFacturable?: "si" | "no" | string;
  proyectoContrato?: string;
  estado: string;
  descripcion?: string;
  horaDesde?: string;
  horaHasta?: string;
  lugar?: string;
};

export type Contrato = {
  id: string;
  codigo: string;
  cliente: string;
  periodo: "mensual" | "trimestral" | "semestral" | "anual" | "discreto" | string;
  tipoNivel: "M" | "A" | "B" | string;
  subtipo: string;
  consumo: number;
  facturadas: number;
  referenciaPropuesta?: string;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
};

export type Nivel = {
  tipoNivel: "M" | "A" | "B" | string;
  subtipo: string;
  modelo: "cuota" | "horas" | string;
  bolsa: number;
  precio: number;
  descripcion?: string;
};

export type LineaPrefactura = {
  caso: "A" | "B";
  contrato: string;
  cliente: string;
  tipoNivel: string;
  subtipo: string;
  periodo: string;
  modelo: "cuota" | "horas";
  bolsa: number;
  precio: number;
  consumo: number;
  facturadas: number;
  horasAFacturar: number; // para Caso A: bolsa. Para Caso B: max(0, consumo-bolsa-facturadas)
  importe: number;
  notas: string;
};

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
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

/**
 * Resuelve un Nivel por su clave compuesta (tipoNivel, subtipo, modelo).
 * Devuelve undefined si no existe (el caller debe decidir si saltar la
 * línea o emitirla con importe 0).
 */
export function findNivel(
  niveles: Nivel[],
  tipoNivel: string,
  subtipo: string,
  modelo: "cuota" | "horas",
): Nivel | undefined {
  return niveles.find(
    (n) =>
      String(n.tipoNivel).toUpperCase() === String(tipoNivel).toUpperCase() &&
      String(n.subtipo) === String(subtipo) &&
      String(n.modelo).toLowerCase() === modelo,
  );
}

/**
 * Caso A — Importe = Bolsa × Precio del Nivel (tipo, subtipo, Cuota).
 */
export function calcularCasoA(contrato: Contrato, niveles: Nivel[]): LineaPrefactura | null {
  const nivel = findNivel(niveles, contrato.tipoNivel, contrato.subtipo, "cuota");
  if (!nivel) {
    // Sin Nivel Cuota definido → no se emite cuota.
    return null;
  }
  const bolsa = parseNum(nivel.bolsa);
  const precio = parseNum(nivel.precio);
  // Test 19 bis G — Caso A: Importe = Precio. El Precio del Nivel Cuota ES
  // el importe de la cuota del periodo (antes era Bolsa × Precio, que
  // inflaba la cuota cuando bolsa>1).
  const importe = precio;
  return {
    caso: "A",
    contrato: contrato.codigo,
    cliente: contrato.cliente,
    tipoNivel: contrato.tipoNivel,
    subtipo: contrato.subtipo,
    periodo: contrato.periodo,
    modelo: "cuota",
    bolsa,
    precio,
    consumo: parseNum(contrato.consumo),
    facturadas: parseNum(contrato.facturadas),
    horasAFacturar: bolsa,
    importe,
    notas: "Cuota " + contrato.periodo + " = " + precio + "€",
  };
}

/**
 * Caso B — Importe = max(0, Consumo − Bolsa − Facturadas) × Precio
 * del Nivel (M, mismo subtipo, Horas). Solo contratos Tipo M.
 */
export function calcularCasoB(contrato: Contrato, niveles: Nivel[]): LineaPrefactura | null {
  if (String(contrato.tipoNivel).toUpperCase() !== "M") return null;
  const nivelHoras = findNivel(niveles, "M", contrato.subtipo, "horas");
  if (!nivelHoras) {
    // Sin Nivel Horas asociado al Tipo M Subtipo X → no podemos
    // calcular el precio del exceso.
    return null;
  }
  const consumo = parseNum(contrato.consumo);
  const facturadas = parseNum(contrato.facturadas);
  const bolsaHoras = parseNum(nivelHoras.bolsa);
  const precio = parseNum(nivelHoras.precio);
  const exceso = consumo - bolsaHoras - facturadas;
  if (exceso <= 0) return null; // sin exceso → no se emite línea
  const importe = exceso * precio;
  return {
    caso: "B",
    contrato: contrato.codigo,
    cliente: contrato.cliente,
    tipoNivel: contrato.tipoNivel,
    subtipo: contrato.subtipo,
    periodo: contrato.periodo,
    modelo: "horas",
    bolsa: bolsaHoras,
    precio,
    consumo,
    facturadas,
    horasAFacturar: exceso,
    importe,
    notas: "Exceso " + exceso.toFixed(2) + "h × " + precio + "€",
  };
}

/**
 * Pre-facturación combinada: aplica el caso A o B según el modelo
 * elegido, sobre los contratos que cumplen los filtros (periodo, y
 * para el caso B también Tipo Nivel = M).
 */
export function prefacturar(
  contratos: Contrato[],
  niveles: Nivel[],
  modelo: "cuota" | "horas",
  periodo: string,
): LineaPrefactura[] {
  const elegibles = contratos.filter((c) => {
    const estado = String(c.estado || "").toLowerCase();
    if (estado === "cancelado") return false;
    if (estado === "finalizado") return false;
    // Un contrato en borrador (aún no aprobado) no debe pre-facturarse:
    // generaba una cuota a cobrar de algo no firmado.
    if (estado === "borrador") return false;
    if (String(c.periodo) !== periodo) return false;
    if (modelo === "horas" && String(c.tipoNivel).toUpperCase() !== "M") return false;
    return true;
  });
  const calc = modelo === "cuota" ? calcularCasoA : calcularCasoB;
  return elegibles
    .map((c) => calc(c, niveles))
    .filter((x): x is LineaPrefactura => x != null);
}

// === Compat con el PDF Detalle Servicios (sigue agrupando por tipoServicio) ===

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
 * Filtra actividades por contrato + año. Útil para el PDF y para el
 * trigger de reset anual.
 */
export function filtrarPorContratoAnio(actividades: Actividad[], contrato: string, anio: number): Actividad[] {
  return actividades.filter((a) => {
    const cRef = String(a.contrato || a.proyectoContrato || "");
    if (cRef !== contrato) return false;
    const y = parseInt(String(a.fecha).slice(0, 4), 10);
    return y === anio;
  });
}
