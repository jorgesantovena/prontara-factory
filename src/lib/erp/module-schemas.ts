import {
  createEmptyValuesFromDefinition,
  defineModule,
  type FieldType,
  type ModuleDefinition,
  type ModuleFieldDefinition as ModuleField,
  type ModuleRecord,
} from "@/lib/erp/module-definition";

export type { FieldType, ModuleField, ModuleDefinition, ModuleRecord };

export type ModuleSchema = ModuleDefinition;

const CLIENTES_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "clientes",
  title: "Clientes",
  primaryField: "nombre",
  defaultSortField: "nombre",
  listColumns: [
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "telefono", label: "Telefono" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-basic",
  tags: ["core", "comercial"],
  fields: [
    {
      key: "nombre",
      label: "Nombre",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 120,
      placeholder: "Ejemplo: Acme Industrial",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      maxLength: 160,
      placeholder: "contacto@empresa.com",
    },
    {
      key: "telefono",
      label: "Telefono",
      type: "tel",
      placeholder: "+34 600 000 000",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "activo", label: "Activo" },
        { value: "seguimiento", label: "Seguimiento" },
        { value: "inactivo", label: "Inactivo" },
      ],
    },
    {
      key: "segmento",
      label: "Segmento",
      type: "text",
      maxLength: 60,
      placeholder: "Pyme, Enterprise, Retail...",
    },
    {
      key: "ultimoContacto",
      label: "Ultimo contacto",
      type: "date",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      maxLength: 1000,
      placeholder: "Informacion relevante sobre el registro",
    },
  ],
});

const CRM_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "crm",
  title: "CRM",
  primaryField: "empresa",
  defaultSortField: "empresa",
  listColumns: [
    { key: "empresa", label: "Empresa" },
    { key: "contacto", label: "Contacto" },
    { key: "fase", label: "Fase" },
    { key: "valorEstimado", label: "Valor" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["core", "comercial"],
  relations: [
    {
      key: "cliente",
      targetModule: "clientes",
      sourceField: "clienteId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Cliente vinculado",
    },
  ],
  fields: [
    {
      key: "empresa",
      label: "Empresa",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 120,
      placeholder: "Ejemplo: Binary Forge",
    },
    {
      key: "contacto",
      label: "Contacto",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 120,
      placeholder: "Nombre del contacto",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      maxLength: 160,
      placeholder: "contacto@empresa.com",
    },
    {
      key: "telefono",
      label: "Telefono",
      type: "tel",
      placeholder: "+34 600 000 000",
    },
    {
      key: "fase",
      label: "Fase",
      type: "select",
      required: true,
      options: [
        { value: "lead", label: "Lead" },
        { value: "contactado", label: "Contactado" },
        { value: "propuesta", label: "Propuesta" },
        { value: "negociacion", label: "Negociacion" },
        { value: "ganado", label: "Ganado" },
        { value: "perdido", label: "Perdido" },
      ],
    },
    {
      key: "valorEstimado",
      label: "Valor estimado",
      type: "text",
      pattern: "^\\d{1,3}([.,]\\d{3})*([.,]\\d{1,2})?(\\s?(EUR|€))?$|^\\d+([.,]\\d{1,2})?(\\s?(EUR|€))?$",
      patternMessage: "Introduce un importe numérico. Se admite separador de miles y decimales, con EUR o € opcional.",
      placeholder: "Ejemplo: 12000 EUR",
    },
    {
      key: "proximoPaso",
      label: "Proximo paso",
      type: "text",
      maxLength: 160,
      placeholder: "Ejemplo: enviar propuesta",
    },
    {
      key: "fechaSeguimiento",
      label: "Fecha seguimiento",
      type: "date",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      maxLength: 1000,
      placeholder: "Contexto comercial y observaciones",
    },
  ],
});

