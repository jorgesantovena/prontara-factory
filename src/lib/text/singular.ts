/**
 * Helper compartido para obtener el singular de un label castellano.
 *
 * Antes vivía DUPLICADO en `erp-record-editor.tsx` y
 * `generic-module-runtime-page.tsx`, y los overrides se desincronizaban
 * cada vez que se añadía una etiqueta nueva (TEST-14-15 bis: arreglé
 * "Asignaciones → Asignación" solo en uno, el editor seguía mostrando
 * "Alta de Asignacione"). A partir de TEST-16 hay una única fuente de
 * verdad aquí.
 *
 * Regla: si el label está en `SINGULAR_OVERRIDES` (palabras castellanas
 * comunes), devolver el override; si no, fallback genérico "quitar la s
 * final" (suficiente para palabras simples tipo "Tickets → Ticket"). El
 * fallback fallaba con palabras tipo "Clientes" → "client" antes del
 * override, por eso el diccionario tiene tantas entradas explícitas.
 */
export const SINGULAR_OVERRIDES: Record<string, string> = {
  // CORE / comerciales
  clientes: "cliente",
  oportunidades: "oportunidad",
  proyectos: "proyecto",
  propuestas: "propuesta",
  presupuestos: "presupuesto",
  // Test 22 bis — "niveles" → "nivel" (el fallback daba "nivele").
  niveles: "nivel",
  contratos: "contrato",
  facturas: "factura",
  documentos: "documento",
  entregables: "entregable",
  tareas: "tarea",
  tickets: "ticket",
  compras: "compra",
  productos: "producto",
  reservas: "reserva",
  encuestas: "encuesta",
  etiquetas: "etiqueta",
  plantillas: "plantilla",
  empleados: "empleado",
  gastos: "gasto",
  vencimientos: "vencimiento",
  desplazamientos: "desplazamiento",
  hitos: "hito",
  aplicaciones: "aplicación",
  notificaciones: "notificación",
  // verticales
  pacientes: "paciente",
  citas: "cita",
  tratamientos: "tratamiento",
  alumnos: "alumno",
  docentes: "docente",
  calificaciones: "calificación",
  // TEST-14-15 bis — plurales castellanos -ciones/-siones/-aciones que
  // pluralizan con tilde y el fallback "quitar s" rompía ("Asignacione").
  asignaciones: "asignación",
  operaciones: "operación",
  direcciones: "dirección",
  versiones: "versión",
  // Renombrados TEST-14: plurales triviales -s también explícitos para
  // que el grep de auditoría detecte la entrada.
  trabajos: "trabajo",
  servicios: "servicio",
  actividades: "actividad",
  tarifas: "tarifa",
  zonas: "zona",
  grupos: "grupo",
  becas: "beca",
  salidas: "salida",
  egresados: "egresado",
  avisos: "aviso",
  recibos: "recibo",
  socios: "socio",
  bonos: "bono",
  cuotas: "cuota",
  // TEST-16 bis D — Pedro reporta singulares mal generados en módulos
  // cuyo label es de varias palabras. El fallback "quitar la s final"
  // solo toca la última palabra del label, dejando "tarifas especiale"
  // (no convierte "tarifas" → "tarifa"). Lo arreglamos con overrides
  // explícitos del label completo en minúsculas.
  "tarifas especiales": "tarifa especial",
  "tarifas generales": "tarifa general",
  "formas pago": "forma de pago",
  "formas de pago": "forma de pago",
  "cuentas bancarias": "cuenta bancaria",
  "tipos cliente": "tipo de cliente",
  "tipos servicio": "tipo de servicio",
  "tipos urgencia": "tipo de urgencia",
  "grupos empresa": "grupo de empresa",
  "zonas comerciales": "zona comercial",
  "puntos venta": "punto de venta",
  "grupos de empresa": "grupo de empresa",
  "extracurriculares": "extracurricular",
  "salidas pedagogicas": "salida pedagógica",
  "salidas pedagógicas": "salida pedagógica",
};

export function singular(label: string): string {
  const l = String(label || "").toLowerCase().trim();
  if (SINGULAR_OVERRIDES[l]) return SINGULAR_OVERRIDES[l];
  // Fallback genérico: si termina en "s" larga, quitar la "s" final.
  if (l.endsWith("s") && l.length > 2) return l.slice(0, -1);
  return l;
}
