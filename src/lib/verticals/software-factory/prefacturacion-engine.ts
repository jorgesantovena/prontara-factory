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
 * Caso A — Importe = Valor del Nivel (tipo, subtipo, Cuota). Test 22 bis.
 */
export function calcularCasoA(contrato: Contrato, niveles: Nivel[]): LineaPrefactura | null {
  const nivel = findNivel(niveles, contrato.tipoNivel, contrato.subtipo, "cuota");
  if (!nivel) {
    // Sin Nivel Cuota definido → no se emite cuota.
    return null;
  }
  const precio = parseNum(nivel.precio); // Valor del Nivel Cuota = importe de la cuota
  // Test 22 bis (Ejercicio 1) — Caso A: Importe = Valor del Nivel Cuota.
  // La cuota del periodo ES el Valor; el Bono NO la multiplica (eso fue una
  // hipótesis de bis-2, corregida por el ejemplo numérico de Pedro:
  // M1 Cuota Valor 807,77 → Importe 807,77).
  const importe = precio;
  return {
    caso: "A",
    contrato: contrato.codigo,
    cliente: contrato.cliente,
    tipoNivel: contrato.tipoNivel,
    subtipo: contrato.subtipo,
    periodo: contrato.periodo,
    modelo: "cuota",
    bolsa: 1,
    precio,
    consumo: parseNum(contrato.consumo),
    facturadas: parseNum(contrato.facturadas),
    horasAFacturar: 1,
    importe,
    notas: "Cuota " + contrato.periodo + " = " + precio + "€",
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

  const consumo = parseNum(contrato.consumo);
  const facturadas = parseNum(contrato.facturadas);
  // Test 19 bis 2 — Bolsa = horas del Bono (Nivel Tipo B referenciado por el
  // contrato). Fallback legacy: la Bolsa del Nivel M Horas (datos anteriores
  // a bis-2, donde la Bolsa vivía en el propio Nivel).
  const bolsaHoras = bonoHoras(contrato, niveles) ?? parseNum(nivelBase.bolsa);
  const HF = consumo - bolsaHoras - facturadas; // Horas a Facturar (exceso)
  if (HF <= 0) return null; // sin exceso → no se emite línea

  // Test 19 bis G — Desglose por servicio. Requiere Niveles Horas con
  // `servicio` para este subtipo Y las tareas/proyectos del contrato.
  // INTERPRETACIÓN (pendiente de validar por Pedro con números reales):
  // se reparte el exceso HF entre los servicios consumidos en el mes, en
  // orden de código de servicio, facturando cada servicio a SU precio
  // hasta agotar HF. El último servicio puede quedar parcialmente cubierto.
  const nivelesServicio = niveles.filter((n) =>
    String(n.tipoNivel).toUpperCase() === "M" && String(n.subtipo) === sub &&
    String(n.modelo).toLowerCase() === "horas" && String(n.servicio || "").trim());

  // Test 21 — Reparto del exceso POR PROYECTO (antes por servicio): se
  // totalizan las horas de cada Proyecto del contrato en el mes, y cada
  // Proyecto se factura al precio de su Servicio (Nivel M-Horas-Servicio).
  let horasPorProyecto: Array<{ proyecto: string; servicio: string; horas: number; precio: number }> = [];
  if (opts?.actividades && opts?.proyectos) {
    const servPorProyecto = new Map<string, string>();
    for (const p of opts.proyectos) {
      if (String(p.contrato || "") !== contrato.codigo) continue;
      const serv = String(p.codigoTipo || "");
      if (p.nombre) servPorProyecto.set(String(p.nombre), serv);
      if (p.id) servPorProyecto.set(String(p.id), serv);
    }
    const acc = new Map<string, number>();
    for (const t of opts.actividades) {
      const proy = String(t.proyecto || "");
      if (!servPorProyecto.has(proy)) continue; // la tarea no es de este contrato
      if (opts.fecha && String(t.fecha || "").slice(0, 7) !== opts.fecha) continue;
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
 * Test 23 — Mantenimiento contra errores: para un contrato, recorre sus
 * Aplicaciones/Contrato (A/C) y por cada una busca el Nivel
 * (Tipo E, subtipo del contrato, esa Aplicación). Genera una línea de
 * cuota por aplicación con el Valor del Nivel E. Texto:
 * "Cuota Mantº Errores <aplicación>".
 */
export function calcularMantErrores(contrato: Contrato, niveles: Nivel[], acApps: AplicacionContrato[]): LineaPrefactura[] {
  const apps = acApps.filter((a) => String(a.contrato || "") === contrato.codigo);
  const out: LineaPrefactura[] = [];
  for (const ac of apps) {
    const app = String(ac.aplicacion || "").trim();
    if (!app) continue;
    const nivel = niveles.find((n) =>
      String(n.tipoNivel).toUpperCase() === "E" &&
      String(n.subtipo) === String(contrato.subtipo) &&
      String(n.aplicacion || "") === app);
    if (!nivel) continue;
    const importe = parseNum(nivel.precio);
    out.push({
      caso: "A", contrato: contrato.codigo, cliente: contrato.cliente,
      tipoNivel: "E", subtipo: contrato.subtipo, periodo: contrato.periodo,
      modelo: "cuota", bolsa: 1, precio: importe, consumo: 0, facturadas: 0,
      horasAFacturar: 1, importe, notas: "Cuota Mantº Errores " + app,
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
  const monthsBack: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12, discreto: 1 };
  const n = monthsBack[String(periodo)] || 1;
  const ymToNum = (ym: string) => { const [y, m] = ym.split("-").map(Number); return (y || 0) * 12 + ((m || 1) - 1); };
  const end = fecha ? ymToNum(fecha) : null;
  const start = end != null ? end - (n - 1) : null;
  const porCliente = new Map<string, { km: number; importe: number }>();
  for (const d of desplazamientos) {
    if (String(d.facturable || "").toLowerCase() === "no") continue;
    if (String(d.estado || "").toLowerCase() === "anulado") continue;
    if (end != null && start != null) {
      const ym = String(d.fecha || "").slice(0, 7);
      if (!ym) continue;
      const num = ymToNum(ym);
      if (num < start || num > end) continue;
    }
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
    .map((c) => (modelo === "cuota" ? calcularCasoA(c, niveles) : calcularCasoB(c, niveles, opts)))
    .filter((x): x is LineaPrefactura => x != null);
  // Test 23 — Cuota trimestral: añadir las líneas de Mantº Errores (una por
  // aplicación de cada contrato elegible).
  if (modelo === "cuota" && periodo === "trimestral" && opts?.aplicacionesContrato) {
    for (const c of elegibles) {
      lineas.push(...calcularMantErrores(c, niveles, opts.aplicacionesContrato));
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