const CITAS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "citas",
  title: "Citas",
  primaryField: "paciente",
  defaultSortField: "fecha",
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-basic",
  tags: ["operacion"],
  fields: [
    {
      key: "paciente",
      label: "Paciente",
      type: "text",
      required: true,
      placeholder: "Selecciona un paciente",
    },
    {
      key: "profesional",
      label: "Profesional",
      type: "text",
      required: true,
      placeholder: "Ejemplo: Dra. Lopez",
    },
    {
      key: "tipoCita",
      label: "Tipo de cita",
      type: "select",
      required: true,
      options: [
        { value: "revision", label: "Revision" },
        { value: "higiene", label: "Higiene" },
        { value: "tratamiento", label: "Tratamiento" },
        { value: "presupuesto", label: "Presupuesto" },
      ],
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "programada", label: "Programada" },
        { value: "confirmada", label: "Confirmada" },
        { value: "atendida", label: "Atendida" },
        { value: "cancelada", label: "Cancelada" },
      ],
    },
    {
      key: "fecha",
      label: "Fecha",
      type: "date",
      required: true,
    },
    {
      key: "hora",
      label: "Hora",
      type: "text",
      required: true,
      placeholder: "Ejemplo: 10:30",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      placeholder: "Observaciones de la cita",
    },
  ],
});

const PROYECTOS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "proyectos",
  title: "Proyectos",
  primaryField: "nombre",
  defaultSortField: "nombre",
  listColumns: [
    { key: "nombre", label: "Nombre" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "estado", label: "Estado" },
    { key: "responsable", label: "Responsable" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["core", "operacion"],
  relations: [
    {
      key: "cliente",
      targetModule: "clientes",
      sourceField: "clienteId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Cliente vinculado",
    },
  ],
  fields: [
    {
      key: "nombre",
      label: "Nombre",
      type: "text",
      required: true,
      placeholder: "Ejemplo: Implantacion ERP cliente X",
    },
    {
      key: "cliente",
      label: "Cliente",
      type: "text",
      required: true,
      placeholder: "Ejemplo: Binary Forge",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "planificado", label: "Planificado" },
        { value: "en_marcha", label: "En marcha" },
        { value: "en_riesgo", label: "En riesgo" },
        { value: "bloqueado", label: "Bloqueado" },
        { value: "cerrado", label: "Cerrado" },
      ],
    },
    {
      key: "responsable",
      label: "Responsable",
      type: "text",
      placeholder: "Nombre del responsable",
    },
    {
      key: "fechaInicio",
      label: "Fecha inicio",
      type: "date",
    },
    {
      key: "fechaFin",
      label: "Fecha fin",
      type: "date",
    },
    {
      key: "prioridad",
      label: "Prioridad",
      type: "select",
      required: true,
      options: [
        { value: "alta", label: "Alta" },
        { value: "media", label: "Media" },
        { value: "baja", label: "Baja" },
      ],
    },
    {
      key: "presupuesto",
      label: "Presupuesto",
      type: "text",
      placeholder: "Ejemplo: 25000 EUR",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      placeholder: "Resumen del proyecto, hitos, riesgos y comentarios",
    },
  ],
});

const PRESUPUESTOS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "presupuestos",
  title: "Presupuestos",
  primaryField: "numero",
  defaultSortField: "numero",
  listColumns: [
    { key: "numero", label: "Numero" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "concepto", label: "Concepto" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["core", "comercial"],
  relations: [
    {
      key: "cliente",
      targetModule: "clientes",
      sourceField: "clienteId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Cliente vinculado",
    },
  ],
  fields: [
    {
      key: "numero",
      label: "Numero",
      type: "text",
      required: true,
      minLength: 3,
      maxLength: 40,
      pattern: "^[A-Za-z0-9/\\-_.]+$",
      patternMessage: "Usa solo letras, números, guiones, barras o puntos.",
      placeholder: "Ejemplo: PRE-2026-001",
    },
    {
      key: "cliente",
      label: "Cliente",
      type: "text",
      required: true,
      minLength: 2,
      placeholder: "Selecciona un cliente",
    },
    {
      key: "concepto",
      label: "Concepto",
      type: "text",
      required: true,
      minLength: 3,
      maxLength: 200,
      placeholder: "Ejemplo: Implantacion ERP",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "borrador", label: "Borrador" },
        { value: "enviado", label: "Enviado" },
        { value: "aceptado", label: "Aceptado" },
        { value: "rechazado", label: "Rechazado" },
      ],
    },
    {
      key: "importe",
      label: "Importe",
      type: "text",
      required: true,
      pattern: "^\\d{1,3}([.,]\\d{3})*([.,]\\d{1,2})?(\\s?(EUR|€))?$|^\\d+([.,]\\d{1,2})?(\\s?(EUR|€))?$",
      patternMessage: "Introduce un importe numérico. Se admite separador de miles y decimales, con EUR o € opcional.",
      helperText: "Solo números. Ejemplos válidos: 12000, 12.000,00, 12000 EUR.",
      placeholder: "Ejemplo: 12000 EUR",
    },
    {
      key: "fecha",
      label: "Fecha",
      type: "date",
    },
    {
      key: "validoHasta",
      label: "Valido hasta",
      type: "date",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      maxLength: 1000,
      placeholder: "Observaciones comerciales o alcance del presupuesto",
    },
  ],
});

