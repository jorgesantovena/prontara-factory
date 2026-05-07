/**
 * Core modules — módulos transversales universales del ERP (CORE-02).
 *
 * Estos módulos están disponibles en TODOS los verticales sin necesidad
 * de duplicar fields/tableColumns/demoData en cada sector pack. El
 * resolver `request-tenant-runtime-async.ts` los inyecta en el config
 * del tenant DESPUÉS de aplicar el pack del sector — los módulos del
 * pack tienen prioridad si chocan, pero los core se garantizan presentes.
 *
 * Lo que aporta cada uno cubre las recomendaciones del consultor para
 * "fábrica de ERPs": módulos que cualquier organización necesita
 * independientemente del sector.
 *
 * 8 módulos definidos:
 *   - tareas: gestión de productividad
 *   - tickets: atención al cliente / soporte
 *   - compras: solicitudes y órdenes de compra
 *   - productos: catálogo maestro de productos/servicios
 *   - reservas: reserva de recursos (salas, equipos, vehículos…)
 *   - encuestas: encuestas/NPS internas o externas
 *   - etiquetas: sistema de tags transversal
 *   - plantillas: plantillas de email/documentos
 */

import type {
  SectorPackDefinition,
  SectorPackField,
  SectorPackTableColumn,
} from "@/lib/factory/sector-pack-definition";

// El tipo de un módulo del pack está declarado inline dentro de
// SectorPackDefinition. Lo extraemos aquí para reutilizarlo.
type SectorPackModule = SectorPackDefinition["modules"][number];

export const CORE_MODULES: SectorPackModule[] = [
  { moduleKey: "tareas", enabled: true, label: "Tareas", navigationLabel: "Tareas", emptyState: "Sin tareas pendientes." },
  { moduleKey: "tickets", enabled: true, label: "Tickets", navigationLabel: "Tickets", emptyState: "Sin tickets abiertos." },
  { moduleKey: "compras", enabled: true, label: "Compras", navigationLabel: "Compras", emptyState: "Sin órdenes de compra." },
  { moduleKey: "productos", enabled: true, label: "Productos", navigationLabel: "Productos", emptyState: "Catálogo vacío." },
  { moduleKey: "reservas", enabled: true, label: "Reservas", navigationLabel: "Reservas", emptyState: "Sin reservas activas." },
  { moduleKey: "encuestas", enabled: true, label: "Encuestas", navigationLabel: "Encuestas", emptyState: "Sin encuestas creadas." },
  { moduleKey: "etiquetas", enabled: true, label: "Etiquetas", navigationLabel: "Etiquetas", emptyState: "Sin etiquetas configuradas." },
  { moduleKey: "plantillas", enabled: true, label: "Plantillas", navigationLabel: "Plantillas", emptyState: "Sin plantillas guardadas." },
];

