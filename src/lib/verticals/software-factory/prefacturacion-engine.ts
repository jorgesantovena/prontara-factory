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
 *     Parámetros: Modelo=Horas, Periodo=cualquiera (Pedro 21-06).
 *     Selección: contratos con el periodo indicado + Tipo Nivel = M.
 *     Cálculo:   Consumo = contador EN VIVO del contrato, que un trigger
 *                incrementa con las horas de CADA Tarea al darla de alta
 *                (no se teclea, no se recalcula por ventana). Bolsa = horas
 *                del Bono (independiente del periodo). Facturadas = contador
 *                del contrato (sube cuando una factura de excesos pasa a
 *                Definitiva). Importe = max(0, Consumo − Bolsa − Facturadas)
 *                × Precio, repartido por proyecto del más caro al más barato.
 *                Para el DETALLE, los proyectos/horas se toman de las Tareas
 *                de la ventana del periodo (N meses; "discreto" sin acotar).
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
  // Test 19 bis A/G — Servicio: solo en Niveles Modelo=Horas. Permite un
  // precio del exceso por servicio (Caso B desglosado).
  servicio?: string;
  // Test 23 — Aplicación: solo en Niveles Tipo E (mantenimiento contra
  // errores). El Valor es el coste anual/cuota por aplicación.
  aplicacion?: string;
  descripcion?: string;
};

// Test 23 — Registro de la tabla A/C (Aplicaciones/Contrato).
export type AplicacionContrato = { contrato?: string; aplicacion?: string; codigo?: string };

// Test 19 bis G / Test 21 — Línea de desglose del Caso B. Test 21: el
// reparto es POR PROYECTO; cada proyecto se factura al precio de su Servicio.
export type DesgloseServicio = {
  servicio: string;
  proyecto?: string;
  horas: number;
  precio: number;
  importe: number;
};

// Test 19 bis G — Opciones del proceso: mes a facturar + tareas/proyectos
// para el desglose por servicio del Caso B.
export type ProyectoLite = { nombre?: string; id?: string; contrato?: string; codigoTipo?: string; facturable?: string };
export type PrefacturaOpts = {
  fecha?: string; // "YYYY-MM"
  // Pedro 21-06 — Periodo del proceso. Acota la ventana de Tareas del Caso B
  // (N meses hacia atrás terminando en `fecha`). Lo inyecta `prefacturar`.
  periodo?: string;
  actividades?: Actividad[];
  proyectos?: ProyectoLite[];
  // Test 23 — Aplicaciones/Contrato para la cuota trimestral de Mantº Errores.
  aplicacionesContrato?: AplicacionContrato[];
  // Test 25 — Desplazamientos para el modelo "desplazamiento".
  desplazamientos?: DesplazamientoLite[];
};

// Test 25 — Desplazamiento (para la pre-facturación por kilómetros).
export type DesplazamientoLite = {
  fecha?: string; // YYYY-MM-DD
  cliente?: string; // Punto = cliente
  kilometros?: number;
  importeTotal?: number; // Total Venta (Km × Precio Venta)
  facturable?: string;
  estado?: string;
};

