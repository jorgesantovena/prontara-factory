/**
 * Iconos por moduleKey compartidos por la sidebar (tenant-sidebar.tsx)
 * y por la TabBar (tab-bar.tsx).
 *
 * TEST-17 — Pedro pide que las solapas muestren el mismo icono que el
 * Menú Principal. Antes el map vivía solo en tenant-sidebar.tsx y la
 * TabBar no tenía acceso → al replicar hubiéramos creado un segundo
 * tipo paralelo (ver `arch_parallel_types.md`). Lo extraemos aquí.
 *
 * Convención: emoji simple sin dependencia de iconos SVG.
 */
export const MODULE_ICON: Record<string, string> = {
  // Operación
  clientes: "👥",
  crm: "🎯",
  proyectos: "🛠️",
  produccion: "🏭",
  actividades: "⏱️",
  // Test 26 — Trabajos: alta diaria del parte de horas.
  trabajos: "✍️",
  tareas: "✔️",
  reservas: "📅",
  caja: "💰",
  "puntos-venta": "🏪",
  "avisos-programados": "🔔",
  calendario: "🗓️",
  eventos: "🎉",
  comunicaciones: "📢",
  mensajes: "💬",
  // Académico (colegio)
  docentes: "👨‍🏫",
  horarios: "🕐",
  planeaciones: "📋",
  calificaciones: "📊",
  asistencia: "✅",
  disciplina: "⚖️",
  orientacion: "🧠",
  enfermeria: "🏥",
  transporte: "🚌",
  comedor: "🍽️",
  biblioteca: "📖",
  salidas: "🚶",
  becas: "🎓",
  visitantes: "🚪",
  tramites: "📝",
  egresados: "🎓",
  // Administración — finanzas y stock
  presupuestos: "📄",
  "pre-facturacion": "🧾",
  "parte-servicios": "📄",
  facturacion: "💶",
  albaranes: "📦",
  "vencimientos-factura": "⏰",
  compras: "🛒",
  productos: "🏷️",
  bodegas: "🏬",
  kardex: "📈",
  documentos: "📎",
  gastos: "💸",
  desplazamientos: "🚗",
  inventario: "📦",
  mantenimiento: "🔧",
  cau: "🎧",
  kb: "📚",
  tickets: "🎫",
  "catalogo-servicios": "📚",
  // Analítica
  reportes: "📊",
  "estadistica-ventas": "📈",
  encuestas: "📝",
  // Configuración / Maestros
  asistente: "💬",
  equipo: "👤",
  ajustes: "⚙️",
  "ajustes-cuenta": "👤",
  "ajustes-campos": "🧩",
  workflows: "🔀",
  integraciones: "🔌",
  etiquetas: "🏷",
  plantillas: "📑",
  aplicaciones: "📱",
  empleados: "👔",
  personal: "💼",
  "tipos-cliente": "🔖",
  "tipos-servicio": "🔖",
  "tipos-urgencia": "🚨",
  "actividades-catalogo": "📋",
  "zonas-comerciales": "🗺️",
  "grupos-empresa": "🏢",
  "tarifas-generales": "💲",
  "tarifas-especiales": "💎",
  "clases-condicion": "🏷️",
  "formas-pago": "💳",
  "cuentas-bancarias": "🏦",
};

/** Icono para una pestaña/menú. Fallback: cuadradito. */
export function iconForModule(moduleKey: string): string {
  return MODULE_ICON[moduleKey] || "▫️";
}