export const CORE_FIELDS: SectorPackField[] = [
  // Tareas
  { moduleKey: "tareas", fieldKey: "titulo", label: "Tarea", kind: "text", required: true, placeholder: "Qué hay que hacer" },
  { moduleKey: "tareas", fieldKey: "asignado", label: "Asignado a", kind: "text", placeholder: "Quién la ejecuta" },
  { moduleKey: "tareas", fieldKey: "prioridad", label: "Prioridad", kind: "status", required: true, placeholder: "baja / media / alta / urgente", options: [
    { value: "baja", label: "Baja" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" },
  ] },
  { moduleKey: "tareas", fieldKey: "fechaLimite", label: "Fecha límite", kind: "date" },
  { moduleKey: "tareas", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "pendiente / en_progreso / en_revision / completada / cancelada", options: [
    { value: "pendiente", label: "Pendiente" }, { value: "en_progreso", label: "En progreso" }, { value: "en_revision", label: "En revisión" }, { value: "completada", label: "Completada" }, { value: "cancelada", label: "Cancelada" },
  ] },
  { moduleKey: "tareas", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

  // Tickets
  { moduleKey: "tickets", fieldKey: "asunto", label: "Asunto", kind: "text", required: true, placeholder: "Resumen del ticket" },
  { moduleKey: "tickets", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "tickets", fieldKey: "categoria", label: "Categoría", kind: "text", placeholder: "incidencia / consulta / mejora / queja" },
  { moduleKey: "tickets", fieldKey: "prioridad", label: "Prioridad", kind: "status", required: true, options: [
    { value: "baja", label: "Baja" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "critica", label: "Crítica" },
  ] },
  { moduleKey: "tickets", fieldKey: "asignado", label: "Asignado a", kind: "text" },
  { moduleKey: "tickets", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "nuevo", label: "Nuevo" }, { value: "en_curso", label: "En curso" }, { value: "esperando", label: "Esperando cliente" }, { value: "resuelto", label: "Resuelto" }, { value: "cerrado", label: "Cerrado" },
  ] },
  { moduleKey: "tickets", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

  // Compras
  { moduleKey: "compras", fieldKey: "numero", label: "Nº orden", kind: "text", placeholder: "OC-2026-001" },
  { moduleKey: "compras", fieldKey: "proveedor", label: "Proveedor", kind: "text", required: true },
  { moduleKey: "compras", fieldKey: "concepto", label: "Concepto", kind: "text", required: true },
  { moduleKey: "compras", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "compras", fieldKey: "fechaSolicitud", label: "Fecha solicitud", kind: "date" },
  { moduleKey: "compras", fieldKey: "fechaEntregaPrevista", label: "Entrega prevista", kind: "date" },
  { moduleKey: "compras", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "solicitada", label: "Solicitada" }, { value: "aprobada", label: "Aprobada" }, { value: "comprada", label: "Comprada" }, { value: "recibida", label: "Recibida" }, { value: "rechazada", label: "Rechazada" },
  ] },
  { moduleKey: "compras", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // Productos
  { moduleKey: "productos", fieldKey: "sku", label: "SKU / código", kind: "text", placeholder: "Código interno único" },
  { moduleKey: "productos", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "productos", fieldKey: "categoria", label: "Categoría", kind: "text" },
  { moduleKey: "productos", fieldKey: "tipo", label: "Tipo", kind: "status", placeholder: "producto / servicio / kit / insumo", options: [
    { value: "producto", label: "Producto" }, { value: "servicio", label: "Servicio" }, { value: "kit", label: "Kit" }, { value: "insumo", label: "Insumo" },
  ] },
  { moduleKey: "productos", fieldKey: "precio", label: "Precio (sin IVA)", kind: "money" },
  { moduleKey: "productos", fieldKey: "unidadMedida", label: "Unidad de medida", kind: "text", placeholder: "ud / kg / hora / mes" },
  { moduleKey: "productos", fieldKey: "stock", label: "Stock actual", kind: "number" },
  { moduleKey: "productos", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }, { value: "discontinuado", label: "Discontinuado" },
  ] },

  // Reservas
  { moduleKey: "reservas", fieldKey: "recurso", label: "Recurso", kind: "text", required: true, placeholder: "Sala A, Vehículo 1, Aula 12..." },
  { moduleKey: "reservas", fieldKey: "solicitante", label: "Solicitante", kind: "text", required: true },
  { moduleKey: "reservas", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "reservas", fieldKey: "horaInicio", label: "Hora inicio", kind: "text", placeholder: "09:00" },
  { moduleKey: "reservas", fieldKey: "horaFin", label: "Hora fin", kind: "text", placeholder: "10:30" },
  { moduleKey: "reservas", fieldKey: "motivo", label: "Motivo / uso", kind: "text" },
  { moduleKey: "reservas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "solicitada", label: "Solicitada" }, { value: "confirmada", label: "Confirmada" }, { value: "en_uso", label: "En uso" }, { value: "completada", label: "Completada" }, { value: "cancelada", label: "Cancelada" },
  ] },

  // Encuestas
  { moduleKey: "encuestas", fieldKey: "titulo", label: "Encuesta", kind: "text", required: true },
  { moduleKey: "encuestas", fieldKey: "tipo", label: "Tipo", kind: "status", placeholder: "satisfaccion / nps / interna / captacion", options: [
    { value: "satisfaccion", label: "Satisfacción" }, { value: "nps", label: "NPS" }, { value: "interna", label: "Interna" }, { value: "captacion", label: "Captación" },
  ] },
  { moduleKey: "encuestas", fieldKey: "publico", label: "Público", kind: "text", placeholder: "Clientes / Empleados / Familias..." },
  { moduleKey: "encuestas", fieldKey: "preguntas", label: "Preguntas", kind: "textarea", placeholder: "Una pregunta por línea" },
  { moduleKey: "encuestas", fieldKey: "fechaInicio", label: "Inicio", kind: "date" },
  { moduleKey: "encuestas", fieldKey: "fechaFin", label: "Fin", kind: "date" },
  { moduleKey: "encuestas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "borrador", label: "Borrador" }, { value: "activa", label: "Activa" }, { value: "cerrada", label: "Cerrada" },
  ] },

  // Etiquetas
  { moduleKey: "etiquetas", fieldKey: "nombre", label: "Etiqueta", kind: "text", required: true, placeholder: "VIP, Urgente, Top, Riesgo..." },
  { moduleKey: "etiquetas", fieldKey: "color", label: "Color", kind: "text", placeholder: "#1d4ed8" },
  { moduleKey: "etiquetas", fieldKey: "aplicaA", label: "Aplica a", kind: "text", placeholder: "clientes, productos, tareas..." },
  { moduleKey: "etiquetas", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

  // Plantillas
  { moduleKey: "plantillas", fieldKey: "nombre", label: "Plantilla", kind: "text", required: true },
  { moduleKey: "plantillas", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "email", label: "Email" }, { value: "sms", label: "SMS" }, { value: "documento", label: "Documento" }, { value: "whatsapp", label: "WhatsApp" },
  ] },
  { moduleKey: "plantillas", fieldKey: "asunto", label: "Asunto", kind: "text", placeholder: "Solo aplica a email" },
  { moduleKey: "plantillas", fieldKey: "contenido", label: "Contenido", kind: "textarea", required: true, placeholder: "Texto con {{variables}} dinámicas" },
  { moduleKey: "plantillas", fieldKey: "idioma", label: "Idioma", kind: "text", placeholder: "es / en / fr" },
  { moduleKey: "plantillas", fieldKey: "estado", label: "Estado", kind: "status", options: [
    { value: "activa", label: "Activa" }, { value: "borrador", label: "Borrador" }, { value: "archivada", label: "Archivada" },
  ] },
];