const FACTURACION_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "facturacion",
  title: "Facturacion",
  primaryField: "numero",
  defaultSortField: "numero",
  listColumns: [
    { key: "numero", label: "Numero" },
    { key: "clienteNombre", label: "Cliente" },
    { key: "presupuestoNumero", label: "Presupuesto" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["core", "finanzas"],
  relations: [
    {
      key: "cliente",
      targetModule: "clientes",
      sourceField: "clienteId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Cliente vinculado",
    },
    {
      key: "presupuesto",
      targetModule: "presupuestos",
      sourceField: "presupuestoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Presupuesto relacionado",
    },
  ],
  fields: [
    {
      key: "numero",
      label: "Numero",
      type: "text",
      required: true,
      minLength: 3,
      maxLength: 40,
      pattern: "^[A-Za-z0-9/\\-_.]+$",
      patternMessage: "Usa solo letras, números, guiones, barras o puntos.",
      placeholder: "Ejemplo: FAC-2026-001",
    },
    {
      key: "cliente",
      label: "Cliente",
      type: "text",
      required: true,
      minLength: 2,
      placeholder: "Selecciona un cliente",
    },
    {
      key: "presupuesto",
      label: "Presupuesto relacionado",
      type: "text",
      placeholder: "Opcional",
    },
    {
      key: "concepto",
      label: "Concepto",
      type: "text",
      required: true,
      minLength: 3,
      maxLength: 200,
      placeholder: "Ejemplo: Implantacion ERP",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "pendiente", label: "Pendiente" },
        { value: "emitida", label: "Emitida" },
        { value: "cobrada", label: "Cobrada" },
        { value: "vencida", label: "Vencida" },
      ],
    },
    {
      key: "importe",
      label: "Importe",
      type: "text",
      required: true,
      pattern: "^\\d{1,3}([.,]\\d{3})*([.,]\\d{1,2})?(\\s?(EUR|€))?$|^\\d+([.,]\\d{1,2})?(\\s?(EUR|€))?$",
      patternMessage: "Introduce un importe numérico. Se admite separador de miles y decimales, con EUR o € opcional.",
      helperText: "Solo números. Ejemplos válidos: 18000, 18.000,00, 18000 EUR.",
      placeholder: "Ejemplo: 18000 EUR",
    },
    {
      key: "fechaEmision",
      label: "Fecha emision",
      type: "date",
    },
    {
      key: "fechaVencimiento",
      label: "Fecha vencimiento",
      type: "date",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      placeholder: "Observaciones de la factura",
    },
  ],
});

