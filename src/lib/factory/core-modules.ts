/**
 * Core modules — módulos transversales universales del ERP (CORE-02 + H7).
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
 * Módulos:
 *   - tareas, tickets, compras, productos, reservas, encuestas, etiquetas, plantillas (CORE-02)
 *   - caja, bodegas, kardex (H3)
 *   - tipos-servicio, actividades-catalogo, empleados, actividades, gastos (H7)
 */

import type {
  SectorPackDefinition,
  SectorPackField,
  SectorPackTableColumn,
} from "@/lib/factory/sector-pack-definition";

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
  // H3 — Caja/POS, Bodegas y Kardex.
  { moduleKey: "caja", enabled: true, label: "Caja", navigationLabel: "Caja", emptyState: "Sin movimientos de caja hoy." },
  { moduleKey: "bodegas", enabled: true, label: "Bodegas", navigationLabel: "Bodegas", emptyState: "Sin bodegas configuradas." },
  { moduleKey: "kardex", enabled: true, label: "Kardex", navigationLabel: "Kardex", emptyState: "Sin movimientos de stock." },
  // H7 — Catálogos de actividades + empleados + actividades-tarea + gastos.
  { moduleKey: "tipos-servicio", enabled: true, label: "Tipos de servicio", navigationLabel: "Tipos servicio", emptyState: "Define las categorías de servicio." },
  { moduleKey: "actividades-catalogo", enabled: true, label: "Catálogo actividades", navigationLabel: "Catálogo actividades", emptyState: "Define qué actividades realizas." },
  { moduleKey: "empleados", enabled: true, label: "Empleados", navigationLabel: "Empleados", emptyState: "Sin empleados registrados." },
  { moduleKey: "actividades", enabled: true, label: "Actividades", navigationLabel: "Actividades", emptyState: "Sin actividades imputadas." },
  { moduleKey: "gastos", enabled: true, label: "Gastos", navigationLabel: "Gastos", emptyState: "Sin gastos imputados." },
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

  // Caja / POS (H3)
  { moduleKey: "caja", fieldKey: "ticket", label: "Nº ticket", kind: "text", placeholder: "T-2026-001" },
  { moduleKey: "caja", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Producto / servicio cobrado" },
  { moduleKey: "caja", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "caja", fieldKey: "metodoPago", label: "Método de pago", kind: "status", required: true, options: [
    { value: "efectivo", label: "Efectivo" }, { value: "tarjeta", label: "Tarjeta" }, { value: "bizum", label: "Bizum" }, { value: "transferencia", label: "Transferencia" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "caja", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "caja", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "caja", fieldKey: "cajero", label: "Cajero", kind: "text", placeholder: "Quién cobró" },
  { moduleKey: "caja", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "cobrado", label: "Cobrado" }, { value: "pendiente", label: "Pendiente" }, { value: "anulado", label: "Anulado" }, { value: "devuelto", label: "Devuelto" },
  ] },
  { moduleKey: "caja", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // Bodegas (H3)
  { moduleKey: "bodegas", fieldKey: "nombre", label: "Bodega", kind: "text", required: true, placeholder: "Almacén central" },
  { moduleKey: "bodegas", fieldKey: "ubicacion", label: "Ubicación", kind: "text", placeholder: "Calle / ciudad" },
  { moduleKey: "bodegas", fieldKey: "responsable", label: "Responsable", kind: "text" },
  { moduleKey: "bodegas", fieldKey: "tipo", label: "Tipo", kind: "status", options: [
    { value: "central", label: "Central" }, { value: "tienda", label: "Tienda" }, { value: "transito", label: "En tránsito" }, { value: "consignacion", label: "Consignación" },
  ] },
  { moduleKey: "bodegas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" },
  ] },
  { moduleKey: "bodegas", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // Kardex (H3)
  { moduleKey: "kardex", fieldKey: "producto", label: "Producto", kind: "relation", relationModuleKey: "productos", required: true },
  { moduleKey: "kardex", fieldKey: "bodega", label: "Bodega", kind: "relation", relationModuleKey: "bodegas", required: true },
  { moduleKey: "kardex", fieldKey: "tipo", label: "Tipo movimiento", kind: "status", required: true, options: [
    { value: "entrada", label: "Entrada" }, { value: "salida", label: "Salida" }, { value: "traspaso", label: "Traspaso" }, { value: "ajuste", label: "Ajuste" },
  ] },
  { moduleKey: "kardex", fieldKey: "cantidad", label: "Cantidad", kind: "number", required: true },
  { moduleKey: "kardex", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "kardex", fieldKey: "motivo", label: "Motivo", kind: "text", placeholder: "Compra, venta, devolución, inventario..." },
  { moduleKey: "kardex", fieldKey: "documentoRef", label: "Doc referencia", kind: "text", placeholder: "OC-001 / FAC-001..." },
  { moduleKey: "kardex", fieldKey: "responsable", label: "Responsable", kind: "text" },
  { moduleKey: "kardex", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "registrado", label: "Registrado" }, { value: "anulado", label: "Anulado" },
  ] },

  // H7-C1 — Tipos de servicio (catálogo agrupador)
  { moduleKey: "tipos-servicio", fieldKey: "codigo", label: "Código", kind: "text", required: true, placeholder: "1, 2, 3..." },
  { moduleKey: "tipos-servicio", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Análisis, Programación, Soporte..." },
  { moduleKey: "tipos-servicio", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
  { moduleKey: "tipos-servicio", fieldKey: "esFacturable", label: "¿Facturable por defecto?", kind: "status", required: true, options: [
    { value: "si", label: "Sí" }, { value: "no", label: "No" },
  ] },

  // H7-C1 — Catálogo de actividades (agrupadas por tipo de servicio)
  { moduleKey: "actividades-catalogo", fieldKey: "codigo", label: "Código", kind: "text", required: true, placeholder: "00, 22, 37..." },
  { moduleKey: "actividades-catalogo", fieldKey: "nombre", label: "Actividad", kind: "text", required: true, placeholder: "Codificación y pruebas, Demostraciones..." },
  { moduleKey: "actividades-catalogo", fieldKey: "tipoServicio", label: "Tipo servicio", kind: "relation", relationModuleKey: "tipos-servicio", required: true },
  { moduleKey: "actividades-catalogo", fieldKey: "tarifaHora", label: "Tarifa hora (opcional)", kind: "money", placeholder: "55 EUR" },
  { moduleKey: "actividades-catalogo", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "archivada", label: "Archivada" },
  ] },

  // H7-C2 — Empleados con código corto + flag baja (CORE)
  { moduleKey: "empleados", fieldKey: "codigoCorto", label: "Código", kind: "text", required: true, placeholder: "J, JJ, MRU..." },
  { moduleKey: "empleados", fieldKey: "nombre", label: "Nombre completo", kind: "text", required: true },
  { moduleKey: "empleados", fieldKey: "email", label: "Email", kind: "email" },
  { moduleKey: "empleados", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
  { moduleKey: "empleados", fieldKey: "rol", label: "Rol / puesto", kind: "text", placeholder: "Programador, Consultor, Comercial..." },
  { moduleKey: "empleados", fieldKey: "fechaAlta", label: "Fecha alta", kind: "date" },
  { moduleKey: "empleados", fieldKey: "fechaBaja", label: "Fecha baja", kind: "date" },
  { moduleKey: "empleados", fieldKey: "esBaja", label: "¿Es baja?", kind: "status", required: true, options: [
    { value: "no", label: "Activo" }, { value: "si", label: "Baja" },
  ] },
  { moduleKey: "empleados", fieldKey: "tarifaHora", label: "Tarifa hora interna", kind: "money" },
  { moduleKey: "empleados", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // H7-C3 — Actividades imputadas (Desde/Hasta + lugar + tipoFacturacion)
  { moduleKey: "actividades", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "actividades", fieldKey: "empleado", label: "Empleado", kind: "relation", required: true, relationModuleKey: "empleados" },
  { moduleKey: "actividades", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
  { moduleKey: "actividades", fieldKey: "proyecto", label: "Proyecto", kind: "relation", relationModuleKey: "proyectos" },
  { moduleKey: "actividades", fieldKey: "actividad", label: "Actividad", kind: "relation", required: true, relationModuleKey: "actividades-catalogo" },
  { moduleKey: "actividades", fieldKey: "horaDesde", label: "Hora desde", kind: "text", placeholder: "08:30", required: true },
  { moduleKey: "actividades", fieldKey: "horaHasta", label: "Hora hasta", kind: "text", placeholder: "10:30", required: true },
  { moduleKey: "actividades", fieldKey: "tiempoHoras", label: "Tiempo (h)", kind: "number", placeholder: "Auto-calculado de las horas" },
  { moduleKey: "actividades", fieldKey: "lugar", label: "Lugar", kind: "status", required: true, options: [
    { value: "oficina", label: "Oficina" }, { value: "teletrabajo", label: "Teletrabajo" }, { value: "cliente", label: "Casa cliente" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "actividades", fieldKey: "descripcion", label: "Descripción", kind: "textarea", required: true },
  { moduleKey: "actividades", fieldKey: "tipoFacturacion", label: "Facturación", kind: "status", required: true, options: [
    { value: "contra-bolsa", label: "Contra bolsa de horas" },
    { value: "fuera-bolsa", label: "Fuera de bolsa (factura aparte)" },
    { value: "no-facturable", label: "No facturable" },
  ] },
  { moduleKey: "actividades", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "borrador", label: "Borrador" }, { value: "validada", label: "Validada" }, { value: "facturada", label: "Facturada" },
  ] },

  // H7-C5 — Hojas de Gastos
  { moduleKey: "gastos", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "gastos", fieldKey: "empleado", label: "Empleado", kind: "relation", required: true, relationModuleKey: "empleados" },
  { moduleKey: "gastos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "kilometraje", label: "Kilometraje" },
    { value: "dietas", label: "Dietas" },
    { value: "aparcamiento", label: "Aparcamiento / peaje" },
    { value: "alojamiento", label: "Alojamiento" },
    { value: "transporte", label: "Transporte público" },
    { value: "suplido", label: "Suplido cliente" },
    { value: "material", label: "Material" },
    { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "gastos", fieldKey: "descripcion", label: "Descripción", kind: "text", required: true },
  { moduleKey: "gastos", fieldKey: "kilometros", label: "Km (si aplica)", kind: "number" },
  { moduleKey: "gastos", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "gastos", fieldKey: "justificante", label: "Justificante (URL)", kind: "text", placeholder: "URL ticket / factura" },
  { moduleKey: "gastos", fieldKey: "repercutibleA", label: "Repercutir a cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "gastos", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "pendiente", label: "Pendiente" }, { value: "aprobado", label: "Aprobado" }, { value: "rechazado", label: "Rechazado" }, { value: "pagado", label: "Pagado" }, { value: "facturado", label: "Facturado al cliente" },
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

  { moduleKey: "caja", fieldKey: "ticket", label: "Ticket", isPrimary: true },
  { moduleKey: "caja", fieldKey: "concepto", label: "Concepto" },
  { moduleKey: "caja", fieldKey: "importe", label: "Importe" },
  { moduleKey: "caja", fieldKey: "metodoPago", label: "Pago" },
  { moduleKey: "caja", fieldKey: "fecha", label: "Fecha" },
  { moduleKey: "caja", fieldKey: "estado", label: "Estado" },

  { moduleKey: "bodegas", fieldKey: "nombre", label: "Bodega", isPrimary: true },
  { moduleKey: "bodegas", fieldKey: "ubicacion", label: "Ubicación" },
  { moduleKey: "bodegas", fieldKey: "responsable", label: "Responsable" },
  { moduleKey: "bodegas", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "bodegas", fieldKey: "estado", label: "Estado" },

  { moduleKey: "kardex", fieldKey: "producto", label: "Producto", isPrimary: true },
  { moduleKey: "kardex", fieldKey: "bodega", label: "Bodega" },
  { moduleKey: "kardex", fieldKey: "tipo", label: "Movimiento" },
  { moduleKey: "kardex", fieldKey: "cantidad", label: "Cantidad" },
  { moduleKey: "kardex", fieldKey: "fecha", label: "Fecha" },
  { moduleKey: "kardex", fieldKey: "estado", label: "Estado" },

  // H7-C1
  { moduleKey: "tipos-servicio", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "tipos-servicio", fieldKey: "nombre", label: "Nombre" },
  { moduleKey: "tipos-servicio", fieldKey: "esFacturable", label: "Facturable" },

  { moduleKey: "actividades-catalogo", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "actividades-catalogo", fieldKey: "nombre", label: "Actividad" },
  { moduleKey: "actividades-catalogo", fieldKey: "tipoServicio", label: "Tipo servicio" },
  { moduleKey: "actividades-catalogo", fieldKey: "tarifaHora", label: "€/h" },
  { moduleKey: "actividades-catalogo", fieldKey: "estado", label: "Estado" },

  // H7-C2
  { moduleKey: "empleados", fieldKey: "codigoCorto", label: "Cód.", isPrimary: true },
  { moduleKey: "empleados", fieldKey: "nombre", label: "Nombre" },
  { moduleKey: "empleados", fieldKey: "rol", label: "Rol" },
  { moduleKey: "empleados", fieldKey: "email", label: "Email" },
  { moduleKey: "empleados", fieldKey: "esBaja", label: "Estado" },

  // H7-C3
  { moduleKey: "actividades", fieldKey: "fecha", label: "Fecha", isPrimary: true },
  { moduleKey: "actividades", fieldKey: "empleado", label: "Empleado" },
  { moduleKey: "actividades", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "actividades", fieldKey: "actividad", label: "Actividad" },
  { moduleKey: "actividades", fieldKey: "horaDesde", label: "Desde" },
  { moduleKey: "actividades", fieldKey: "horaHasta", label: "Hasta" },
  { moduleKey: "actividades", fieldKey: "tiempoHoras", label: "h" },
  { moduleKey: "actividades", fieldKey: "lugar", label: "Lug." },
  { moduleKey: "actividades", fieldKey: "tipoFacturacion", label: "Fact." },
  { moduleKey: "actividades", fieldKey: "estado", label: "Estado" },

  // H7-C5
  { moduleKey: "gastos", fieldKey: "fecha", label: "Fecha", isPrimary: true },
  { moduleKey: "gastos", fieldKey: "empleado", label: "Empleado" },
  { moduleKey: "gastos", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "gastos", fieldKey: "descripcion", label: "Descripción" },
  { moduleKey: "gastos", fieldKey: "importe", label: "Importe" },
  { moduleKey: "gastos", fieldKey: "estado", label: "Estado" },
];

/**
 * Demo data ligero para los core modules.
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
  { moduleKey: "caja", records: [
    { ticket: "T-2026-001", concepto: "Servicio profesional", importe: "75.00 EUR", metodoPago: "tarjeta", cliente: "", fecha: "2026-05-08", cajero: "Operador", estado: "cobrado", notas: "" },
  ]},
  { moduleKey: "bodegas", records: [
    { nombre: "Almacén central", ubicacion: "Sede principal", responsable: "Operador", tipo: "central", estado: "activa", notas: "Bodega principal del tenant." },
  ]},
  { moduleKey: "kardex", records: [
    { producto: "", bodega: "Almacén central", tipo: "entrada", cantidad: "10", fecha: "2026-05-01", motivo: "Stock inicial", documentoRef: "OC-2026-001", responsable: "Operador", estado: "registrado" },
  ]},
  // H7-C1: 8 tipos de servicio inspirados en SISPYME
  { moduleKey: "tipos-servicio", records: [
    { codigo: "1", nombre: "Análisis, Consulting", descripcion: "Análisis funcional, consultoría, diseño.", esFacturable: "si" },
    { codigo: "2", nombre: "Programación", descripcion: "Codificación, modificaciones, pruebas.", esFacturable: "si" },
    { codigo: "3", nombre: "Soporte a usuario, explotación", descripcion: "Soporte de incidencias y consultas.", esFacturable: "si" },
    { codigo: "4", nombre: "Copias de seguridad, reinstalaciones", descripcion: "Backups, reinstalaciones, recovery.", esFacturable: "si" },
    { codigo: "5", nombre: "Técnica de sistemas", descripcion: "Sistemas, infra, redes.", esFacturable: "si" },
    { codigo: "6", nombre: "Otros servicios", descripcion: "Servicios diversos no clasificables.", esFacturable: "si" },
    { codigo: "7", nombre: "Actividad comercial", descripcion: "Ventas, demos, prospección.", esFacturable: "no" },
    { codigo: "8", nombre: "Gestiones administrativas", descripcion: "Tareas administrativas internas.", esFacturable: "no" },
  ]},
  // H7-C1: catálogo de actividades inspirado en SISPYME
  { moduleKey: "actividades-catalogo", records: [
    { codigo: "00", nombre: "Juntas, reuniones, etc.", tipoServicio: "Otros servicios", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "03", nombre: "Visitas o gestiones con clientes", tipoServicio: "Otros servicios", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "07", nombre: "Administración y secretaría", tipoServicio: "Otros servicios", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "22", nombre: "Planificación comercial", tipoServicio: "Actividad comercial", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "23", nombre: "Telemarketing", tipoServicio: "Actividad comercial", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "24", nombre: "Entrevista prospección", tipoServicio: "Actividad comercial", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "26", nombre: "Preparación de ofertas", tipoServicio: "Actividad comercial", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "28", nombre: "Demostraciones", tipoServicio: "Actividad comercial", tarifaHora: "0 EUR", estado: "activa" },
    { codigo: "31", nombre: "Entrevista o charla técnica", tipoServicio: "Análisis, Consulting", tarifaHora: "70 EUR", estado: "activa" },
    { codigo: "32", nombre: "Gestión de proyecto", tipoServicio: "Análisis, Consulting", tarifaHora: "70 EUR", estado: "activa" },
    { codigo: "33", nombre: "Análisis de enfoque", tipoServicio: "Análisis, Consulting", tarifaHora: "70 EUR", estado: "activa" },
    { codigo: "35", nombre: "Análisis detallado y diseño", tipoServicio: "Análisis, Consulting", tarifaHora: "70 EUR", estado: "activa" },
    { codigo: "37", nombre: "Codificación y pruebas", tipoServicio: "Programación", tarifaHora: "55 EUR", estado: "activa" },
    { codigo: "38", nombre: "Modificaciones", tipoServicio: "Programación", tarifaHora: "55 EUR", estado: "activa" },
    { codigo: "39", nombre: "Instalación y enseñanza aplicación", tipoServicio: "Otros servicios", tarifaHora: "60 EUR", estado: "activa" },
    { codigo: "41", nombre: "Operación", tipoServicio: "Soporte a usuario, explotación", tarifaHora: "55 EUR", estado: "activa" },
    { codigo: "47", nombre: "Técnica de sistemas", tipoServicio: "Técnica de sistemas", tarifaHora: "65 EUR", estado: "activa" },
    { codigo: "48", nombre: "Backups, reinstalaciones, etc.", tipoServicio: "Copias de seguridad, reinstalaciones", tarifaHora: "55 EUR", estado: "activa" },
    { codigo: "49", nombre: "Soporte y consultas de usuario", tipoServicio: "Soporte a usuario, explotación", tarifaHora: "55 EUR", estado: "activa" },
  ]},
  { moduleKey: "empleados", records: [
    { codigoCorto: "OP", nombre: "Operador principal", email: "operador@empresa.com", rol: "Administrador", fechaAlta: "2026-01-01", esBaja: "no", tarifaHora: "55 EUR", notas: "" },
  ]},
  { moduleKey: "actividades", records: [
    { fecha: "2026-05-08", empleado: "OP", cliente: "", actividad: "37", horaDesde: "09:00", horaHasta: "11:30", tiempoHoras: "2.5", lugar: "oficina", descripcion: "Codificación módulo facturación.", tipoFacturacion: "contra-bolsa", estado: "validada" },
  ]},
  { moduleKey: "gastos", records: [
    { fecha: "2026-05-08", empleado: "OP", tipo: "kilometraje", descripcion: "Visita cliente en Madrid", kilometros: "120", importe: "48.00 EUR", estado: "pendiente" },
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
  const existingModuleKeys = new Set(config.modules.map((m) => m.moduleKey));
  for (const cm of CORE_MODULES) {
    if (!existingModuleKeys.has(cm.moduleKey)) {
      config.modules.push(cm);
      config.navigationLabelMap[cm.moduleKey] = cm.navigationLabel;
      config.emptyStateMap[cm.moduleKey] = cm.emptyState;
    }
  }
  for (const f of CORE_FIELDS) {
    const existing = config.fieldsByModule[f.moduleKey] || [];
    const hasIt = existing.some((x) => x.fieldKey === f.fieldKey);
    if (hasIt) continue;
    if (!config.fieldsByModule[f.moduleKey]) {
      config.fieldsByModule[f.moduleKey] = [];
    }
    config.fieldsByModule[f.moduleKey].push(f);
  }
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