export const CORE_TABLE_COLUMNS: SectorPackTableColumn[] = [
  { moduleKey: "tareas", fieldKey: "titulo", label: "Tarea", isPrimary: true },
  { moduleKey: "tareas", fieldKey: "asignado", label: "Asignado" },
  { moduleKey: "tareas", fieldKey: "prioridad", label: "Prioridad" },
  { moduleKey: "tareas", fieldKey: "fechaLimite", label: "Límite" },
  { moduleKey: "tareas", fieldKey: "estado", label: "Estado" },

  { moduleKey: "tickets", fieldKey: "asunto", label: "Asunto", isPrimary: true },
  { moduleKey: "tickets", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "tickets", fieldKey: "categoria", label: "Categoría" },
  { moduleKey: "tickets", fieldKey: "prioridad", label: "Prioridad" },
  { moduleKey: "tickets", fieldKey: "asignado", label: "Asignado" },
  { moduleKey: "tickets", fieldKey: "estado", label: "Estado" },

  { moduleKey: "compras", fieldKey: "numero", label: "Nº", isPrimary: true },
  { moduleKey: "compras", fieldKey: "proveedor", label: "Proveedor" },
  { moduleKey: "compras", fieldKey: "concepto", label: "Concepto" },
  { moduleKey: "compras", fieldKey: "importe", label: "Importe" },
  { moduleKey: "compras", fieldKey: "estado", label: "Estado" },

  { moduleKey: "productos", fieldKey: "sku", label: "SKU", isPrimary: true },
  { moduleKey: "productos", fieldKey: "nombre", label: "Nombre" },
  { moduleKey: "productos", fieldKey: "categoria", label: "Categoría" },
  { moduleKey: "productos", fieldKey: "precio", label: "Precio" },
  { moduleKey: "productos", fieldKey: "stock", label: "Stock" },
  { moduleKey: "productos", fieldKey: "estado", label: "Estado" },

  { moduleKey: "reservas", fieldKey: "recurso", label: "Recurso", isPrimary: true },
  { moduleKey: "reservas", fieldKey: "solicitante", label: "Solicitante" },
  { moduleKey: "reservas", fieldKey: "fecha", label: "Fecha" },
  { moduleKey: "reservas", fieldKey: "horaInicio", label: "Inicio" },
  { moduleKey: "reservas", fieldKey: "horaFin", label: "Fin" },
  { moduleKey: "reservas", fieldKey: "estado", label: "Estado" },

  { moduleKey: "encuestas", fieldKey: "titulo", label: "Encuesta", isPrimary: true },
  { moduleKey: "encuestas", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "encuestas", fieldKey: "publico", label: "Público" },
  { moduleKey: "encuestas", fieldKey: "fechaInicio", label: "Inicio" },
  { moduleKey: "encuestas", fieldKey: "estado", label: "Estado" },

  { moduleKey: "etiquetas", fieldKey: "nombre", label: "Etiqueta", isPrimary: true },
  { moduleKey: "etiquetas", fieldKey: "color", label: "Color" },
  { moduleKey: "etiquetas", fieldKey: "aplicaA", label: "Aplica a" },

  { moduleKey: "plantillas", fieldKey: "nombre", label: "Plantilla", isPrimary: true },
  { moduleKey: "plantillas", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "plantillas", fieldKey: "asunto", label: "Asunto" },
  { moduleKey: "plantillas", fieldKey: "idioma", label: "Idioma" },
  { moduleKey: "plantillas", fieldKey: "estado", label: "Estado" },
];