const DOCUMENTOS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "documentos",
  title: "Documentos",
  primaryField: "nombre",
  defaultSortField: "nombre",
  listColumns: [
    { key: "nombre", label: "Nombre" },
    { key: "tipo", label: "Tipo" },
    { key: "entidad", label: "Entidad" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-basic",
  tags: ["core", "documental"],
  fields: [
    {
      key: "nombre",
      label: "Nombre",
      type: "text",
      required: true,
      placeholder: "Ejemplo: Propuesta comercial",
    },
    {
      key: "tipo",
      label: "Tipo",
      type: "select",
      required: true,
      options: [
        { value: "propuesta", label: "Propuesta" },
        { value: "contrato", label: "Contrato" },
        { value: "factura", label: "Factura" },
        { value: "informe", label: "Informe" },
        { value: "otro", label: "Otro" },
      ],
    },
    {
      key: "entidad",
      label: "Entidad",
      type: "select",
      required: true,
      options: [
        { value: "cliente", label: "Cliente" },
        { value: "proyecto", label: "Proyecto" },
        { value: "presupuesto", label: "Presupuesto" },
        { value: "factura", label: "Factura" },
        { value: "general", label: "General" },
      ],
    },
    {
      key: "entidadId",
      label: "Entidad ID",
      type: "text",
      placeholder: "ID del registro relacionado",
    },
    {
      key: "estado",
      label: "Estado",
      type: "select",
      required: true,
      options: [
        { value: "borrador", label: "Borrador" },
        { value: "vigente", label: "Vigente" },
        { value: "archivado", label: "Archivado" },
      ],
    },
    {
      key: "fecha",
      label: "Fecha",
      type: "date",
    },
    {
      key: "notas",
      label: "Notas",
      type: "textarea",
      placeholder: "Descripcion o contexto del documento",
    },
  ],
});

const AJUSTES_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "ajustes",
  title: "Ajustes",
  primaryField: "nombre",
  defaultSortField: "nombre",
  listColumns: [
    { key: "nombre", label: "Nombre" },
    { key: "valor", label: "Valor" },
    { key: "descripcion", label: "Descripcion" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-basic",
  tags: ["core", "configuracion"],
  fields: [
    {
      key: "nombre",
      label: "Nombre",
      type: "text",
      required: true,
      placeholder: "Ejemplo: Configuracion general",
    },
    {
      key: "valor",
      label: "Valor",
      type: "text",
      required: true,
      placeholder: "Ejemplo: activa",
    },
    {
      key: "descripcion",
      label: "Descripcion",
      type: "textarea",
      placeholder: "Explicacion del ajuste",
    },
  ],
});

// =====================================================================
// Módulos del hub Producción
// =====================================================================
// Estos módulos se activan en verticales como Software Factory donde la
// fase de ejecución del proyecto requiere control granular: tareas,
// incidencias, partes de horas, releases, mantenimientos y justificantes
// que el cliente firma. Todos cuelgan de un proyecto.
//
// La página /produccion los orquesta en tabs filtrados por proyectoId,
// pero cada uno persiste por separado vía /api/erp/module igual que
// cualquier otro módulo del runtime — así reutilizan toda la
// infraestructura de validación, backups, auditoría y chat tools.

const TAREAS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "tareas",
  title: "Tareas",
  primaryField: "titulo",
  defaultSortField: "titulo",
  listColumns: [
    { key: "titulo", label: "Tarea" },
    { key: "proyecto", label: "Proyecto" },
    { key: "asignado", label: "Asignado" },
    { key: "estado", label: "Estado" },
    { key: "prioridad", label: "Prioridad" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "operacion"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto al que pertenece",
    },
  ],
  fields: [
    { key: "titulo", label: "Título", type: "text", required: true, maxLength: 200, placeholder: "Ej: Migrar tabla clientes a Postgres" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true, placeholder: "Nombre del proyecto" },
    { key: "asignado", label: "Asignado a", type: "text", placeholder: "Quién la lleva" },
    { key: "estado", label: "Estado", type: "select", required: true, options: [
      { value: "backlog", label: "Backlog" },
      { value: "en_curso", label: "En curso" },
      { value: "en_revision", label: "En revisión" },
      { value: "hecho", label: "Hecho" },
      { value: "bloqueada", label: "Bloqueada" },
    ]},
    { key: "prioridad", label: "Prioridad", type: "select", required: true, options: [
      { value: "alta", label: "Alta" },
      { value: "media", label: "Media" },
      { value: "baja", label: "Baja" },
    ]},
    { key: "horasEstimadas", label: "Horas estimadas", type: "text", placeholder: "8" },
    { key: "horasReales", label: "Horas reales", type: "text", placeholder: "0" },
    { key: "fechaLimite", label: "Fecha límite", type: "date" },
    { key: "descripcion", label: "Descripción", type: "textarea", maxLength: 4000, placeholder: "Detalle de lo que hay que hacer y criterios de aceptación" },
  ],
});