export type LineaPrefactura = {
  caso: "A" | "B" | "D";
  contrato: string;
  cliente: string;
  tipoNivel: string;
  subtipo: string;
  periodo: string;
  modelo: "cuota" | "horas" | "desplazamiento";
  bolsa: number;
  precio: number;
  consumo: number;
  facturadas: number;
  horasAFacturar: number; // Caso A: bolsa. Caso B: exceso. Desplazamiento: Total Km.
  importe: number;
  // Test 19 bis G — Desglose del exceso por servicio (Caso B), si hay
  // Niveles Horas por servicio y tareas del mes. Vacío en el caso plano.
  desglose?: DesgloseServicio[];
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

// Pedro 21-06 — Ventana de meses hacia atrás según el periodo. La selección de
// Tareas (Caso B) y de Desplazamientos abarca `MESES_PERIODO` meses terminando
// en `fecha` (YYYY-MM). "Discreto" no acota por tiempo (se factura por
// agotamiento de bolsa o por acuerdo puntual, no por tramos de tiempo).
const MESES_PERIODO: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12, discreto: 1 };
function ymToNum(ym: string): number { const [y, m] = String(ym).split("-").map(Number); return (y || 0) * 12 + ((m || 1) - 1); }
function enVentanaPeriodo(fechaRegistro: string, periodo: string, fecha?: string): boolean {
  if (String(periodo) === "discreto") return true; // sin acotación temporal
  if (!fecha) return true; // sin mes de referencia: no se filtra por ventana
  const ym = String(fechaRegistro || "").slice(0, 7);
  if (!ym) return false;
  const end = ymToNum(fecha);
  const start = end - ((MESES_PERIODO[String(periodo)] || 1) - 1);
  const num = ymToNum(ym);
  return num >= start && num <= end;
}
// Pedro 21-06 (P7) — Fracción de un coste ANUAL que corresponde a un periodo.
// El Mantº contra errores (Tipo E) tiene un Valor anual por aplicación que se
// "periodifica al facturar": mensual=1/12, trimestral=3/12, semestral=6/12,
// anual=1. "Discreto" no es periódico → se factura el coste íntegro acordado.
function factorPeriodo(periodo: string): number {
  if (String(periodo) === "discreto") return 1;
  const m = MESES_PERIODO[String(periodo)];
  return (m ? m : 12) / 12;
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
 * Test 19 bis 2 — Horas del Bono del contrato. Pedro movió la Bolsa de
 * Niveles a un Nivel Tipo B: el contrato apunta a él con `subtipoBono`, y
 * el Valor (campo `precio`) de ese Nivel B Horas son las horas del bono.
 * Devuelve null si el contrato no tiene bono o el Nivel B no existe — el
 * caller decide el fallback (legacy: Bolsa del Nivel M Horas).
 */
function bonoHoras(contrato: Contrato, niveles: Nivel[]): number | null {
  // Test 21 — El campo Bono del contrato se eliminó: el Nivel Tipo B se
  // identifica por el MISMO subtipo del contrato. Si existe un Nivel
  // (B, subtipo, Horas), su Valor son las horas de la bolsa.
  const sb = String(contrato.subtipo || "").trim();
  if (!sb) return null;
  const b = niveles.find(
    (n) =>
      String(n.tipoNivel).toUpperCase() === "B" &&
      String(n.subtipo) === sb &&
      String(n.modelo).toLowerCase() === "horas",
  );
  return b ? parseNum(b.precio) : null;
}

/**
 * Caso A — Cuota. Pedro 21-06: el Valor del Nivel Cuota es SIEMPRE un importe
 * ANUAL; el importe a facturar es ese Valor PERIODIFICADO por la fracción del
 * periodo del contrato (mensual=1/12, trimestral=1/4, semestral=1/2, anual=1,
 * discreto=íntegro). Generaliza el criterio del Tipo E a todas las cuotas.
 */
export function calcularCasoA(contrato: Contrato, niveles: Nivel[]): LineaPrefactura | null {
  // Pedro 21-06 (P7) — Los contratos Tipo E (Mantº contra errores) NO generan
  // una cuota genérica: se facturan por aplicación en calcularMantErrores
  // (periodificado). Si no se saltaran, findNivel(E, subtipo, cuota) cogería
  // un Nivel E arbitrario y duplicaría el cobro.
  if (String(contrato.tipoNivel).toUpperCase() === "E") return null;
  const nivel = findNivel(niveles, contrato.tipoNivel, contrato.subtipo, "cuota");
  if (!nivel) {
    // Sin Nivel Cuota definido → no se emite cuota.
    return null;
  }
  const valorAnual = parseNum(nivel.precio); // Valor del Nivel Cuota = importe ANUAL
  const factor = factorPeriodo(contrato.periodo);
  const importe = Math.round(valorAnual * factor * 100) / 100; // periodificado
  return {
    caso: "A",
    contrato: contrato.codigo,
    cliente: contrato.cliente,
    tipoNivel: contrato.tipoNivel,
    subtipo: contrato.subtipo,
    periodo: contrato.periodo,
    modelo: "cuota",
    bolsa: 1,
    precio: importe,
    consumo: parseNum(contrato.consumo),
    facturadas: parseNum(contrato.facturadas),
    horasAFacturar: 1,
    importe,
    notas: "Cuota " + contrato.periodo + " = " + valorAnual + "€/año × " + factor.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + " = " + importe + "€",
  };
}

/**
 * Caso B — Importe = max(0, Consumo − Bolsa − Facturadas) × Precio
 * del Nivel (M, mismo subtipo, Horas). Solo contratos Tipo M.
 */
export function calcularCasoB(contrato: Contrato, niveles: Nivel[], opts?: PrefacturaOpts): LineaPrefactura | null {
  if (String(contrato.tipoNivel).toUpperCase() !== "M") return null;
  // Nivel Horas "base" (sin servicio): define la Bolsa y el precio de
  // fallback. Si todos los Horas llevan servicio, cae al primer match.
  const sub = String(contrato.subtipo);
  const nivelBase =
    niveles.find((n) => String(n.tipoNivel).toUpperCase() === "M" && String(n.subtipo) === sub && String(n.modelo).toLowerCase() === "horas" && !String(n.servicio || "").trim()) ||
    findNivel(niveles, "M", sub, "horas");
  if (!nivelBase) return null;

  const facturadas = parseNum(contrato.facturadas);
  // Test 19 bis 2 — Bolsa = horas del Bono (Nivel Tipo B referenciado por el
  // contrato). Fallback legacy: la Bolsa del Nivel M Horas (datos anteriores
  // a bis-2, donde la Bolsa vivía en el propio Nivel). Pedro 21-06 (C): la
  // bolsa es INDEPENDIENTE del periodo (no se multiplica por los meses).
  const bolsaHoras = bonoHoras(contrato, niveles) ?? parseNum(nivelBase.bolsa);

  // Niveles Horas POR SERVICIO de este subtipo (si los hay): cada proyecto se
  // factura al precio de su servicio. Si no hay, todos al precio base.
  const nivelesServicio = niveles.filter((n) =>
    String(n.tipoNivel).toUpperCase() === "M" && String(n.subtipo) === sub &&
    String(n.modelo).toLowerCase() === "horas" && String(n.servicio || "").trim());

  // Pedro 21-06 (b + apunte) — Consumo AUTOMÁTICO pero como CONTADOR EN VIVO:
  // lo mantiene un trigger que suma las horas de CADA Tarea en el momento de
  // darla de alta (acumulaPorTarea / api module route). El motor lo LEE del
  // campo del contrato, no lo recalcula por ventana. El exceso (Consumo −
  // Bolsa − Facturadas) es por tanto acumulativo, no periódico.
  const consumo = parseNum(contrato.consumo);
  const HF = consumo - bolsaHoras - facturadas; // Horas a Facturar (exceso)
  if (HF <= 0) return null; // sin exceso → no se emite línea

  // El reparto del exceso es POR PROYECTO (Test 21), del más caro al más
  // barato. Para el DETALLE de la factura, los proyectos/horas se toman de
  // las Tareas dentro de la VENTANA del periodo (Pedro #4: N meses hacia
  // atrás; "discreto" no acota). El exceso a repartir sigue siendo HF.
  const periodo = String(opts?.periodo || contrato.periodo || "mensual");
  let horasPorProyecto: Array<{ proyecto: string; servicio: string; horas: number; precio: number }> = [];
  const servPorProyecto = new Map<string, string>();
  if (opts?.proyectos) {
    for (const p of opts.proyectos) {
      if (String(p.contrato || "") !== contrato.codigo) continue;
      const serv = String(p.codigoTipo || "");
      if (p.nombre) servPorProyecto.set(String(p.nombre), serv);
      if (p.id) servPorProyecto.set(String(p.id), serv);
    }
  }
  if (opts?.actividades && servPorProyecto.size > 0) {
    const acc = new Map<string, number>();
    for (const t of opts.actividades) {
      const proy = String(t.proyecto || "");
      if (!servPorProyecto.has(proy)) continue; // la tarea no es de este contrato
      if (!enVentanaPeriodo(String(t.fecha || ""), periodo, opts.fecha)) continue;
      acc.set(proy, (acc.get(proy) || 0) + parseNum(t.tiempoHoras));
    }
    horasPorProyecto = Array.from(acc.entries())
      .map(([proyecto, horas]) => {
        const servicio = servPorProyecto.get(proyecto) || "";
        const nivelServ = nivelesServicio.find((n) => String(n.servicio) === servicio);
        const precio = nivelServ ? parseNum(nivelServ.precio) : parseNum(nivelBase.precio);
        return { proyecto, servicio, horas, precio };
      })
      // Test 19 bis 2 — Orden por PRECIO DESCENDENTE: se factura primero lo más caro.
      .sort((a, b) => b.precio - a.precio);
  }

  if (nivelesServicio.length > 0 && horasPorProyecto.length > 0) {
    let resto = HF;
    let importeTotal = 0;
    const desglose: DesgloseServicio[] = [];
    for (const { proyecto, servicio, horas, precio: precioServ } of horasPorProyecto) {
      if (resto <= 0) break;
      const facturables = Math.min(horas, resto);
      const imp = facturables * precioServ;
      desglose.push({ servicio, proyecto, horas: facturables, precio: precioServ, importe: imp });
      importeTotal += imp;
      resto -= facturables;
    }
    return {
      caso: "B", contrato: contrato.codigo, cliente: contrato.cliente,
      tipoNivel: contrato.tipoNivel, subtipo: contrato.subtipo, periodo: contrato.periodo,
      modelo: "horas", bolsa: bolsaHoras, precio: parseNum(nivelBase.precio), consumo, facturadas,
      horasAFacturar: HF - Math.max(0, resto), importe: importeTotal, desglose,
      notas: "Exceso por proyecto: " + desglose.map((d) => (d.proyecto || d.servicio) + " " + d.horas.toFixed(2) + "h×" + d.precio + "€").join(" + "),
    };
  }

  // Fallback plano: exceso × precio base (sin desglose por servicio).
  const precio = parseNum(nivelBase.precio);
  return {
    caso: "B", contrato: contrato.codigo, cliente: contrato.cliente,
    tipoNivel: contrato.tipoNivel, subtipo: contrato.subtipo, periodo: contrato.periodo,
    modelo: "horas", bolsa: bolsaHoras, precio, consumo, facturadas,
    horasAFacturar: HF, importe: HF * precio,
    notas: "Exceso " + HF.toFixed(2) + "h × " + precio + "€",
  };
}

/**
 * Test 23 / Pedro 21-06 (P7) — Mantenimiento contra errores: una cuota MÁS,
 * por aplicación, PERIODIFICADA al facturar y calculada en función del nº de
 * aplicaciones del contrato. Para cada Aplicación/Contrato (A/C) busca el
 * Nivel (Tipo E, subtipo del contrato, esa Aplicación), cuyo Valor es ANUAL,
 * y cobra la fracción del periodo (mensual=1/12, trimestral=3/12, …). Texto:
 * "Cuota Mantº Errores <aplicación> (<periodo>)".
 */
export function calcularMantErrores(contrato: Contrato, niveles: Nivel[], acApps: AplicacionContrato[], periodo: string): LineaPrefactura[] {
  const apps = acApps.filter((a) => String(a.contrato || "") === contrato.codigo);
  const factor = factorPeriodo(periodo);
  const out: LineaPrefactura[] = [];
  for (const ac of apps) {
    const app = String(ac.aplicacion || "").trim();
    if (!app) continue;
    const nivel = niveles.find((n) =>
      String(n.tipoNivel).toUpperCase() === "E" &&
      String(n.subtipo) === String(contrato.subtipo) &&
      String(n.aplicacion || "") === app);
    if (!nivel) continue;
    // Valor anual del Nivel E × fracción del periodo, redondeado a céntimos.
    const importe = Math.round(parseNum(nivel.precio) * factor * 100) / 100;
    out.push({
      caso: "A", contrato: contrato.codigo, cliente: contrato.cliente,
      tipoNivel: "E", subtipo: contrato.subtipo, periodo,
      modelo: "cuota", bolsa: 1, precio: importe, consumo: 0, facturadas: 0,
      horasAFacturar: 1, importe, notas: "Cuota Mantº Errores " + app + " (" + periodo + ")",
    });
  }
  return out;
}

/**
 * Test 25 — Pre-facturación de Desplazamientos (modelo "desplazamiento").
 * Selecciona los desplazamientos facturables en la ventana de meses del
 * periodo (Mensual=1, Trimestral=3, Semestral=6, Anual=12, terminando en
 * `fecha`), los agrupa por Cliente y genera una línea por cliente con el
 * Total Km y el importe (suma de Total Venta de cada desplazamiento).
 */
export function prefacturarDesplazamientos(desplazamientos: DesplazamientoLite[], periodo: string, fecha?: string): LineaPrefactura[] {
  const porCliente = new Map<string, { km: number; importe: number }>();
  for (const d of desplazamientos) {
    if (String(d.facturable || "").toLowerCase() === "no") continue;
    if (String(d.estado || "").toLowerCase() === "anulado") continue;
    // Pedro 21-06 — Misma ventana de meses por periodo que el Caso B.
    if (fecha && !enVentanaPeriodo(String(d.fecha || ""), periodo, fecha)) continue;
    const cli = String(d.cliente || "(sin cliente)");
    const acc = porCliente.get(cli) || { km: 0, importe: 0 };
    acc.km += parseNum(d.kilometros);
    acc.importe += parseNum(d.importeTotal);
    porCliente.set(cli, acc);
  }
  const out: LineaPrefactura[] = [];
  for (const [cli, acc] of porCliente.entries()) {
    if (acc.km <= 0 && acc.importe <= 0) continue;
    const km = Math.round(acc.km * 100) / 100;
    out.push({
      caso: "D", contrato: "", cliente: cli, tipoNivel: "", subtipo: "", periodo,
      modelo: "desplazamiento", bolsa: 0, precio: 0, consumo: 0, facturadas: 0,
      horasAFacturar: km, importe: Math.round(acc.importe * 100) / 100,
      notas: "Desplazamientos " + periodo + ": " + km + " Km",
    });
  }
  return out;
}

/**
 * Pre-facturación combinada: aplica el caso A o B según el modelo
 * elegido, sobre los contratos que cumplen los filtros (periodo, y
 * para el caso B también Tipo Nivel = M). Test 23: en cuota trimestral
 * añade las líneas de Mantº Errores por aplicación. Test 25: modelo
 * "desplazamiento" procesa los desplazamientos por kilómetros.
 */
export function prefacturar(
  contratos: Contrato[],
  niveles: Nivel[],
  modelo: "cuota" | "horas" | "desplazamiento",
  periodo: string,
  opts?: PrefacturaOpts,
): LineaPrefactura[] {
  // Test 25 — Modelo Desplazamiento: proceso aparte (no por contratos).
  if (modelo === "desplazamiento") {
    return prefacturarDesplazamientos(opts?.desplazamientos || [], periodo, opts?.fecha);
  }
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
  const lineas = elegibles
    .map((c) => (modelo === "cuota" ? calcularCasoA(c, niveles) : calcularCasoB(c, niveles, { ...opts, periodo })))
    .filter((x): x is LineaPrefactura => x != null);
  // Test 23 / Pedro 21-06 (P7) — Mantº Errores: cuota por aplicación
  // periodificada al periodo elegido (ya NO solo trimestral). Una línea por
  // aplicación de cada contrato Tipo E elegible.
  if (modelo === "cuota" && opts?.aplicacionesContrato) {
    for (const c of elegibles) {
      lineas.push(...calcularMantErrores(c, niveles, opts.aplicacionesContrato, periodo));
    }
  }
  return lineas;
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