/**
 * Demo data ligero para los core modules. Uno o dos registros por módulo
 * — suficiente para que el tenant nuevo vea la tabla con contenido y
 * entienda cómo usar el módulo. Los packs específicos pueden añadir más
 * registros a través de su propio demoData.
 */
export const CORE_DEMO_DATA: Array<{ moduleKey: string; records: Array<Record<string, string>> }> = [
  { moduleKey: "tareas", records: [
    { titulo: "Revisar contratos pendientes", asignado: "Operador", prioridad: "media", fechaLimite: "2026-05-15", estado: "pendiente", descripcion: "Repaso mensual de contratos próximos a vencer." },
    { titulo: "Preparar reunión semanal", asignado: "Operador", prioridad: "alta", fechaLimite: "2026-05-12", estado: "en_progreso", descripcion: "Agenda + agenda compartida con el equipo." },
  ]},
  { moduleKey: "tickets", records: [
    { asunto: "Cliente reporta error en login", cliente: "", categoria: "incidencia", prioridad: "alta", asignado: "Soporte L1", estado: "en_curso", descripcion: "Cliente no puede acceder. Logs revisándose." },
    { asunto: "Solicitud de mejora", cliente: "", categoria: "mejora", prioridad: "baja", asignado: "Producto", estado: "nuevo", descripcion: "Pide opción de exportar listado." },
  ]},
  { moduleKey: "compras", records: [
    { numero: "OC-2026-001", proveedor: "Material de oficina S.L.", concepto: "Folios A4 + tóner", importe: "180 EUR", fechaSolicitud: "2026-05-02", estado: "aprobada", notas: "Pedido mensual estándar." },
  ]},
  { moduleKey: "productos", records: [
    { sku: "PROD-001", nombre: "Producto/servicio ejemplo", categoria: "General", tipo: "producto", precio: "100 EUR", unidadMedida: "ud", stock: "0", estado: "activo" },
  ]},
  { moduleKey: "reservas", records: [
    { recurso: "Sala de reuniones principal", solicitante: "Operador", fecha: "2026-05-12", horaInicio: "10:00", horaFin: "11:30", motivo: "Reunión semanal de equipo", estado: "confirmada" },
  ]},
  { moduleKey: "encuestas", records: [
    { titulo: "Encuesta de satisfacción Q2", tipo: "satisfaccion", publico: "Clientes", preguntas: "¿Cómo valorarías nuestro servicio?\n¿Recomendarías Prontara?", fechaInicio: "2026-05-01", fechaFin: "2026-06-30", estado: "activa" },
  ]},
  { moduleKey: "etiquetas", records: [
    { nombre: "VIP", color: "#7c3aed", aplicaA: "clientes", descripcion: "Cliente de alta prioridad." },
    { nombre: "Urgente", color: "#dc2626", aplicaA: "tareas, tickets", descripcion: "Requiere atención inmediata." },
    { nombre: "Renovación", color: "#0891b2", aplicaA: "clientes, contratos", descripcion: "Cliente próximo a renovar." },
  ]},
  { moduleKey: "plantillas", records: [
    { nombre: "Bienvenida nuevo cliente", tipo: "email", asunto: "Bienvenido a {{empresa}}", contenido: "Hola {{cliente}},\n\nGracias por confiar en nosotros. Aquí tienes la información para empezar...", idioma: "es", estado: "activa" },
    { nombre: "Recordatorio cita", tipo: "sms", asunto: "", contenido: "Hola {{nombre}}, te recordamos tu cita el {{fecha}} a las {{hora}}. {{empresa}}", idioma: "es", estado: "activa" },
  ]},
];