const INCIDENCIAS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "incidencias",
  title: "Incidencias",
  primaryField: "titulo",
  defaultSortField: "titulo",
  listColumns: [
    { key: "codigo", label: "Código" },
    { key: "titulo", label: "Título" },
    { key: "proyecto", label: "Proyecto" },
    { key: "severidad", label: "Severidad" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "soporte"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto afectado",
    },
  ],
  fields: [
    { key: "codigo", label: "Código", type: "text", placeholder: "INC-001 (autogenerado si vacío)" },
    { key: "titulo", label: "Título", type: "text", required: true, maxLength: 200, placeholder: "Resumen del problema" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "reportadoPor", label: "Reportado por", type: "text", placeholder: "Cliente / persona del equipo" },
    { key: "asignado", label: "Asignado a", type: "text", placeholder: "Quién resuelve" },
    { key: "severidad", label: "Severidad", type: "select", required: true, options: [
      { value: "critica", label: "Crítica" },
      { value: "alta", label: "Alta" },
      { value: "media", label: "Media" },
      { value: "baja", label: "Baja" },
    ]},
    { key: "tipo", label: "Tipo", type: "select", required: true, options: [
      { value: "bug", label: "Bug" },
      { value: "consulta", label: "Consulta" },
      { value: "mejora", label: "Mejora" },
      { value: "configuracion", label: "Configuración" },
    ]},
    { key: "estado", label: "Estado", type: "select", required: true, options: [
      { value: "abierta", label: "Abierta" },
      { value: "en_curso", label: "En curso" },
      { value: "esperando_cliente", label: "Esperando cliente" },
      { value: "resuelta", label: "Resuelta" },
      { value: "cerrada", label: "Cerrada" },
    ]},
    { key: "version", label: "Versión afectada", type: "text", placeholder: "Ej: v1.2.0" },
    { key: "fechaApertura", label: "Fecha apertura", type: "date" },
    { key: "fechaResolucion", label: "Fecha resolución", type: "date" },
    { key: "descripcion", label: "Descripción", type: "textarea", maxLength: 4000, placeholder: "Pasos para reproducir, comportamiento esperado, comportamiento actual" },
    { key: "solucion", label: "Solución aplicada", type: "textarea", maxLength: 2000, placeholder: "Qué se hizo para resolverla" },
  ],
});

const ACTIVIDADES_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "actividades",
  title: "Actividades",
  primaryField: "concepto",
  defaultSortField: "concepto",
  listColumns: [
    { key: "fecha", label: "Fecha" },
    { key: "persona", label: "Persona" },
    { key: "proyecto", label: "Proyecto" },
    { key: "concepto", label: "Concepto" },
    { key: "horas", label: "Horas" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "horas"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto al que se imputa",
    },
  ],
  fields: [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "persona", label: "Persona", type: "text", required: true, placeholder: "Quién trabajó" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "tareaRelacionada", label: "Tarea relacionada", type: "text", placeholder: "Título o código de la tarea (opcional)" },
    { key: "concepto", label: "Concepto", type: "text", required: true, maxLength: 200, placeholder: "Qué se hizo" },
    { key: "horas", label: "Horas", type: "text", required: true, placeholder: "1.5" },
    { key: "facturable", label: "Facturable", type: "select", required: true, options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
    ]},
    { key: "tipoTrabajo", label: "Tipo de trabajo", type: "select", required: true, options: [
      { value: "desarrollo", label: "Desarrollo" },
      { value: "analisis", label: "Análisis" },
      { value: "soporte", label: "Soporte" },
      { value: "reunion", label: "Reunión" },
      { value: "documentacion", label: "Documentación" },
      { value: "qa", label: "QA / Pruebas" },
      { value: "despliegue", label: "Despliegue" },
    ]},
    { key: "notas", label: "Notas", type: "textarea", maxLength: 1000 },
  ],
});

