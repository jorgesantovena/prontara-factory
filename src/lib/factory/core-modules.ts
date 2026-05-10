/**
 * Core modules — módulos transversales universales del ERP (CORE-02 + H7 + H8).
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
  { moduleKey: "caja", enabled: true, label: "Caja", navigationLabel: "Caja", emptyState: "Sin movimientos de caja hoy." },
  { moduleKey: "bodegas", enabled: true, label: "Bodegas", navigationLabel: "Bodegas", emptyState: "Sin bodegas configuradas." },
  { moduleKey: "kardex", enabled: true, label: "Kardex", navigationLabel: "Kardex", emptyState: "Sin movimientos de stock." },
  { moduleKey: "tipos-servicio", enabled: true, label: "Tipos de servicio", navigationLabel: "Tipos servicio", emptyState: "Define las categorías de servicio." },
  { moduleKey: "actividades-catalogo", enabled: true, label: "Catálogo actividades", navigationLabel: "Catálogo actividades", emptyState: "Define qué actividades realizas." },
  { moduleKey: "empleados", enabled: true, label: "Empleados", navigationLabel: "Empleados", emptyState: "Sin empleados registrados." },
  { moduleKey: "actividades", enabled: true, label: "Actividades", navigationLabel: "Actividades", emptyState: "Sin actividades imputadas." },
  { moduleKey: "gastos", enabled: true, label: "Gastos", navigationLabel: "Gastos", emptyState: "Sin gastos imputados." },
  // H8 — Catálogos comerciales y sistema de tarifas + estructura SISPYME
  { moduleKey: "tipos-cliente", enabled: true, label: "Tipos de cliente", navigationLabel: "Tipos cliente", emptyState: "Define tipos de cliente." },
  { moduleKey: "zonas-comerciales", enabled: true, label: "Zonas comerciales", navigationLabel: "Zonas", emptyState: "Sin zonas comerciales definidas." },
  { moduleKey: "grupos-empresa", enabled: true, label: "Grupos de empresa", navigationLabel: "Grupos", emptyState: "Sin grupos de empresa." },
  { moduleKey: "puntos-venta", enabled: true, label: "Puntos de venta", navigationLabel: "Puntos venta", emptyState: "Sin puntos de venta registrados." },
  { moduleKey: "clases-condicion", enabled: true, label: "Clases de condición", navigationLabel: "Clases condición", emptyState: "Define clases de condición de tarifa." },
  { moduleKey: "tarifas-generales", enabled: true, label: "Tarifas generales", navigationLabel: "Tarifas", emptyState: "Sin tarifas generales definidas." },
  { moduleKey: "tarifas-especiales", enabled: true, label: "Tarifas especiales", navigationLabel: "Tarifas especiales", emptyState: "Sin tarifas especiales por cliente/grupo." },
  { moduleKey: "albaranes", enabled: true, label: "Albaranes", navigationLabel: "Albaranes", emptyState: "Sin albaranes pendientes." },
  { moduleKey: "vencimientos-factura", enabled: true, label: "Vencimientos", navigationLabel: "Vencimientos", emptyState: "Sin vencimientos." },
  { moduleKey: "avisos-programados", enabled: true, label: "Plan de avisos", navigationLabel: "Avisos", emptyState: "Sin plan de avisos configurado." },
  { moduleKey: "tipos-urgencia", enabled: true, label: "Tipos de urgencia", navigationLabel: "Urgencias", emptyState: "Define tipos de urgencia." },
  { moduleKey: "desplazamientos", enabled: true, label: "Desplazamientos", navigationLabel: "Desplazamientos", emptyState: "Sin desplazamientos imputados." },
  // H8.5 — Formas de pago configurables + cuentas bancarias
  { moduleKey: "formas-pago", enabled: true, label: "Formas de pago", navigationLabel: "Formas pago", emptyState: "Define tus formas de pago." },
  { moduleKey: "cuentas-bancarias", enabled: true, label: "Cuentas bancarias", navigationLabel: "Cuentas bancarias", emptyState: "Sin cuentas bancarias registradas." },
];

export const CORE_FIELDS: SectorPackField[] = [
  // Tareas
  { moduleKey: "tareas", fieldKey: "titulo", label: "Tarea", kind: "text", required: true, placeholder: "Qué hay que hacer" },
  { moduleKey: "tareas", fieldKey: "asignado", label: "Asignado a", kind: "text", placeholder: "Quién la ejecuta" },
  { moduleKey: "tareas", fieldKey: "prioridad", label: "Prioridad", kind: "status", required: true, options: [
    { value: "baja", label: "Baja" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" },
  ] },
  { moduleKey: "tareas", fieldKey: "fechaLimite", label: "Fecha límite", kind: "date" },
  { moduleKey: "tareas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "pendiente", label: "Pendiente" }, { value: "en_progreso", label: "En progreso" }, { value: "en_revision", label: "En revisión" }, { value: "completada", label: "Completada" }, { value: "cancelada", label: "Cancelada" },
  ] },
  { moduleKey: "tareas", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

  // Tickets
  { moduleKey: "tickets", fieldKey: "asunto", label: "Asunto", kind: "text", required: true },
  { moduleKey: "tickets", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "tickets", fieldKey: "categoria", label: "Categoría", kind: "text" },
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
  { moduleKey: "productos", fieldKey: "sku", label: "SKU / código", kind: "text" },
  { moduleKey: "productos", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "productos", fieldKey: "categoria", label: "Categoría", kind: "text" },
  { moduleKey: "productos", fieldKey: "tipo", label: "Tipo", kind: "status", options: [
    { value: "producto", label: "Producto" }, { value: "servicio", label: "Servicio" }, { value: "kit", label: "Kit" }, { value: "insumo", label: "Insumo" },
  ] },
  { moduleKey: "productos", fieldKey: "precio", label: "Precio (sin IVA)", kind: "money" },
  { moduleKey: "productos", fieldKey: "unidadMedida", label: "Unidad", kind: "text" },
  { moduleKey: "productos", fieldKey: "stock", label: "Stock", kind: "number" },
  { moduleKey: "productos", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }, { value: "discontinuado", label: "Discontinuado" },
  ] },

  // Reservas
  { moduleKey: "reservas", fieldKey: "recurso", label: "Recurso", kind: "text", required: true },
  { moduleKey: "reservas", fieldKey: "solicitante", label: "Solicitante", kind: "text", required: true },
  { moduleKey: "reservas", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "reservas", fieldKey: "horaInicio", label: "Hora inicio", kind: "text" },
  { moduleKey: "reservas", fieldKey: "horaFin", label: "Hora fin", kind: "text" },
  { moduleKey: "reservas", fieldKey: "motivo", label: "Motivo", kind: "text" },
  { moduleKey: "reservas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "solicitada", label: "Solicitada" }, { value: "confirmada", label: "Confirmada" }, { value: "en_uso", label: "En uso" }, { value: "completada", label: "Completada" }, { value: "cancelada", label: "Cancelada" },
  ] },

  // Encuestas
  { moduleKey: "encuestas", fieldKey: "titulo", label: "Encuesta", kind: "text", required: true },
  { moduleKey: "encuestas", fieldKey: "tipo", label: "Tipo", kind: "status", options: [
    { value: "satisfaccion", label: "Satisfacción" }, { value: "nps", label: "NPS" }, { value: "interna", label: "Interna" }, { value: "captacion", label: "Captación" },
  ] },
  { moduleKey: "encuestas", fieldKey: "publico", label: "Público", kind: "text" },
  { moduleKey: "encuestas", fieldKey: "preguntas", label: "Preguntas", kind: "textarea" },
  { moduleKey: "encuestas", fieldKey: "fechaInicio", label: "Inicio", kind: "date" },
  { moduleKey: "encuestas", fieldKey: "fechaFin", label: "Fin", kind: "date" },
  { moduleKey: "encuestas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "borrador", label: "Borrador" }, { value: "activa", label: "Activa" }, { value: "cerrada", label: "Cerrada" },
  ] },

  // Etiquetas
  { moduleKey: "etiquetas", fieldKey: "nombre", label: "Etiqueta", kind: "text", required: true },
  { moduleKey: "etiquetas", fieldKey: "color", label: "Color", kind: "text" },
  { moduleKey: "etiquetas", fieldKey: "aplicaA", label: "Aplica a", kind: "text" },
  { moduleKey: "etiquetas", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

  // Plantillas
  { moduleKey: "plantillas", fieldKey: "nombre", label: "Plantilla", kind: "text", required: true },
  { moduleKey: "plantillas", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "email", label: "Email" }, { value: "sms", label: "SMS" }, { value: "documento", label: "Documento" }, { value: "whatsapp", label: "WhatsApp" },
  ] },
  { moduleKey: "plantillas", fieldKey: "asunto", label: "Asunto", kind: "text" },
  { moduleKey: "plantillas", fieldKey: "contenido", label: "Contenido", kind: "textarea", required: true },
  { moduleKey: "plantillas", fieldKey: "idioma", label: "Idioma", kind: "text" },
  { moduleKey: "plantillas", fieldKey: "estado", label: "Estado", kind: "status", options: [
    { value: "activa", label: "Activa" }, { value: "borrador", label: "Borrador" }, { value: "archivada", label: "Archivada" },
  ] },

  // Caja
  { moduleKey: "caja", fieldKey: "ticket", label: "Nº ticket", kind: "text" },
  { moduleKey: "caja", fieldKey: "concepto", label: "Concepto", kind: "text", required: true },
  { moduleKey: "caja", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "caja", fieldKey: "metodoPago", label: "Pago", kind: "status", required: true, options: [
    { value: "efectivo", label: "Efectivo" }, { value: "tarjeta", label: "Tarjeta" }, { value: "bizum", label: "Bizum" }, { value: "transferencia", label: "Transferencia" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "caja", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "caja", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "caja", fieldKey: "cajero", label: "Cajero", kind: "text" },
  { moduleKey: "caja", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "cobrado", label: "Cobrado" }, { value: "pendiente", label: "Pendiente" }, { value: "anulado", label: "Anulado" }, { value: "devuelto", label: "Devuelto" },
  ] },
  { moduleKey: "caja", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // Bodegas
  { moduleKey: "bodegas", fieldKey: "nombre", label: "Bodega", kind: "text", required: true },
  { moduleKey: "bodegas", fieldKey: "ubicacion", label: "Ubicación", kind: "text" },
  { moduleKey: "bodegas", fieldKey: "responsable", label: "Responsable", kind: "text" },
  { moduleKey: "bodegas", fieldKey: "tipo", label: "Tipo", kind: "status", options: [
    { value: "central", label: "Central" }, { value: "tienda", label: "Tienda" }, { value: "transito", label: "En tránsito" }, { value: "consignacion", label: "Consignación" },
  ] },
  { moduleKey: "bodegas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" },
  ] },
  { moduleKey: "bodegas", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // Kardex
  { moduleKey: "kardex", fieldKey: "producto", label: "Producto", kind: "relation", relationModuleKey: "productos", required: true },
  { moduleKey: "kardex", fieldKey: "bodega", label: "Bodega", kind: "relation", relationModuleKey: "bodegas", required: true },
  { moduleKey: "kardex", fieldKey: "tipo", label: "Tipo movimiento", kind: "status", required: true, options: [
    { value: "entrada", label: "Entrada" }, { value: "salida", label: "Salida" }, { value: "traspaso", label: "Traspaso" }, { value: "ajuste", label: "Ajuste" },
  ] },
  { moduleKey: "kardex", fieldKey: "cantidad", label: "Cantidad", kind: "number", required: true },
  { moduleKey: "kardex", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "kardex", fieldKey: "motivo", label: "Motivo", kind: "text" },
  { moduleKey: "kardex", fieldKey: "documentoRef", label: "Doc referencia", kind: "text" },
  { moduleKey: "kardex", fieldKey: "responsable", label: "Responsable", kind: "text" },
  { moduleKey: "kardex", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "registrado", label: "Registrado" }, { value: "anulado", label: "Anulado" },
  ] },

  // H7-C1 Tipos de servicio
  { moduleKey: "tipos-servicio", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "tipos-servicio", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "tipos-servicio", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
  { moduleKey: "tipos-servicio", fieldKey: "esFacturable", label: "¿Facturable?", kind: "status", required: true, options: [
    { value: "si", label: "Sí" }, { value: "no", label: "No" },
  ] },

  // H7-C1 Catálogo actividades
  { moduleKey: "actividades-catalogo", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "actividades-catalogo", fieldKey: "nombre", label: "Actividad", kind: "text", required: true },
  { moduleKey: "actividades-catalogo", fieldKey: "tipoServicio", label: "Tipo servicio", kind: "relation", relationModuleKey: "tipos-servicio", required: true },
  { moduleKey: "actividades-catalogo", fieldKey: "tarifaHora", label: "Tarifa hora", kind: "money" },
  { moduleKey: "actividades-catalogo", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "archivada", label: "Archivada" },
  ] },

  // H7-C2 Empleados
  { moduleKey: "empleados", fieldKey: "codigoCorto", label: "Código", kind: "text", required: true },
  { moduleKey: "empleados", fieldKey: "nombre", label: "Nombre completo", kind: "text", required: true },
  { moduleKey: "empleados", fieldKey: "email", label: "Email", kind: "email" },
  { moduleKey: "empleados", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
  { moduleKey: "empleados", fieldKey: "rol", label: "Rol", kind: "text" },
  { moduleKey: "empleados", fieldKey: "fechaAlta", label: "Fecha alta", kind: "date" },
  { moduleKey: "empleados", fieldKey: "fechaBaja", label: "Fecha baja", kind: "date" },
  { moduleKey: "empleados", fieldKey: "esBaja", label: "¿Baja?", kind: "status", required: true, options: [
    { value: "no", label: "Activo" }, { value: "si", label: "Baja" },
  ] },
  { moduleKey: "empleados", fieldKey: "tarifaHora", label: "Tarifa hora", kind: "money" },
  { moduleKey: "empleados", fieldKey: "notas", label: "Notas", kind: "textarea" },

  // H7-C3 Actividades
  { moduleKey: "actividades", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "actividades", fieldKey: "empleado", label: "Empleado", kind: "relation", required: true, relationModuleKey: "empleados" },
  { moduleKey: "actividades", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
  { moduleKey: "actividades", fieldKey: "proyecto", label: "Proyecto", kind: "relation", relationModuleKey: "proyectos" },
  { moduleKey: "actividades", fieldKey: "actividad", label: "Actividad", kind: "relation", required: true, relationModuleKey: "actividades-catalogo" },
  { moduleKey: "actividades", fieldKey: "horaDesde", label: "Hora desde", kind: "text", required: true },
  { moduleKey: "actividades", fieldKey: "horaHasta", label: "Hora hasta", kind: "text", required: true },
  { moduleKey: "actividades", fieldKey: "tiempoHoras", label: "Tiempo (h)", kind: "number" },
  { moduleKey: "actividades", fieldKey: "lugar", label: "Lugar", kind: "status", required: true, options: [
    { value: "oficina", label: "Oficina" }, { value: "teletrabajo", label: "Teletrabajo" }, { value: "cliente", label: "Casa cliente" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "actividades", fieldKey: "descripcion", label: "Descripción", kind: "textarea", required: true },
  { moduleKey: "actividades", fieldKey: "tipoFacturacion", label: "Facturación", kind: "status", required: true, options: [
    { value: "contra-bolsa", label: "Contra bolsa" }, { value: "fuera-bolsa", label: "Fuera de bolsa" }, { value: "no-facturable", label: "No facturable" },
  ] },
  { moduleKey: "actividades", fieldKey: "urgencia", label: "Urgencia", kind: "relation", relationModuleKey: "tipos-urgencia" },
  { moduleKey: "actividades", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "borrador", label: "Borrador" }, { value: "validada", label: "Validada" }, { value: "facturada", label: "Facturada" },
  ] },

  // H7-C5 Gastos
  { moduleKey: "gastos", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "gastos", fieldKey: "empleado", label: "Empleado", kind: "relation", required: true, relationModuleKey: "empleados" },
  { moduleKey: "gastos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "kilometraje", label: "Kilometraje" }, { value: "dietas", label: "Dietas" }, { value: "aparcamiento", label: "Aparcamiento / peaje" }, { value: "alojamiento", label: "Alojamiento" }, { value: "transporte", label: "Transporte público" }, { value: "suplido", label: "Suplido cliente" }, { value: "material", label: "Material" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "gastos", fieldKey: "descripcion", label: "Descripción", kind: "text", required: true },
  { moduleKey: "gastos", fieldKey: "kilometros", label: "Km", kind: "number" },
  { moduleKey: "gastos", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "gastos", fieldKey: "justificante", label: "Justificante (URL)", kind: "text" },
  { moduleKey: "gastos", fieldKey: "repercutibleA", label: "Repercutir a cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "gastos", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "pendiente", label: "Pendiente" }, { value: "aprobado", label: "Aprobado" }, { value: "rechazado", label: "Rechazado" }, { value: "pagado", label: "Pagado" }, { value: "facturado", label: "Facturado al cliente" },
  ] },

  // H8-C2 Tipos de cliente
  { moduleKey: "tipos-cliente", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "tipos-cliente", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "tipos-cliente", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
  { moduleKey: "tipos-cliente", fieldKey: "esFacturable", label: "Facturable", kind: "status", required: true, options: [{ value: "si", label: "Sí" }, { value: "no", label: "No" }] },

  // H8-C3 Zonas comerciales
  { moduleKey: "zonas-comerciales", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "zonas-comerciales", fieldKey: "nombre", label: "Zona", kind: "text", required: true },
  { moduleKey: "zonas-comerciales", fieldKey: "agenteResponsable", label: "Agente", kind: "relation", relationModuleKey: "empleados" },
  { moduleKey: "zonas-comerciales", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [{ value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" }] },

  // H8-C4 Grupos
  { moduleKey: "grupos-empresa", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "grupos-empresa", fieldKey: "nombre", label: "Grupo", kind: "text", required: true },
  { moduleKey: "grupos-empresa", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
  { moduleKey: "grupos-empresa", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }] },

  // H8-C1 Puntos de venta
  { moduleKey: "puntos-venta", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "puntos-venta", fieldKey: "nombre", label: "Nombre punto", kind: "text", required: true },
  { moduleKey: "puntos-venta", fieldKey: "empresaPadre", label: "Empresa", kind: "relation", required: true, relationModuleKey: "clientes" },
  { moduleKey: "puntos-venta", fieldKey: "tipoCliente", label: "Tipo cliente", kind: "relation", relationModuleKey: "tipos-cliente" },
  { moduleKey: "puntos-venta", fieldKey: "direccion", label: "Dirección", kind: "text" },
  { moduleKey: "puntos-venta", fieldKey: "ciudad", label: "Ciudad", kind: "text" },
  { moduleKey: "puntos-venta", fieldKey: "zona", label: "Zona", kind: "relation", relationModuleKey: "zonas-comerciales" },
  { moduleKey: "puntos-venta", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
  { moduleKey: "puntos-venta", fieldKey: "email", label: "Email", kind: "email" },
  { moduleKey: "puntos-venta", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }] },

  // H8-C5 Clases de condición
  { moduleKey: "clases-condicion", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "clases-condicion", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "clases-condicion", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "precio", label: "Precio" }, { value: "descuento", label: "Descuento" }, { value: "comision", label: "Comisión" }, { value: "impuesto", label: "Impuesto" }, { value: "promocion", label: "Promoción" },
  ] },
  { moduleKey: "clases-condicion", fieldKey: "operador", label: "Operador", kind: "status", options: [
    { value: "porcentaje", label: "% sobre base" }, { value: "fijo", label: "Importe fijo" }, { value: "cascada", label: "Cascada" },
  ] },

  // H8-C5 Tarifas generales
  { moduleKey: "tarifas-generales", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "tarifas-generales", fieldKey: "nombre", label: "Tarifa", kind: "text", required: true },
  { moduleKey: "tarifas-generales", fieldKey: "claseCondicion", label: "Clase", kind: "relation", required: true, relationModuleKey: "clases-condicion" },
  { moduleKey: "tarifas-generales", fieldKey: "valor", label: "Valor", kind: "money", required: true },
  { moduleKey: "tarifas-generales", fieldKey: "fechaInicio", label: "Fecha inicio", kind: "date", required: true },
  { moduleKey: "tarifas-generales", fieldKey: "fechaFin", label: "Fecha fin", kind: "date" },
  { moduleKey: "tarifas-generales", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "vigor", label: "En vigor" }, { value: "futura", label: "Futura" }, { value: "obsoleta", label: "Obsoleta" },
  ] },

  // H8-C5 Tarifas especiales
  { moduleKey: "tarifas-especiales", fieldKey: "nombre", label: "Tarifa especial", kind: "text", required: true },
  { moduleKey: "tarifas-especiales", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "tarifas-especiales", fieldKey: "grupo", label: "Grupo", kind: "relation", relationModuleKey: "grupos-empresa" },
  { moduleKey: "tarifas-especiales", fieldKey: "claseCondicion", label: "Clase", kind: "relation", required: true, relationModuleKey: "clases-condicion" },
  { moduleKey: "tarifas-especiales", fieldKey: "valor", label: "Valor", kind: "money", required: true },
  { moduleKey: "tarifas-especiales", fieldKey: "fechaInicio", label: "Inicio", kind: "date", required: true },
  { moduleKey: "tarifas-especiales", fieldKey: "fechaFin", label: "Fin", kind: "date" },
  { moduleKey: "tarifas-especiales", fieldKey: "observaciones", label: "Observaciones", kind: "textarea" },
  { moduleKey: "tarifas-especiales", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "vigor", label: "En vigor" }, { value: "futura", label: "Futura" }, { value: "obsoleta", label: "Obsoleta" },
  ] },

  // H8-C6 Albaranes
  { moduleKey: "albaranes", fieldKey: "numero", label: "Nº albarán", kind: "text", required: true },
  { moduleKey: "albaranes", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "albaranes", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
  { moduleKey: "albaranes", fieldKey: "puntoVenta", label: "Punto", kind: "relation", relationModuleKey: "puntos-venta" },
  { moduleKey: "albaranes", fieldKey: "concepto", label: "Concepto", kind: "textarea" },
  { moduleKey: "albaranes", fieldKey: "importeBase", label: "Base", kind: "money" },
  { moduleKey: "albaranes", fieldKey: "iva", label: "IVA", kind: "money" },
  { moduleKey: "albaranes", fieldKey: "importeTotal", label: "Total", kind: "money", required: true },
  { moduleKey: "albaranes", fieldKey: "facturaGenerada", label: "Factura", kind: "relation", relationModuleKey: "facturacion" },
  { moduleKey: "albaranes", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "pendiente", label: "Pendiente facturar" }, { value: "facturado", label: "Facturado" }, { value: "anulado", label: "Anulado" },
  ] },

  // H8-C7 Vencimientos
  { moduleKey: "vencimientos-factura", fieldKey: "factura", label: "Factura", kind: "relation", required: true, relationModuleKey: "facturacion" },
  { moduleKey: "vencimientos-factura", fieldKey: "nVencimiento", label: "Nº vencim.", kind: "number", required: true },
  { moduleKey: "vencimientos-factura", fieldKey: "fecha", label: "Fecha vencimiento", kind: "date", required: true },
  { moduleKey: "vencimientos-factura", fieldKey: "importe", label: "Importe", kind: "money", required: true },
  { moduleKey: "vencimientos-factura", fieldKey: "formaPago", label: "Forma pago", kind: "status", options: [
    { value: "transferencia", label: "Transferencia" }, { value: "domiciliacion", label: "Domiciliación SEPA" }, { value: "pagare", label: "Pagaré" }, { value: "tarjeta", label: "Tarjeta" }, { value: "efectivo", label: "Efectivo" }, { value: "bizum", label: "Bizum" },
  ] },
  { moduleKey: "vencimientos-factura", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "pendiente", label: "Pendiente" }, { value: "cobrado", label: "Cobrado" }, { value: "devuelto", label: "Devuelto" }, { value: "incobrable", label: "Incobrable" },
  ] },
  { moduleKey: "vencimientos-factura", fieldKey: "fechaCobro", label: "Fecha cobro", kind: "date" },

  // H8-C10 Plan de avisos
  { moduleKey: "avisos-programados", fieldKey: "nombre", label: "Aviso", kind: "text", required: true },
  { moduleKey: "avisos-programados", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "avisos-programados", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
    { value: "renovacion", label: "Renovación" }, { value: "vencimiento", label: "Vencimiento" }, { value: "cumpleanos", label: "Cumpleaños" }, { value: "campania", label: "Campaña comercial" }, { value: "encuesta", label: "Encuesta" }, { value: "otro", label: "Otro" },
  ] },
  { moduleKey: "avisos-programados", fieldKey: "canal", label: "Canal", kind: "status", required: true, options: [
    { value: "email", label: "Email" }, { value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }, { value: "llamada", label: "Llamada" },
  ] },
  { moduleKey: "avisos-programados", fieldKey: "frecuencia", label: "Frecuencia", kind: "status", required: true, options: [
    { value: "unica", label: "Única" }, { value: "mensual", label: "Mensual" }, { value: "trimestral", label: "Trimestral" }, { value: "semestral", label: "Semestral" }, { value: "anual", label: "Anual" },
  ] },
  { moduleKey: "avisos-programados", fieldKey: "plantilla", label: "Plantilla", kind: "relation", relationModuleKey: "plantillas" },
  { moduleKey: "avisos-programados", fieldKey: "proximaFecha", label: "Próxima fecha", kind: "date", required: true },
  { moduleKey: "avisos-programados", fieldKey: "ultimaFecha", label: "Último envío", kind: "date" },
  { moduleKey: "avisos-programados", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activo", label: "Activo" }, { value: "pausado", label: "Pausado" }, { value: "completado", label: "Completado" },
  ] },

  // H8-S3 Tipos de urgencia
  { moduleKey: "tipos-urgencia", fieldKey: "codigo", label: "Código", kind: "text", required: true },
  { moduleKey: "tipos-urgencia", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
  { moduleKey: "tipos-urgencia", fieldKey: "nivel", label: "Nivel", kind: "number", required: true },
  { moduleKey: "tipos-urgencia", fieldKey: "recargoPct", label: "Recargo (%)", kind: "money" },
  { moduleKey: "tipos-urgencia", fieldKey: "color", label: "Color", kind: "text" },

  // H8-S5 Desplazamientos
  { moduleKey: "desplazamientos", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
  { moduleKey: "desplazamientos", fieldKey: "empleado", label: "Empleado", kind: "relation", required: true, relationModuleKey: "empleados" },
  { moduleKey: "desplazamientos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
  { moduleKey: "desplazamientos", fieldKey: "puntoVenta", label: "Punto", kind: "relation", relationModuleKey: "puntos-venta" },
  { moduleKey: "desplazamientos", fieldKey: "kilometros", label: "Km", kind: "number", required: true },
  { moduleKey: "desplazamientos", fieldKey: "precioFijo", label: "Precio fijo (€)", kind: "money" },
  { moduleKey: "desplazamientos", fieldKey: "precioKm", label: "Precio €/km", kind: "money" },
  { moduleKey: "desplazamientos", fieldKey: "importeTotal", label: "Total", kind: "money" },
  { moduleKey: "desplazamientos", fieldKey: "facturable", label: "Facturable", kind: "status", required: true, options: [{ value: "si", label: "Sí" }, { value: "no", label: "No" }] },
  { moduleKey: "desplazamientos", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "borrador", label: "Borrador" }, { value: "validado", label: "Validado" }, { value: "facturado", label: "Facturado" },
  ] },

  // H8.5 — Formas de pago
  { moduleKey: "formas-pago", fieldKey: "codigo", label: "Código", kind: "text", required: true, placeholder: "CONT, 30D, 60D, DOM5..." },
  { moduleKey: "formas-pago", fieldKey: "nombre", label: "Nombre", kind: "text", required: true, placeholder: "Contado, 30 días f.f., Domiciliación día 5..." },
  { moduleKey: "formas-pago", fieldKey: "diasAplazamiento", label: "Días aplazamiento", kind: "number", placeholder: "0, 30, 60, 90..." },
  { moduleKey: "formas-pago", fieldKey: "numVencimientos", label: "Nº vencimientos", kind: "number", placeholder: "1, 2, 3..." },
  { moduleKey: "formas-pago", fieldKey: "diaPagoTipo", label: "Día de pago", kind: "status", options: [
    { value: "fecha-factura", label: "Día desde fecha factura" },
    { value: "fin-mes", label: "Fin de mes" },
    { value: "dia-concreto", label: "Día concreto del mes" },
  ] },
  { moduleKey: "formas-pago", fieldKey: "diaConcreto", label: "Día concreto (1-31)", kind: "number", placeholder: "Solo si tipo=día concreto" },
  { moduleKey: "formas-pago", fieldKey: "generaGiroSepa", label: "¿Genera giro SEPA?", kind: "status", required: true, options: [
    { value: "no", label: "No" }, { value: "si", label: "Sí" },
  ] },
  { moduleKey: "formas-pago", fieldKey: "tipoGiroSepa", label: "Tipo giro SEPA", kind: "status", options: [
    { value: "core", label: "SEPA CORE (B2C — particulares)" },
    { value: "b2b", label: "SEPA B2B (empresas)" },
  ] },
  { moduleKey: "formas-pago", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
  { moduleKey: "formas-pago", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "obsoleta", label: "Obsoleta" },
  ] },

  // H8.5 — Cuentas bancarias de clientes / proveedores
  { moduleKey: "cuentas-bancarias", fieldKey: "titular", label: "Titular", kind: "text", required: true, placeholder: "Razón social del titular" },
  { moduleKey: "cuentas-bancarias", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
  { moduleKey: "cuentas-bancarias", fieldKey: "proveedor", label: "Proveedor (alternativa)", kind: "text", placeholder: "Razón social proveedor" },
  { moduleKey: "cuentas-bancarias", fieldKey: "iban", label: "IBAN", kind: "text", required: true, placeholder: "ES12 3456 7890 1234 5678 9012" },
  { moduleKey: "cuentas-bancarias", fieldKey: "bic", label: "BIC / SWIFT", kind: "text", placeholder: "BBVAESMM" },
  { moduleKey: "cuentas-bancarias", fieldKey: "banco", label: "Banco", kind: "text", placeholder: "BBVA, Santander, CaixaBank..." },
  { moduleKey: "cuentas-bancarias", fieldKey: "mandatoSepaRef", label: "Ref. mandato SEPA", kind: "text", placeholder: "MAN-2026-001 (auto si vacío)" },
  { moduleKey: "cuentas-bancarias", fieldKey: "mandatoSepaFecha", label: "Fecha firma mandato", kind: "date" },
  { moduleKey: "cuentas-bancarias", fieldKey: "mandatoSepaTipo", label: "Tipo mandato", kind: "status", options: [
    { value: "recurrente", label: "Recurrente (RCUR/RCUR)" }, { value: "unico", label: "Único (OOFF)" }, { value: "primera", label: "Primera (FRST)" },
  ] },
  { moduleKey: "cuentas-bancarias", fieldKey: "esPrincipal", label: "Cuenta principal", kind: "status", required: true, options: [
    { value: "si", label: "Sí" }, { value: "no", label: "No" },
  ] },
  { moduleKey: "cuentas-bancarias", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
    { value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" }, { value: "rechazada", label: "Rechazada" },
  ] },
  { moduleKey: "cuentas-bancarias", fieldKey: "notas", label: "Notas", kind: "textarea" },
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
  { moduleKey: "tipos-servicio", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "tipos-servicio", fieldKey: "nombre", label: "Nombre" },
  { moduleKey: "tipos-servicio", fieldKey: "esFacturable", label: "Facturable" },
  { moduleKey: "actividades-catalogo", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "actividades-catalogo", fieldKey: "nombre", label: "Actividad" },
  { moduleKey: "actividades-catalogo", fieldKey: "tipoServicio", label: "Tipo" },
  { moduleKey: "actividades-catalogo", fieldKey: "tarifaHora", label: "€/h" },
  { moduleKey: "actividades-catalogo", fieldKey: "estado", label: "Estado" },
  { moduleKey: "empleados", fieldKey: "codigoCorto", label: "Cód.", isPrimary: true },
  { moduleKey: "empleados", fieldKey: "nombre", label: "Nombre" },
  { moduleKey: "empleados", fieldKey: "rol", label: "Rol" },
  { moduleKey: "empleados", fieldKey: "email", label: "Email" },
  { moduleKey: "empleados", fieldKey: "esBaja", label: "Estado" },
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
  { moduleKey: "gastos", fieldKey: "fecha", label: "Fecha", isPrimary: true },
  { moduleKey: "gastos", fieldKey: "empleado", label: "Empleado" },
  { moduleKey: "gastos", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "gastos", fieldKey: "descripcion", label: "Descripción" },
  { moduleKey: "gastos", fieldKey: "importe", label: "Importe" },
  { moduleKey: "gastos", fieldKey: "estado", label: "Estado" },

  // H8 columns
  { moduleKey: "tipos-cliente", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "tipos-cliente", fieldKey: "nombre", label: "Tipo cliente" },
  { moduleKey: "tipos-cliente", fieldKey: "esFacturable", label: "Facturable" },

  { moduleKey: "zonas-comerciales", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "zonas-comerciales", fieldKey: "nombre", label: "Zona" },
  { moduleKey: "zonas-comerciales", fieldKey: "agenteResponsable", label: "Agente" },
  { moduleKey: "zonas-comerciales", fieldKey: "estado", label: "Estado" },

  { moduleKey: "grupos-empresa", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "grupos-empresa", fieldKey: "nombre", label: "Grupo" },
  { moduleKey: "grupos-empresa", fieldKey: "estado", label: "Estado" },

  { moduleKey: "puntos-venta", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "puntos-venta", fieldKey: "nombre", label: "Punto" },
  { moduleKey: "puntos-venta", fieldKey: "empresaPadre", label: "Empresa" },
  { moduleKey: "puntos-venta", fieldKey: "tipoCliente", label: "Tipo" },
  { moduleKey: "puntos-venta", fieldKey: "zona", label: "Zona" },
  { moduleKey: "puntos-venta", fieldKey: "estado", label: "Estado" },

  { moduleKey: "clases-condicion", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "clases-condicion", fieldKey: "nombre", label: "Clase" },
  { moduleKey: "clases-condicion", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "clases-condicion", fieldKey: "operador", label: "Operador" },

  { moduleKey: "tarifas-generales", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "tarifas-generales", fieldKey: "nombre", label: "Tarifa" },
  { moduleKey: "tarifas-generales", fieldKey: "claseCondicion", label: "Clase" },
  { moduleKey: "tarifas-generales", fieldKey: "valor", label: "Valor" },
  { moduleKey: "tarifas-generales", fieldKey: "fechaInicio", label: "Inicio" },
  { moduleKey: "tarifas-generales", fieldKey: "fechaFin", label: "Fin" },
  { moduleKey: "tarifas-generales", fieldKey: "estado", label: "Estado" },

  { moduleKey: "tarifas-especiales", fieldKey: "nombre", label: "Tarifa especial", isPrimary: true },
  { moduleKey: "tarifas-especiales", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "tarifas-especiales", fieldKey: "grupo", label: "Grupo" },
  { moduleKey: "tarifas-especiales", fieldKey: "claseCondicion", label: "Clase" },
  { moduleKey: "tarifas-especiales", fieldKey: "valor", label: "Valor" },
  { moduleKey: "tarifas-especiales", fieldKey: "estado", label: "Estado" },

  { moduleKey: "albaranes", fieldKey: "numero", label: "Nº", isPrimary: true },
  { moduleKey: "albaranes", fieldKey: "fecha", label: "Fecha" },
  { moduleKey: "albaranes", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "albaranes", fieldKey: "importeTotal", label: "Total" },
  { moduleKey: "albaranes", fieldKey: "estado", label: "Estado" },

  { moduleKey: "vencimientos-factura", fieldKey: "factura", label: "Factura", isPrimary: true },
  { moduleKey: "vencimientos-factura", fieldKey: "nVencimiento", label: "Nº" },
  { moduleKey: "vencimientos-factura", fieldKey: "fecha", label: "Fecha" },
  { moduleKey: "vencimientos-factura", fieldKey: "importe", label: "Importe" },
  { moduleKey: "vencimientos-factura", fieldKey: "formaPago", label: "Forma" },
  { moduleKey: "vencimientos-factura", fieldKey: "estado", label: "Estado" },

  { moduleKey: "avisos-programados", fieldKey: "nombre", label: "Aviso", isPrimary: true },
  { moduleKey: "avisos-programados", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "avisos-programados", fieldKey: "tipo", label: "Tipo" },
  { moduleKey: "avisos-programados", fieldKey: "canal", label: "Canal" },
  { moduleKey: "avisos-programados", fieldKey: "frecuencia", label: "Frec." },
  { moduleKey: "avisos-programados", fieldKey: "proximaFecha", label: "Próxima" },
  { moduleKey: "avisos-programados", fieldKey: "estado", label: "Estado" },

  { moduleKey: "tipos-urgencia", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "tipos-urgencia", fieldKey: "nombre", label: "Urgencia" },
  { moduleKey: "tipos-urgencia", fieldKey: "nivel", label: "Nivel" },
  { moduleKey: "tipos-urgencia", fieldKey: "recargoPct", label: "Recargo %" },

  { moduleKey: "desplazamientos", fieldKey: "fecha", label: "Fecha", isPrimary: true },
  { moduleKey: "desplazamientos", fieldKey: "empleado", label: "Empleado" },
  { moduleKey: "desplazamientos", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "desplazamientos", fieldKey: "kilometros", label: "Km" },
  { moduleKey: "desplazamientos", fieldKey: "importeTotal", label: "Total" },
  { moduleKey: "desplazamientos", fieldKey: "facturable", label: "Fact." },
  { moduleKey: "desplazamientos", fieldKey: "estado", label: "Estado" },

  // H8.5
  { moduleKey: "formas-pago", fieldKey: "codigo", label: "Cód.", isPrimary: true },
  { moduleKey: "formas-pago", fieldKey: "nombre", label: "Forma de pago" },
  { moduleKey: "formas-pago", fieldKey: "diasAplazamiento", label: "Días" },
  { moduleKey: "formas-pago", fieldKey: "numVencimientos", label: "Venc." },
  { moduleKey: "formas-pago", fieldKey: "generaGiroSepa", label: "SEPA" },
  { moduleKey: "formas-pago", fieldKey: "estado", label: "Estado" },

  { moduleKey: "cuentas-bancarias", fieldKey: "titular", label: "Titular", isPrimary: true },
  { moduleKey: "cuentas-bancarias", fieldKey: "cliente", label: "Cliente" },
  { moduleKey: "cuentas-bancarias", fieldKey: "iban", label: "IBAN" },
  { moduleKey: "cuentas-bancarias", fieldKey: "banco", label: "Banco" },
  { moduleKey: "cuentas-bancarias", fieldKey: "mandatoSepaRef", label: "Mandato" },
  { moduleKey: "cuentas-bancarias", fieldKey: "esPrincipal", label: "Princ." },
  { moduleKey: "cuentas-bancarias", fieldKey: "estado", label: "Estado" },
];

export const CORE_DEMO_DATA: Array<{ moduleKey: string; records: Array<Record<string, string>> }> = [
  { moduleKey: "tareas", records: [
    { titulo: "Revisar contratos pendientes", asignado: "Operador", prioridad: "media", fechaLimite: "2026-05-15", estado: "pendiente", descripcion: "Repaso mensual." },
  ]},
  { moduleKey: "tipos-servicio", records: [
    { codigo: "1", nombre: "Análisis, Consulting", esFacturable: "si" },
    { codigo: "2", nombre: "Programación", esFacturable: "si" },
    { codigo: "3", nombre: "Soporte a usuario, explotación", esFacturable: "si" },
    { codigo: "4", nombre: "Copias de seguridad, reinstalaciones", esFacturable: "si" },
    { codigo: "5", nombre: "Técnica de sistemas", esFacturable: "si" },
    { codigo: "6", nombre: "Otros servicios", esFacturable: "si" },
    { codigo: "7", nombre: "Actividad comercial", esFacturable: "no" },
    { codigo: "8", nombre: "Gestiones administrativas", esFacturable: "no" },
  ]},
  { moduleKey: "tipos-cliente", records: [
    { codigo: "ADM", nombre: "Administración", esFacturable: "si" },
    { codigo: "DST", nombre: "Distribuidor", esFacturable: "si" },
    { codigo: "GST", nombre: "Gestión", esFacturable: "si" },
    { codigo: "PRV", nombre: "Proveedor", esFacturable: "no" },
    { codigo: "FIN", nombre: "Cliente final", esFacturable: "si" },
  ]},
  { moduleKey: "zonas-comerciales", records: [
    { codigo: "OVI", nombre: "OVIEDO", estado: "activa" },
    { codigo: "NOR", nombre: "NORTE", estado: "activa" },
    { codigo: "CAN", nombre: "CANTABRIA", estado: "activa" },
    { codigo: "MAD", nombre: "MADRID", estado: "activa" },
  ]},
  { moduleKey: "grupos-empresa", records: [
    { codigo: "MN1", nombre: "Mantº N 1", estado: "activo" },
    { codigo: "MN2", nombre: "Mantº N 2", estado: "activo" },
    { codigo: "MXH", nombre: "Mensual x horas", estado: "activo" },
    { codigo: "TXH", nombre: "Trimestral x Horas", estado: "activo" },
    { codigo: "MQ", nombre: "Mensual Cuota", estado: "activo" },
  ]},
  { moduleKey: "clases-condicion", records: [
    { codigo: "1", nombre: "PRECIO BASE", tipo: "precio", operador: "fijo" },
    { codigo: "2", nombre: "DESCUENTO BASE", tipo: "descuento", operador: "porcentaje" },
    { codigo: "3", nombre: "COMISION base", tipo: "comision", operador: "porcentaje" },
    { codigo: "4", nombre: "PRECIO ESPECIAL (%)", tipo: "precio", operador: "porcentaje" },
    { codigo: "5", nombre: "DESCUENTO CASCADA", tipo: "descuento", operador: "cascada" },
    { codigo: "6", nombre: "I.V.A.", tipo: "impuesto", operador: "porcentaje" },
    { codigo: "7", nombre: "RECARGO EQUIVALENCIA", tipo: "impuesto", operador: "porcentaje" },
  ]},
  { moduleKey: "tipos-urgencia", records: [
    { codigo: "MU", nombre: "1-MUY URGENTE", nivel: "1", recargoPct: "50", color: "#dc2626" },
    { codigo: "U", nombre: "2-URGENTE", nivel: "2", recargoPct: "25", color: "#ea580c" },
    { codigo: "N", nombre: "3-NORMAL", nivel: "3", recargoPct: "0", color: "#475569" },
  ]},
  { moduleKey: "empleados", records: [
    { codigoCorto: "OP", nombre: "Operador principal", email: "operador@empresa.com", rol: "Administrador", esBaja: "no", tarifaHora: "55 EUR" },
  ]},
  // H8.5 — Formas de pago típicas españolas
  { moduleKey: "formas-pago", records: [
    { codigo: "CONT", nombre: "Contado", diasAplazamiento: "0", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Pago al recibir la factura.", estado: "activa" },
    { codigo: "30D", nombre: "30 días fecha factura", diasAplazamiento: "30", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Vencimiento a 30 días.", estado: "activa" },
    { codigo: "60D", nombre: "60 días fecha factura", diasAplazamiento: "60", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Vencimiento a 60 días.", estado: "activa" },
    { codigo: "90D", nombre: "90 días fecha factura", diasAplazamiento: "90", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Vencimiento a 90 días.", estado: "activa" },
    { codigo: "30-60", nombre: "30 / 60 días", diasAplazamiento: "30", numVencimientos: "2", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "2 vencimientos a 30 y 60 días.", estado: "activa" },
    { codigo: "30-60-90", nombre: "30 / 60 / 90 días", diasAplazamiento: "30", numVencimientos: "3", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "3 vencimientos a 30, 60 y 90 días.", estado: "activa" },
    { codigo: "DOM5", nombre: "Domiciliación día 5 mes siguiente", diasAplazamiento: "0", numVencimientos: "1", diaPagoTipo: "dia-concreto", diaConcreto: "5", generaGiroSepa: "si", tipoGiroSepa: "core", descripcion: "Recibo bancario al día 5 del mes siguiente.", estado: "activa" },
    { codigo: "DOM-FIN", nombre: "Domiciliación fin de mes", diasAplazamiento: "0", numVencimientos: "1", diaPagoTipo: "fin-mes", generaGiroSepa: "si", tipoGiroSepa: "core", descripcion: "Recibo bancario el último día del mes.", estado: "activa" },
    { codigo: "DOM-B2B", nombre: "Domiciliación B2B 30 días", diasAplazamiento: "30", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "si", tipoGiroSepa: "b2b", descripcion: "Recibo SEPA B2B (empresa a empresa) a 30 días.", estado: "activa" },
    { codigo: "PAG60", nombre: "Pagaré 60 días", diasAplazamiento: "60", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Pagaré con vencimiento 60 días.", estado: "activa" },
    { codigo: "CONFIRM", nombre: "Confirming proveedores", diasAplazamiento: "90", numVencimientos: "1", diaPagoTipo: "fecha-factura", generaGiroSepa: "no", descripcion: "Pago vía confirming bancario a 90 días.", estado: "activa" },
  ]},
  { moduleKey: "cuentas-bancarias", records: [
    { titular: "Cliente ejemplo S.L.", cliente: "", iban: "ES7621000418401234567891", bic: "CAIXESBBXXX", banco: "CaixaBank", mandatoSepaRef: "MAN-2026-001", mandatoSepaFecha: "2026-01-15", mandatoSepaTipo: "recurrente", esPrincipal: "si", estado: "activa" },
  ]},
];

/**
 * Aplica los core modules al config runtime: añade modules, fields y
 * tableColumns que no estén ya definidos en el pack del sector.
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