/**
 * Aplica los core modules al config runtime: añade modules, fields y
 * tableColumns que no estén ya definidos en el pack del sector.
 *
 * Si el pack ya define un field para `moduleKey + fieldKey`, prevalece
 * el del pack (permite override sectorial).
 */
export function applyCoreModulesToConfig<T extends {
  modules: SectorPackModule[];
  fieldsByModule: Record<string, SectorPackField[]>;
  tableColumnsByModule: Record<string, SectorPackTableColumn[]>;
  navigationLabelMap: Record<string, string>;
  emptyStateMap: Record<string, string>;
}>(config: T): T {
  // 1. Modules — añadir solo si no existen
  const existingModuleKeys = new Set(config.modules.map((m) => m.moduleKey));
  for (const cm of CORE_MODULES) {
    if (!existingModuleKeys.has(cm.moduleKey)) {
      config.modules.push(cm);
      config.navigationLabelMap[cm.moduleKey] = cm.navigationLabel;
      config.emptyStateMap[cm.moduleKey] = cm.emptyState;
    }
  }

  // 2. Fields — añadir solo los que el pack no haya definido para
  //    (moduleKey, fieldKey).
  for (const f of CORE_FIELDS) {
    const existing = config.fieldsByModule[f.moduleKey] || [];
    const hasIt = existing.some((x) => x.fieldKey === f.fieldKey);
    if (hasIt) continue;
    if (!config.fieldsByModule[f.moduleKey]) {
      config.fieldsByModule[f.moduleKey] = [];
    }
    config.fieldsByModule[f.moduleKey].push(f);
  }

  // 3. TableColumns — añadir solo si el pack no ha definido columnas
  //    para ese módulo. Así el pack puede customizar el layout entero
  //    para SU vertical sin que se mezclen.
  for (const c of CORE_TABLE_COLUMNS) {
    const existingCols = config.tableColumnsByModule[c.moduleKey] || [];
    if (existingCols.length > 0) continue;
    if (!config.tableColumnsByModule[c.moduleKey]) {
      config.tableColumnsByModule[c.moduleKey] = [];
    }
    config.tableColumnsByModule[c.moduleKey].push(c);
  }

  return config;
}