const VERSIONES_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "versiones",
  title: "Versiones",
  primaryField: "version",
  defaultSortField: "version",
  listColumns: [
    { key: "version", label: "Versión" },
    { key: "proyecto", label: "Proyecto" },
    { key: "estado", label: "Estado" },
    { key: "fechaPrevista", label: "Fecha prevista" },
    { key: "fechaEntrega", label: "Entrega" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "release"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto al que pertenece la versión",
    },
  ],
  fields: [
    { key: "version", label: "Versión", type: "text", required: true, placeholder: "v1.2.0" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "tipo", label: "Tipo", type: "select", required: true, options: [
      { value: "major", label: "Major (cambio grande)" },
      { value: "minor", label: "Minor (funcionalidad nueva)" },
      { value: "patch", label: "Patch (correcciones)" },
      { value: "hotfix", label: "Hotfix (urgente)" },
    ]},
    { key: "estado", label: "Estado", type: "select", required: true, options: [
      { value: "planificada", label: "Planificada" },
      { value: "en_desarrollo", label: "En desarrollo" },
      { value: "en_pruebas", label: "En pruebas" },
      { value: "publicada", label: "Publicada" },
      { value: "retirada", label: "Retirada" },
    ]},
    { key: "fechaPrevista", label: "Fecha prevista", type: "date" },
    { key: "fechaEntrega", label: "Fecha entrega real", type: "date" },
    { key: "responsable", label: "Responsable de la entrega", type: "text" },
    { key: "notasRelease", label: "Notas de release", type: "textarea", maxLength: 4000, placeholder: "Cambios incluidos, issues cerradas, breaking changes" },
    { key: "entornos", label: "Entornos donde se ha desplegado", type: "text", placeholder: "Pre / Pro / Cliente X" },
  ],
});

const MANTENIMIENTOS_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "mantenimientos",
  title: "Mantenimientos",
  primaryField: "nombre",
  defaultSortField: "nombre",
  listColumns: [
    { key: "nombre", label: "Tipo" },
    { key: "proyecto", label: "Proyecto" },
    { key: "modalidad", label: "Modalidad" },
    { key: "horasContratadas", label: "Horas contratadas" },
    { key: "horasConsumidas", label: "Horas consumidas" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "soporte"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto contratante",
    },
  ],
  fields: [
    { key: "nombre", label: "Nombre", type: "text", required: true, placeholder: "Ej: Bolsa horas evolutivo Acme" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "modalidad", label: "Modalidad", type: "select", required: true, options: [
      { value: "correctivo", label: "Correctivo (fallos)" },
      { value: "preventivo", label: "Preventivo (revisiones programadas)" },
      { value: "evolutivo", label: "Evolutivo (mejoras y nuevas features)" },
      { value: "adaptativo", label: "Adaptativo (cambios de entorno o normativa)" },
    ]},
    { key: "horasContratadas", label: "Horas contratadas", type: "text", required: true, placeholder: "40" },
    { key: "horasConsumidas", label: "Horas consumidas", type: "text", placeholder: "0" },
    { key: "tarifaHora", label: "Tarifa €/hora", type: "text", placeholder: "55 EUR" },
    { key: "vigenciaDesde", label: "Vigencia desde", type: "date" },
    { key: "vigenciaHasta", label: "Vigencia hasta", type: "date" },
    { key: "renovacion", label: "Renovación", type: "select", required: true, options: [
      { value: "manual", label: "Manual" },
      { value: "automatica", label: "Automática" },
    ]},
    { key: "notas", label: "Notas", type: "textarea", maxLength: 2000, placeholder: "Condiciones específicas, SLA, exclusiones" },
  ],
});

const JUSTIFICANTES_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "justificantes",
  title: "Justificantes",
  primaryField: "numero",
  defaultSortField: "numero",
  listColumns: [
    { key: "numero", label: "Nº" },
    { key: "proyecto", label: "Proyecto" },
    { key: "fecha", label: "Fecha" },
    { key: "horas", label: "Horas" },
    { key: "estado", label: "Estado" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "entrega"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "many-to-one",
      label: "Proyecto del que se justifica el servicio",
    },
  ],
  fields: [
    { key: "numero", label: "Número", type: "text", required: true, placeholder: "JUS-2026-001" },
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "personaResponsable", label: "Persona que firma por nuestra parte", type: "text", placeholder: "Project lead, técnico, etc." },
    { key: "personaCliente", label: "Persona del cliente que recibe", type: "text" },
    { key: "horas", label: "Horas justificadas", type: "text", required: true, placeholder: "8" },
    { key: "trabajos", label: "Trabajos realizados", type: "textarea", required: true, maxLength: 4000, placeholder: "Detalle de las actividades del periodo justificado" },
    { key: "version", label: "Versión entregada", type: "text", placeholder: "v1.2.0 (opcional)" },
    { key: "estado", label: "Estado", type: "select", required: true, options: [
      { value: "borrador", label: "Borrador" },
      { value: "enviado", label: "Enviado al cliente" },
      { value: "firmado", label: "Firmado" },
      { value: "rechazado", label: "Rechazado" },
    ]},
    { key: "notas", label: "Notas", type: "textarea", maxLength: 2000 },
  ],
});

const DESCRIPCIONES_PROYECTO_SCHEMA: ModuleSchema = defineModule({
  moduleKey: "descripciones-proyecto",
  title: "Descripciones de proyecto",
  primaryField: "proyecto",
  defaultSortField: "proyecto",
  listColumns: [
    { key: "proyecto", label: "Proyecto" },
    { key: "objetivoNegocio", label: "Objetivo" },
    { key: "alcance", label: "Alcance" },
    { key: "estadoSituacional", label: "Situación" },
  ],
  allowedActions: ["list", "create", "edit", "delete", "view"],
  seedStrategy: "demo-related",
  tags: ["produccion", "scope"],
  relations: [
    {
      key: "proyecto",
      targetModule: "proyectos",
      sourceField: "proyectoId",
      targetField: "id",
      cardinality: "one-to-one",
      label: "Proyecto descrito",
    },
  ],
  fields: [
    { key: "proyecto", label: "Proyecto", type: "text", required: true },
    { key: "objetivoNegocio", label: "Objetivo de negocio", type: "textarea", maxLength: 2000, placeholder: "Qué problema de negocio resolvemos para el cliente" },
    { key: "alcance", label: "Alcance del proyecto", type: "textarea", maxLength: 4000, placeholder: "Qué entra (módulos, integraciones, perfiles) y qué NO entra (fuera de alcance)" },
    { key: "restricciones", label: "Restricciones / dependencias", type: "textarea", maxLength: 2000, placeholder: "Tecnológicas, regulatorias, de calendario, dependencias del cliente" },
    { key: "equipo", label: "Equipo asignado", type: "textarea", maxLength: 1000, placeholder: "Roles y personas: project lead, devs, QA, soporte..." },
    { key: "riesgos", label: "Riesgos identificados", type: "textarea", maxLength: 2000, placeholder: "Lista de riesgos con probabilidad e impacto" },
    { key: "estadoSituacional", label: "Estado situacional actual", type: "select", required: true, options: [
      { value: "verde", label: "Verde — todo bien" },
      { value: "ambar", label: "Ámbar — con avisos" },
      { value: "rojo", label: "Rojo — en problemas" },
    ]},
    { key: "ultimaActualizacion", label: "Última actualización", type: "date" },
  ],
});

const SCHEMAS: Record<string, ModuleSchema> = {
  clientes: CLIENTES_SCHEMA,
  crm: CRM_SCHEMA,
  citas: CITAS_SCHEMA,
  proyectos: PROYECTOS_SCHEMA,
  presupuestos: PRESUPUESTOS_SCHEMA,
  facturacion: FACTURACION_SCHEMA,
  documentos: DOCUMENTOS_SCHEMA,
  ajustes: AJUSTES_SCHEMA,
  // Hub Producción
  tareas: TAREAS_SCHEMA,
  incidencias: INCIDENCIAS_SCHEMA,
  actividades: ACTIVIDADES_SCHEMA,
  versiones: VERSIONES_SCHEMA,
  mantenimientos: MANTENIMIENTOS_SCHEMA,
  justificantes: JUSTIFICANTES_SCHEMA,
  "descripciones-proyecto": DESCRIPCIONES_PROYECTO_SCHEMA,
};

export function getModuleSchema(moduleKey: string): ModuleSchema | null {
  return SCHEMAS[moduleKey] || null;
}

export function listSupportedModuleSchemas(): ModuleSchema[] {
  return Object.values(SCHEMAS);
}

export function createEmptyRecordFromSchema(schema: ModuleSchema): Record<string, string> {
  return createEmptyValuesFromDefinition(schema);
}