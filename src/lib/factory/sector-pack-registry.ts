import type { SectorPackDefinition } from "@/lib/factory/sector-pack-definition";
import { readVerticalOverride } from "@/lib/factory/sector-pack-override-store";
import { applyVerticalOverride } from "@/lib/factory/sector-pack-override-merge";

const CLINICA_DENTAL_PACK: SectorPackDefinition = {
  key: "clinica-dental",
  label: "Clínica dental",
  sector: "salud",
  businessType: "clinica-dental",
  description: "ERP sectorial para clínicas dentales pequeñas: pacientes, citas, presupuestos firmados, tratamientos en marcha, RX y consentimientos digitales.",
  branding: {
    displayName: "Prontara Dental",
    shortName: "PD",
    accentColor: "#0f766e",
    logoHint: "clínico, limpio, cercano y profesional",
    tone: "sectorial",
  },
  labels: {
    clientes: "Pacientes",
    crm: "Captación",
    proyectos: "Tratamientos",
    presupuestos: "Presupuestos",
    facturacion: "Facturas",
    documentos: "Historia clínica",
    ajustes: "Ajustes",
    asistente: "Asistente",
  },
  renameMap: {
    cliente: "paciente",
    clientes: "pacientes",
    proyecto: "tratamiento",
    proyectos: "tratamientos",
    documento: "documento clínico",
    documentos: "historia clínica",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Pacientes", navigationLabel: "Pacientes", emptyState: "Todavía no hay pacientes." },
    { moduleKey: "crm", enabled: true, label: "Captación", navigationLabel: "Captación", emptyState: "Sin leads en captación." },
    { moduleKey: "proyectos", enabled: true, label: "Tratamientos y citas", navigationLabel: "Tratamientos", emptyState: "Sin tratamientos activos." },
    { moduleKey: "presupuestos", enabled: true, label: "Presupuestos", navigationLabel: "Presupuestos", emptyState: "Sin presupuestos abiertos." },
    { moduleKey: "facturacion", enabled: true, label: "Facturas", navigationLabel: "Facturas", emptyState: "Sin facturas emitidas." },
    { moduleKey: "documentos", enabled: true, label: "Historia clínica", navigationLabel: "Historia clínica", emptyState: "Sin documentos clínicos." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu clínica." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
  ],
  entities: [
    { key: "paciente", label: "Paciente", description: "Paciente de la clínica con su historia clínica.", moduleKey: "clientes", primaryFields: ["nombre", "telefono", "email", "fecha_nacimiento", "alergias"], relatedTo: ["tratamiento", "cita", "presupuesto", "factura", "documento"] },
    { key: "doctor", label: "Doctor / Higienista", description: "Profesional de la clínica.", moduleKey: "clientes", primaryFields: ["nombre", "especialidad", "colegiado"], relatedTo: ["tratamiento", "cita"] },
    { key: "tratamiento", label: "Tratamiento", description: "Tratamiento clínico en curso (puede tener varias citas).", moduleKey: "proyectos", primaryFields: ["nombre", "paciente", "doctor", "estado"], relatedTo: ["paciente", "cita", "documento", "factura"] },
    { key: "cita", label: "Cita", description: "Cita agendada del paciente con el doctor.", moduleKey: "proyectos", primaryFields: ["fecha", "paciente", "tratamiento", "doctor", "estado"], relatedTo: ["paciente", "tratamiento", "doctor"] },
    { key: "presupuesto", label: "Presupuesto", description: "Presupuesto del tratamiento (firmado o pendiente).", moduleKey: "presupuestos", primaryFields: ["numero", "paciente", "concepto", "importe", "estado"], relatedTo: ["paciente", "tratamiento", "factura"] },
    { key: "factura", label: "Factura", description: "Factura emitida al paciente.", moduleKey: "facturacion", primaryFields: ["numero", "paciente", "importe", "estado"], relatedTo: ["paciente", "tratamiento"] },
    { key: "documento", label: "Documento clínico", description: "RX, consentimientos informados, informes, antecedentes.", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "paciente"], relatedTo: ["paciente", "tratamiento"] },
  ],
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Paciente", kind: "text", required: true, placeholder: "Nombre y apellidos" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "paciente@email.com" },
    { moduleKey: "clientes", fieldKey: "fecha_nacimiento", label: "Fecha de nacimiento", kind: "date" },
    { moduleKey: "clientes", fieldKey: "alergias", label: "Alergias / antecedentes médicos", kind: "textarea", placeholder: "Alergias relevantes, medicación, embarazo..." },
    { moduleKey: "clientes", fieldKey: "doctor_referente", label: "Doctor referente", kind: "text", placeholder: "Doctor habitual" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / inactivo / nuevo" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Tratamiento o cita", kind: "text", required: true, placeholder: "Ortodoncia superior, Limpieza..." },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "tratamiento (largo) / cita (puntual)" },
    { moduleKey: "proyectos", fieldKey: "fecha", label: "Fecha y hora (si es cita)", kind: "text", placeholder: "2026-05-08 11:30" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Paciente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "proyectos", fieldKey: "doctor", label: "Doctor", kind: "text", placeholder: "Quién atiende" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "planificado / en_marcha / completado / cancelado" },
    { moduleKey: "proyectos", fieldKey: "duracion", label: "Duración", kind: "text", placeholder: "30 min / 1h" },

    { moduleKey: "presupuestos", fieldKey: "numero", label: "Número", kind: "text", required: true, placeholder: "PRE-DEN-001" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Paciente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Tratamiento propuesto", kind: "textarea", required: true, placeholder: "Detalle del tratamiento y fases" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "1200 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "borrador / enviado / firmado / rechazado" },
    { moduleKey: "presupuestos", fieldKey: "fecha_firma", label: "Fecha firma", kind: "date" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº factura", kind: "text", required: true, placeholder: "FAC-DEN-2026-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Paciente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", placeholder: "Fase del tratamiento" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "350 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitida / cobrada / vencida" },

    // CRM (oportunidades) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible paciente", kind: "text", required: true, placeholder: "Familia / persona interesada" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "contacto@email.com" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen", kind: "text", placeholder: "Recomendación / Google / Instagram" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "lead / visitado / paciente / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "visitado", label: "Visitado" },
      { value: "paciente", label: "Paciente" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Llamar para agendar revisión, enviar presupuesto..." },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", kind: "text", required: true, placeholder: "Consentimiento ortodoncia, Radiografía..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, placeholder: "consentimiento / historia / radiografia / receta / informe", options: [
      { value: "consentimiento", label: "Consentimiento" },
      { value: "historia", label: "Historia clínica" },
      { value: "radiografia", label: "Radiografía" },
      { value: "receta", label: "Receta" },
      { value: "informe", label: "Informe" },
    ] },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Paciente", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha", kind: "date" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "borrador / vigente / archivado", options: [
      { value: "borrador", label: "Borrador" },
      { value: "vigente", label: "Vigente" },
      { value: "archivado", label: "Archivado" },
    ] },
  ],
  tableColumns: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Paciente", isPrimary: true },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "clientes", fieldKey: "doctor_referente", label: "Doctor" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado" },
    { moduleKey: "proyectos", fieldKey: "fecha", label: "Cuándo", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Paciente" },
    { moduleKey: "proyectos", fieldKey: "nombre", label: "Tratamiento" },
    { moduleKey: "proyectos", fieldKey: "doctor", label: "Doctor" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Paciente" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Paciente" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },

    // CRM (oportunidades) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible paciente", isPrimary: true },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Paciente" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado" },
  ],
  dashboardPriorities: [
    { key: "proyectos", label: "Citas de hoy", description: "Citas agendadas hoy en la clínica.", order: 1 },
    { key: "presupuestos", label: "Presupuestos sin firmar", description: "Tratamientos esperando que el paciente firme.", order: 2 },
    { key: "facturas", label: "Facturas vencidas", description: "Cobros pendientes que necesitan seguimiento.", order: 3 },
    { key: "clientes", label: "Pacientes activos", description: "Pacientes en seguimiento.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Últimos movimientos.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "Marta Sánchez Pérez", telefono: "+34 600 111 001", email: "marta@email.com", fecha_nacimiento: "1985-03-12", alergias: "Penicilina", doctor_referente: "Dra. Castro", estado: "activo" },
      { nombre: "Luis Gómez Aragón", telefono: "+34 600 111 002", email: "luis@email.com", fecha_nacimiento: "1972-08-25", alergias: "Ninguna conocida", doctor_referente: "Dr. Romero", estado: "activo" },
      { nombre: "Carmen López Vidal", telefono: "+34 600 111 003", email: "carmen@email.com", fecha_nacimiento: "1990-11-04", alergias: "Látex", doctor_referente: "Dra. Castro", estado: "activo" },
      { nombre: "Iván Pereda Núñez", telefono: "+34 600 111 004", email: "ivan@email.com", fecha_nacimiento: "1995-02-19", alergias: "Ninguna", doctor_referente: "Dr. Romero", estado: "nuevo" },
      { nombre: "Lucía Bermúdez Soto", telefono: "+34 600 111 005", email: "lucia@email.com", fecha_nacimiento: "1968-06-30", alergias: "Antiinflamatorios", doctor_referente: "Dra. Castro", estado: "activo" },
      { nombre: "Pablo Méndez Ríos", telefono: "+34 600 111 006", email: "pablo@email.com", fecha_nacimiento: "2010-09-14", alergias: "Ninguna", doctor_referente: "Dr. Romero", estado: "inactivo" },
    ]},
    { moduleKey: "crm", records: [
      { nombre: "Familia Suárez (revisión 4 personas)", telefono: "+34 600 222 001", email: "suarez@email.com", origen: "Recomendación de Marta Sánchez", estado: "lead", proximoPaso: "Llamar para agendar primera revisión" },
      { nombre: "Ana Torres", telefono: "+34 600 222 002", email: "ana@email.com", origen: "Google", estado: "visitado", proximoPaso: "Enviar presupuesto de blanqueamiento" },
    ]},
    { moduleKey: "proyectos", records: [
      { nombre: "Ortodoncia superior (12 meses)", tipo: "tratamiento", cliente: "Marta Sánchez Pérez", doctor: "Dra. Castro", estado: "en_marcha" },
      { nombre: "Implante molar 26", tipo: "tratamiento", cliente: "Luis Gómez Aragón", doctor: "Dr. Romero", estado: "planificado" },
      { nombre: "Endodoncia 36", tipo: "tratamiento", cliente: "Carmen López Vidal", doctor: "Dra. Castro", estado: "completado" },
      { nombre: "Marta Sánchez - Revisión brackets", tipo: "cita", fecha: "2026-04-29 09:30", cliente: "Marta Sánchez Pérez", doctor: "Dra. Castro", duracion: "30 min", estado: "planificado" },
      { nombre: "Iván Pereda - Primera visita", tipo: "cita", fecha: "2026-04-29 11:00", cliente: "Iván Pereda Núñez", doctor: "Dr. Romero", duracion: "45 min", estado: "planificado" },
      { nombre: "Luis Gómez - Toma impresiones implante", tipo: "cita", fecha: "2026-04-29 17:00", cliente: "Luis Gómez Aragón", doctor: "Dr. Romero", duracion: "1h", estado: "planificado" },
      { nombre: "Lucía Bermúdez - Limpieza anual", tipo: "cita", fecha: "2026-05-02 10:00", cliente: "Lucía Bermúdez Soto", doctor: "Dra. Castro", duracion: "45 min", estado: "planificado" },
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "PRE-DEN-2026-014", cliente: "Luis Gómez Aragón", concepto: "Implante molar 26 (toma impresiones, cirugía, corona)", importe: "1.250 EUR", estado: "firmado", fecha_firma: "2026-04-15" },
      { numero: "PRE-DEN-2026-015", cliente: "Carmen López Vidal", concepto: "Blanqueamiento dental + reconstrucción 22", importe: "480 EUR", estado: "enviado" },
      { numero: "PRE-DEN-2026-016", cliente: "Iván Pereda Núñez", concepto: "Plan inicial de ortodoncia (estudio + brackets)", importe: "2.800 EUR", estado: "borrador" },
      { numero: "PRE-DEN-2026-017", cliente: "Marta Sánchez Pérez", concepto: "Fase 2 ortodoncia + retención", importe: "850 EUR", estado: "enviado" },
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "FAC-DEN-2026-031", cliente: "Marta Sánchez Pérez", concepto: "Fase 1 ortodoncia (mes 1-6)", importe: "850 EUR", estado: "cobrada" },
      { numero: "FAC-DEN-2026-032", cliente: "Carmen López Vidal", concepto: "Endodoncia 36 + corona temporal", importe: "420 EUR", estado: "cobrada" },
      { numero: "FAC-DEN-2026-033", cliente: "Luis Gómez Aragón", concepto: "Implante molar - 50% inicial", importe: "625 EUR", estado: "emitida" },
      { numero: "FAC-DEN-2026-034", cliente: "Lucía Bermúdez Soto", concepto: "Limpieza anual + revisión", importe: "75 EUR", estado: "vencida" },
      { numero: "FAC-DEN-2026-035", cliente: "Marta Sánchez Pérez", concepto: "Revisión mensual brackets - abril", importe: "65 EUR", estado: "emitida" },
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Consentimiento informado ortodoncia Marta", tipo: "consentimiento", cliente: "Marta Sánchez Pérez", estado: "firmado" },
      { nombre: "Ortopantomografía Marta 2026-01", tipo: "rx", cliente: "Marta Sánchez Pérez", estado: "vigente" },
      { nombre: "Consentimiento implante Luis", tipo: "consentimiento", cliente: "Luis Gómez Aragón", estado: "firmado" },
      { nombre: "TAC 3D molar 26 Luis", tipo: "rx", cliente: "Luis Gómez Aragón", estado: "vigente" },
      { nombre: "Antecedentes médicos Carmen", tipo: "informe", cliente: "Carmen López Vidal", estado: "vigente" },
      { nombre: "Consentimiento RGPD Iván", tipo: "rgpd", cliente: "Iván Pereda Núñez", estado: "firmado" },
    ]},
  ],
  landing: {
    headline: "Pacientes, citas, tratamientos y RX en un solo entorno.",
    subheadline: "ERP online claro para clínicas dentales pequeñas y medianas: agenda diaria, presupuestos firmables digitalmente, historia clínica con RX y facturación con IVA.",
    bullets: [
      "Agenda con citas, doctor y duración de cada visita",
      "Presupuestos firmables digitalmente por el paciente",
      "Historia clínica con consentimientos, RX y antecedentes",
      "Facturación con IVA y detección de cobros vencidos",
    ],
    cta: "Activa tu clínica online",
  },
  assistantCopy: {
    welcome: "Te ayudo con la agenda de la clínica, presupuestos firmados, tratamientos en marcha y facturas. Puedo decirte qué citas hay hoy, qué presupuestos llevan más de 30 días sin firmarse o qué pacientes no han venido a su revisión anual.",
    suggestion: "¿Qué citas tengo hoy y mañana?",
  },
};

const SOFTWARE_FACTORY_PACK: SectorPackDefinition = {
  key: "software-factory",
  label: "Software factory",
  sector: "tecnologia",
  businessType: "software-factory",
  description: "ERP sectorial para software factories pequeñas.",
  branding: {
    displayName: "Prontara Tech",
    shortName: "PT",
    accentColor: "#2563eb",
    logoHint: "digital, técnico, limpio",
    tone: "professional",
  },
  labels: {
    clientes: "Clientes",
    crm: "Oportunidades",
    proyectos: "Proyectos",
    presupuestos: "Propuestas",
    facturacion: "Facturas",
    documentos: "Entregables",
    ajustes: "Ajustes",
    asistente: "Asistente",
    "catalogo-servicios": "Catálogo de servicios",
  },
  renameMap: {
    proyecto: "proyecto",
    proyectos: "proyectos",
    documento: "entregable",
    documentos: "entregables",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Clientes", navigationLabel: "Clientes", emptyState: "Todavía no hay clientes." },
    { moduleKey: "crm", enabled: true, label: "Oportunidades", navigationLabel: "Oportunidades", emptyState: "Todavía no hay oportunidades." },
    { moduleKey: "proyectos", enabled: true, label: "Proyectos", navigationLabel: "Proyectos", emptyState: "Todavía no hay proyectos." },
    { moduleKey: "presupuestos", enabled: true, label: "Propuestas", navigationLabel: "Propuestas", emptyState: "Todavía no hay propuestas." },
    { moduleKey: "facturacion", enabled: true, label: "Facturas", navigationLabel: "Facturas", emptyState: "Todavía no hay facturas." },
    { moduleKey: "documentos", enabled: true, label: "Entregables", navigationLabel: "Entregables", emptyState: "Todavía no hay entregables." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu software factory." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
    // Hub Producción — solo en Software Factory por ahora
    { moduleKey: "tareas", enabled: true, label: "Tareas", navigationLabel: "Tareas", emptyState: "Sin tareas en este proyecto." },
    { moduleKey: "incidencias", enabled: true, label: "Incidencias", navigationLabel: "Incidencias", emptyState: "Sin incidencias abiertas." },
    { moduleKey: "actividades", enabled: true, label: "Parte de horas", navigationLabel: "Parte de horas", emptyState: "Sin horas imputadas." },
    { moduleKey: "versiones", enabled: true, label: "Versiones", navigationLabel: "Versiones", emptyState: "Sin versiones publicadas." },
    { moduleKey: "mantenimientos", enabled: true, label: "Mantenimientos", navigationLabel: "Mantenimientos", emptyState: "Sin contratos de mantenimiento activos." },
    { moduleKey: "justificantes", enabled: true, label: "Justificantes", navigationLabel: "Justificantes", emptyState: "Sin justificantes emitidos." },
    { moduleKey: "descripciones-proyecto", enabled: true, label: "Descripción del proyecto", navigationLabel: "Descripción", emptyState: "Sin descripción técnica del proyecto." },
    // Catálogo de tipos de servicio (líneas estándar contratables: INST, MANT, NUEDES, SOP, FORM, ...)
    { moduleKey: "catalogo-servicios", enabled: true, label: "Catálogo de servicios", navigationLabel: "Catálogo", emptyState: "Aún no hay tipos de servicio definidos." },
  ],
  entities: [
    { key: "cliente", label: "Cliente", description: "Cliente de la software factory.", moduleKey: "clientes", primaryFields: ["nombre", "email", "telefono"], relatedTo: ["oportunidad", "proyecto", "propuesta", "factura", "entregable"] },
    { key: "oportunidad", label: "Oportunidad", description: "Seguimiento comercial.", moduleKey: "crm", primaryFields: ["empresa", "contacto", "fase", "valor"], relatedTo: ["cliente", "propuesta"] },
    { key: "proyecto", label: "Proyecto", description: "Proyecto técnico en marcha.", moduleKey: "proyectos", primaryFields: ["nombre", "cliente", "responsable", "estado"], relatedTo: ["cliente", "entregable", "factura"] },
    { key: "entregable", label: "Entregable", description: "Documento o entregable del proyecto.", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "cliente"], relatedTo: ["cliente", "proyecto"] },
    {
      key: "tipoServicio",
      label: "Tipo de servicio",
      description:
        "Línea de servicio estándar que se asigna a clientes (INST, MANT, NUEDES, SOP, FORM, etc.). Define defaults de facturación y vigencia que cada proyecto cliente hereda y puede sobrescribir.",
      moduleKey: "catalogo-servicios",
      primaryFields: ["codigo", "descripcion", "facturablePorDefecto"],
      relatedTo: ["proyecto"],
    },
  ],
  fields: [
    // CRM (oportunidades) — SF-21.
    { moduleKey: "crm", fieldKey: "empresa", label: "Empresa", kind: "text", required: true, placeholder: "Razón social del prospecto" },
    { moduleKey: "crm", fieldKey: "contacto", label: "Contacto", kind: "text", required: true, placeholder: "Persona con la que tratas" },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "contacto@empresa.com" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 600 000 000" },
    { moduleKey: "crm", fieldKey: "fase", label: "Fase", kind: "status", required: true, placeholder: "lead / contactado / propuesta / negociacion / ganado / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "contactado", label: "Contactado" },
      { value: "propuesta", label: "Propuesta" },
      { value: "negociacion", label: "Negociación" },
      { value: "ganado", label: "Ganado" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "valorEstimado", label: "Valor estimado", kind: "money", placeholder: "Ej. 14500 EUR" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Qué hay que hacer a continuación con este prospecto" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Proyecto", kind: "text", required: true, placeholder: "ERP comercial, mantenimiento anual..." },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "proyectos", fieldKey: "codigoTipo", label: "Código de servicio", kind: "relation", relationModuleKey: "catalogo-servicios", placeholder: "INST, MANT, NUEDES, SOP, FORM..." },
    { moduleKey: "proyectos", fieldKey: "responsable", label: "Project lead", kind: "text", placeholder: "Responsable" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / pausado / finalizado / expirado / por_renovar", options: [
      { value: "activo", label: "Activo" },
      { value: "por_renovar", label: "Por renovar" },
      { value: "pausado", label: "Pausado" },
      { value: "finalizado", label: "Finalizado" },
      { value: "expirado", label: "Expirado" },
    ] },
    { moduleKey: "proyectos", fieldKey: "facturable", label: "Facturable", kind: "status", required: true, placeholder: "si / no — heredado del tipo, sobrescribible", options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
    ] },
    { moduleKey: "proyectos", fieldKey: "fechaInicio", label: "Fecha de inicio", kind: "date", placeholder: "YYYY-MM-DD" },
    { moduleKey: "proyectos", fieldKey: "fechaCaducidad", label: "Fecha de caducidad", kind: "date", placeholder: "YYYY-MM-DD — fin de vigencia del contrato" },
    { moduleKey: "proyectos", fieldKey: "kilometros", label: "Km acumulados", kind: "text", placeholder: "Km imputados a este proyecto (sumatorio de partes)" },
    { moduleKey: "proyectos", fieldKey: "tarifaHoraOverride", label: "Tarifa €/h", kind: "text", placeholder: "Vacío → usa la del catálogo. Numérico → override puntual." },
    { moduleKey: "proyectos", fieldKey: "horasTotales", label: "Horas totales (bolsa)", kind: "text", placeholder: "Solo aplica a codigoTipo=BOLSA — total horas contratadas" },
    { moduleKey: "proyectos", fieldKey: "notas", label: "Notas", kind: "text", placeholder: "Condiciones específicas, observaciones..." },

    { moduleKey: "documentos", fieldKey: "nombre", label: "Entregable", kind: "text", required: true, placeholder: "Acta, backlog, documentación..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "acta / backlog / entregable / técnico" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },

    // Propuestas (presupuestos) — SF-14.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº propuesta", kind: "text", placeholder: "Déjalo vacío y se autoasigna PRES-YYYY-NNN" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Servicio o trabajo propuesto" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "Ej. 14500 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "borrador / pendiente / enviado / negociacion / aceptado / rechazado", options: [
      { value: "borrador", label: "Borrador" },
      { value: "pendiente", label: "Pendiente" },
      { value: "enviado", label: "Enviado" },
      { value: "negociacion", label: "Negociación" },
      { value: "aceptado", label: "Aceptado" },
      { value: "rechazado", label: "Rechazado" },
    ] },
    { moduleKey: "presupuestos", fieldKey: "fechaEnvio", label: "Fecha de envío", kind: "date" },
    { moduleKey: "presupuestos", fieldKey: "notas", label: "Notas", kind: "textarea", placeholder: "Observaciones internas sobre la propuesta" },

    // Facturas — SF-14.
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº factura", kind: "text", placeholder: "Déjalo vacío y se autoasigna FAC-YYYY-NNN" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Concepto facturado" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "Ej. 4500 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitida / cobrada / vencida / anulada", options: [
      { value: "emitida", label: "Emitida" },
      { value: "cobrada", label: "Cobrada" },
      { value: "vencida", label: "Vencida" },
      { value: "anulada", label: "Anulada" },
    ] },
    { moduleKey: "facturacion", fieldKey: "fechaEmision", label: "Fecha emisión", kind: "date" },
    { moduleKey: "facturacion", fieldKey: "fechaVencimiento", label: "Vencimiento", kind: "date" },
    { moduleKey: "facturacion", fieldKey: "notas", label: "Notas", kind: "textarea", placeholder: "Observaciones internas sobre la factura" },

    // Parte de horas (actividades) — campos explícitos.
    { moduleKey: "actividades", fieldKey: "fecha", label: "Fecha", kind: "date", required: true, placeholder: "YYYY-MM-DD" },
    { moduleKey: "actividades", fieldKey: "persona", label: "Persona", kind: "text", required: true, placeholder: "Quien imputa las horas" },
    { moduleKey: "actividades", fieldKey: "proyecto", label: "Proyecto", kind: "relation", required: true, relationModuleKey: "proyectos" },
    { moduleKey: "actividades", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Qué se hizo en este tramo" },
    { moduleKey: "actividades", fieldKey: "horas", label: "Horas", kind: "text", required: true, placeholder: "Decimal: 0.5, 1, 4, 7.5..." },
    { moduleKey: "actividades", fieldKey: "kilometros", label: "Km", kind: "text", placeholder: "Km recorridos imputables al cliente" },
    { moduleKey: "actividades", fieldKey: "tipoTrabajo", label: "Tipo de trabajo", kind: "text", placeholder: "desarrollo / análisis / soporte / qa / reunion / documentacion" },
    { moduleKey: "actividades", fieldKey: "facturable", label: "Facturable", kind: "status", placeholder: "si / no — heredado del proyecto", options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
    ] },
    { moduleKey: "actividades", fieldKey: "tarifaHora", label: "Tarifa €/h", kind: "text", placeholder: "Heredada del proyecto/catálogo. Sobrescribible aquí." },
    { moduleKey: "actividades", fieldKey: "facturado", label: "Facturado", kind: "status", placeholder: "si / no — se marca al generar factura", options: [
      { value: "si", label: "Sí" },
      { value: "no", label: "No" },
    ] },
    { moduleKey: "actividades", fieldKey: "facturaNumero", label: "Factura nº", kind: "text", placeholder: "Número de la factura donde se incluyó" },
    { moduleKey: "actividades", fieldKey: "tareaRelacionada", label: "Tarea", kind: "text", placeholder: "Tarea asociada (opcional)" },
    { moduleKey: "actividades", fieldKey: "notas", label: "Notas", kind: "text", placeholder: "Observaciones internas" },

    // Catálogo de servicios — campos del tipo de servicio.
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "codigo",
      label: "Código",
      kind: "text",
      required: true,
      placeholder: "INST, MANT, NUEDES, SOP, FORM, VERIFACTU, ...",
    },
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "descripcion",
      label: "Descripción",
      kind: "text",
      required: true,
      placeholder: "Descripción del servicio que se factura/imputa.",
    },
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "facturablePorDefecto",
      label: "Facturable por defecto",
      kind: "status",
      required: true,
      placeholder: "si / no",
      options: [
        { value: "si", label: "Sí" },
        { value: "no", label: "No" },
      ],
    },
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "vigenciaMesesPorDefecto",
      label: "Vigencia (meses)",
      kind: "text",
      placeholder: "12 — meses por defecto desde alta hasta caducidad",
    },
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "tarifaHoraDefault",
      label: "Tarifa €/h por defecto",
      kind: "text",
      placeholder: "55 — tarifa por hora si el proyecto no tiene override",
    },
    {
      moduleKey: "catalogo-servicios",
      fieldKey: "notas",
      label: "Notas internas",
      kind: "text",
      placeholder: "Cuándo aplica, casuísticas, condiciones...",
    },
  ],
  tableColumns: [
    // CRM (oportunidades) — SF-21.
    { moduleKey: "crm", fieldKey: "empresa", label: "Empresa", isPrimary: true },
    { moduleKey: "crm", fieldKey: "contacto", label: "Contacto" },
    { moduleKey: "crm", fieldKey: "fase", label: "Fase" },
    { moduleKey: "crm", fieldKey: "valorEstimado", label: "Valor" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    { moduleKey: "proyectos", fieldKey: "codigoTipo", label: "Código", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "nombre", label: "Proyecto" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "proyectos", fieldKey: "facturable", label: "Facturable" },
    { moduleKey: "proyectos", fieldKey: "fechaCaducidad", label: "Caducidad" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "proyectos", fieldKey: "responsable", label: "Lead" },
    { moduleKey: "proyectos", fieldKey: "kilometros", label: "Km" },
    { moduleKey: "documentos", fieldKey: "nombre", label: "Entregable", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },

    { moduleKey: "catalogo-servicios", fieldKey: "codigo", label: "Código", isPrimary: true },
    { moduleKey: "catalogo-servicios", fieldKey: "descripcion", label: "Descripción" },
    { moduleKey: "catalogo-servicios", fieldKey: "facturablePorDefecto", label: "Facturable" },
    { moduleKey: "catalogo-servicios", fieldKey: "vigenciaMesesPorDefecto", label: "Vigencia (meses)" },
    { moduleKey: "catalogo-servicios", fieldKey: "tarifaHoraDefault", label: "€/h" },

    { moduleKey: "actividades", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "actividades", fieldKey: "persona", label: "Persona" },
    { moduleKey: "actividades", fieldKey: "proyecto", label: "Proyecto" },
    { moduleKey: "actividades", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "actividades", fieldKey: "horas", label: "Horas" },
    { moduleKey: "actividades", fieldKey: "kilometros", label: "Km" },
    { moduleKey: "actividades", fieldKey: "facturable", label: "Facturable" },
    { moduleKey: "actividades", fieldKey: "tarifaHora", label: "€/h" },
    { moduleKey: "actividades", fieldKey: "facturado", label: "Facturado" },

    // Propuestas (presupuestos) — SF-14.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },

    // Facturas — SF-14.
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },
    { moduleKey: "facturacion", fieldKey: "fechaVencimiento", label: "Vencimiento" },
  ],
  dashboardPriorities: [
    { key: "pipeline", label: "Pipeline", description: "Valor potencial del negocio.", order: 1 },
    { key: "proyectos", label: "Proyectos activos", description: "Control operativo técnico.", order: 2 },
    { key: "presupuestos", label: "Propuestas abiertas", description: "Propuestas en negociación.", order: 3 },
    { key: "facturas", label: "Facturas pendientes", description: "Cobro pendiente.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Última actividad.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "Acme Labs", email: "laura@acme.com", telefono: "+34 600 111 101", estado: "activo", segmento: "Industria" },
      { nombre: "Nova Retail", email: "it@novaretail.com", telefono: "+34 600 111 102", estado: "activo", segmento: "Retail" },
      { nombre: "Binary Forge", email: "hola@binaryforge.es", telefono: "+34 600 111 103", estado: "seguimiento", segmento: "SaaS" },
      { nombre: "Talleres López", email: "admin@tallereslopez.com", telefono: "+34 600 111 104", estado: "activo", segmento: "Automoción" },
      { nombre: "Clínica Ardor", email: "direccion@clinicaardor.com", telefono: "+34 600 111 105", estado: "seguimiento", segmento: "Salud" },
      { nombre: "Polígono Demo SL", email: "admin@poligonodemo.es", telefono: "+34 600 111 106", estado: "activo", segmento: "Industrial" },
    ]},
    { moduleKey: "crm", records: [
      { empresa: "Acme Labs", contacto: "Laura Martín", email: "laura@acme.com", telefono: "+34 600 111 101", fase: "propuesta", valorEstimado: "14500 EUR", proximoPaso: "Revisar hitos de fase 2" },
      { empresa: "Binary Forge", contacto: "Diego Peña", email: "diego@binaryforge.es", telefono: "+34 600 111 103", fase: "negociacion", valorEstimado: "22000 EUR", proximoPaso: "Cerrar condiciones de soporte" },
      { empresa: "Nova Retail", contacto: "Carlos Vidal", email: "carlos@novaretail.com", telefono: "+34 600 111 102", fase: "contactado", valorEstimado: "8600 EUR", proximoPaso: "Agendar demo POS" },
      { empresa: "Clínica Ardor", contacto: "Nuria Santos", email: "nuria@clinicaardor.com", telefono: "+34 600 111 105", fase: "lead", valorEstimado: "6500 EUR", proximoPaso: "Envío de caso de uso" }
    ]},
    { moduleKey: "proyectos", records: [
      // ===== Acme Labs — iniciativa grande + servicios recurrentes =====
      { nombre: "ERP comercial Acme — Fase 2", cliente: "Acme Labs", codigoTipo: "FASE_I", responsable: "Laura", estado: "activo", facturable: "no", fechaInicio: "2026-04-01", fechaCaducidad: "2026-09-30", kilometros: "240", tarifaHoraOverride: "60", notas: "Presupuesto cerrado 14.500€. Hitos por fase. Migración Navision pendiente." },
      { nombre: "Mantenimiento anual Acme", cliente: "Acme Labs", codigoTipo: "MANT", responsable: "Pablo", estado: "activo", facturable: "no", fechaInicio: "2026-01-01", fechaCaducidad: "2026-12-31", kilometros: "0", tarifaHoraOverride: "", notas: "Cubierto por cuota mensual. Bugs propios sin cargo." },
      { nombre: "Soporte usuarios Acme", cliente: "Acme Labs", codigoTipo: "SOP", responsable: "Pablo", estado: "activo", facturable: "si", fechaInicio: "2026-01-01", fechaCaducidad: "2026-12-31", kilometros: "0", tarifaHoraOverride: "55", notas: "Bolsa 30h/año. Sobreconsumo a 60€/h." },
      { nombre: "Evolutivo sprint mensual Acme", cliente: "Acme Labs", codigoTipo: "EVOLU", responsable: "Laura", estado: "por_renovar", facturable: "si", fechaInicio: "2026-04-01", fechaCaducidad: "2026-05-31", kilometros: "60", tarifaHoraOverride: "60", notas: "Sprint mensual de mejoras. Renovar antes del 31-may." },

      // ===== Nova Retail — integración + servicios futuros =====
      { nombre: "Integración POS Nova", cliente: "Nova Retail", codigoTipo: "FASE_I", responsable: "Carlos", estado: "activo", facturable: "no", fechaInicio: "2026-03-15", fechaCaducidad: "2026-07-15", kilometros: "180", tarifaHoraOverride: "60", notas: "Presupuesto 8.600€. 14 tiendas. Stripe + sync stock." },
      { nombre: "Soporte preventivo Nova POS", cliente: "Nova Retail", codigoTipo: "SOP", responsable: "Carlos", estado: "activo", facturable: "si", fechaInicio: "2026-05-15", fechaCaducidad: "2026-11-15", kilometros: "0", tarifaHoraOverride: "55", notas: "Arranca con la entrega. Revisión mensual + parche trimestral." },

      // ===== Binary Forge — soporte IA con riesgo =====
      { nombre: "Plataforma soporte Binary", cliente: "Binary Forge", codigoTipo: "FASE_I", responsable: "Ana", estado: "activo", facturable: "no", fechaInicio: "2026-02-01", fechaCaducidad: "2026-08-31", kilometros: "0", tarifaHoraOverride: "65", notas: "Memory leak no resuelto. Coste de tokens en riesgo. Estado ámbar." },
      { nombre: "Bolsa horas correctivo Binary", cliente: "Binary Forge", codigoTipo: "BOLSA", responsable: "Ana", estado: "activo", facturable: "si", fechaInicio: "2026-01-01", fechaCaducidad: "2026-12-31", kilometros: "0", tarifaHoraOverride: "60", horasTotales: "30", notas: "30h prepagadas. Saldo se actualiza según partes imputados." },

      // ===== Talleres López — sustituyendo papel + Excel =====
      { nombre: "Gestión taller López", cliente: "Talleres López", codigoTipo: "FASE_I", responsable: "Miguel", estado: "finalizado", facturable: "no", fechaInicio: "2025-10-01", fechaCaducidad: "2026-04-08", kilometros: "320", tarifaHoraOverride: "55", notas: "Entregada v2.1.0 el 08-abr-2026. Fase cerrada." },
      { nombre: "Mantenimiento adaptativo López — RGPD", cliente: "Talleres López", codigoTipo: "NUEDES", responsable: "Miguel", estado: "finalizado", facturable: "si", fechaInicio: "2026-02-01", fechaCaducidad: "2026-04-15", kilometros: "80", tarifaHoraOverride: "65", notas: "Adaptación RGPD. 16h consumidas de 16h contratadas. Cerrado." },
      { nombre: "Bolsa horas correctivo López", cliente: "Talleres López", codigoTipo: "BOLSA", responsable: "Miguel", estado: "activo", facturable: "si", fechaInicio: "2026-01-01", fechaCaducidad: "2026-12-31", kilometros: "40", tarifaHoraOverride: "55", horasTotales: "24", notas: "24h prepagadas. Saldo se actualiza según partes imputados." },
      { nombre: "Formación usuarios López", cliente: "Talleres López", codigoTipo: "FORM", responsable: "Miguel", estado: "finalizado", facturable: "si", fechaInicio: "2026-04-10", fechaCaducidad: "2026-04-10", kilometros: "60", tarifaHoraOverride: "65", notas: "Sesión 2h con 4 mecánicos. Facturado." },

      // ===== Clínica Ardor — solo en piloto =====
      { nombre: "Piloto gestión de citas Clínica Ardor", cliente: "Clínica Ardor", codigoTipo: "SERPRE", responsable: "Laura", estado: "pausado", facturable: "no", fechaInicio: "2026-04-01", fechaCaducidad: "2026-06-30", kilometros: "0", tarifaHoraOverride: "60", notas: "Presupuesto 6.500€ enviado. En espera de aprobación cliente." },

      // ===== Polígono Demo SL — cliente con catálogo realista de servicios =====
      // (Inspirado en cómo modelas SISPYME hoy: una cuota mensual con N servicios incluidos
      //  + servicios extra puntuales que se renuevan o caducan.)
      { nombre: "Instalación inicial v1", cliente: "Polígono Demo SL", codigoTipo: "INST", responsable: "Pablo", estado: "activo", facturable: "no", fechaInicio: "2024-01-15", fechaCaducidad: "2026-12-31", kilometros: "120", tarifaHoraOverride: "", notas: "Onboarding en cuota anual. Renovación automática." },
      { nombre: "Mantenimiento anual", cliente: "Polígono Demo SL", codigoTipo: "MANT", responsable: "Pablo", estado: "activo", facturable: "no", fechaInicio: "2024-01-15", fechaCaducidad: "2026-12-31", kilometros: "0", tarifaHoraOverride: "", notas: "En cuota mensual. Solo bugs propios." },
      { nombre: "Desarrollo nuevos módulos", cliente: "Polígono Demo SL", codigoTipo: "NUEDES", responsable: "Laura", estado: "activo", facturable: "si", fechaInicio: "2025-03-01", fechaCaducidad: "2026-12-31", kilometros: "180", tarifaHoraOverride: "", notas: "Funcionalidad nueva por petición. Por horas." },
      { nombre: "Soporte usuarios", cliente: "Polígono Demo SL", codigoTipo: "SOP", responsable: "Carlos", estado: "activo", facturable: "si", fechaInicio: "2024-01-15", fechaCaducidad: "2026-12-31", kilometros: "60", tarifaHoraOverride: "", notas: "Tickets, dudas funcionales." },
      { nombre: "Adaptación Veri*factu", cliente: "Polígono Demo SL", codigoTipo: "VERIFACTU", responsable: "Pablo", estado: "expirado", facturable: "no", fechaInicio: "2025-06-01", fechaCaducidad: "2025-12-31", kilometros: "0", tarifaHoraOverride: "", notas: "Ya implementado y entregado en 2025. Histórico." },
      { nombre: "Formación usuarios 2024", cliente: "Polígono Demo SL", codigoTipo: "FORM", responsable: "Miguel", estado: "expirado", facturable: "si", fechaInicio: "2024-09-01", fechaCaducidad: "2024-12-31", kilometros: "180", tarifaHoraOverride: "", notas: "Cerrado en 2024. Histórico." },
      { nombre: "Soporte vConta", cliente: "Polígono Demo SL", codigoTipo: "SOPV", responsable: "Carlos", estado: "expirado", facturable: "si", fechaInicio: "2024-01-15", fechaCaducidad: "2024-12-31", kilometros: "0", tarifaHoraOverride: "", notas: "Cliente migró a otro contable en 2025. No renovado." },
      { nombre: "Desarrollo App movilidad", cliente: "Polígono Demo SL", codigoTipo: "SERPRE", responsable: "Laura", estado: "expirado", facturable: "no", fechaInicio: "2022-04-01", fechaCaducidad: "2022-12-31", kilometros: "240", tarifaHoraOverride: "", notas: "Presupuesto cerrado entregado 2022. Histórico." },
      { nombre: "FASE I — App + vConta + Movilidad Comerciales + Cliens + Papiro V7", cliente: "Polígono Demo SL", codigoTipo: "FASE_I", responsable: "Laura", estado: "expirado", facturable: "no", fechaInicio: "2020-03-01", fechaCaducidad: "2020-11-30", kilometros: "420", tarifaHoraOverride: "", notas: "Iniciativa grande de 2020. Histórico documental." }
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "PRE-TECH-014", cliente: "Acme Labs", concepto: "Fase 2 ERP comercial", importe: "14500 EUR", estado: "enviado" },
      { numero: "PRE-TECH-015", cliente: "Binary Forge", concepto: "Plataforma soporte con IA", importe: "22000 EUR", estado: "negociacion" },
      { numero: "PRE-TECH-016", cliente: "Nova Retail", concepto: "Integración POS + inventario", importe: "8600 EUR", estado: "pendiente" },
      { numero: "PRE-TECH-017", cliente: "Clínica Ardor", concepto: "Piloto gestión de citas", importe: "6500 EUR", estado: "borrador" }
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "FAC-TECH-031", cliente: "Acme Labs", concepto: "Fase 1 ERP comercial - hito 1", importe: "4500 EUR", estado: "cobrada" },
      { numero: "FAC-TECH-032", cliente: "Acme Labs", concepto: "Fase 1 ERP comercial - hito 2", importe: "4500 EUR", estado: "emitida" },
      { numero: "FAC-TECH-033", cliente: "Talleres López", concepto: "Gestión taller - arranque", importe: "3200 EUR", estado: "emitida" },
      { numero: "FAC-TECH-034", cliente: "Binary Forge", concepto: "Discovery soporte IA", importe: "2800 EUR", estado: "vencida" }
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Backlog inicial ERP Acme", tipo: "backlog", cliente: "Acme Labs", entidadOrigen: "ERP comercial Acme — Fase 2", estado: "vigente" },
      { nombre: "Acta kickoff Nova Retail", tipo: "acta", cliente: "Nova Retail", entidadOrigen: "Integración POS Nova", estado: "vigente" },
      { nombre: "Arquitectura soporte Binary", tipo: "tecnico", cliente: "Binary Forge", entidadOrigen: "Plataforma soporte Binary", estado: "revision" },
      { nombre: "Manual de usuario taller López", tipo: "entregable", cliente: "Talleres López", entidadOrigen: "Gestión taller López", estado: "vigente" },
      { nombre: "Propuesta técnica Clínica Ardor", tipo: "tecnico", cliente: "Clínica Ardor", entidadOrigen: "Piloto gestión de citas", estado: "borrador" }
    ]},
    // ===== Hub Producción =====
    { moduleKey: "tareas", records: [
      { titulo: "Diseñar modelo de datos del módulo de pedidos", proyecto: "ERP comercial Acme — Fase 2", asignado: "Laura", estado: "hecho", prioridad: "alta", horasEstimadas: "16", horasReales: "14", fechaLimite: "2026-04-08", descripcion: "Tablas pedidos, líneas, estado y relación con clientes." },
      { titulo: "Implementar API REST de pedidos", proyecto: "ERP comercial Acme — Fase 2", asignado: "Pablo", estado: "en_curso", prioridad: "alta", horasEstimadas: "24", horasReales: "12", fechaLimite: "2026-05-02", descripcion: "Endpoints CRUD con validación y permisos." },
      { titulo: "Migrar reportes de ventas mensuales", proyecto: "ERP comercial Acme — Fase 2", asignado: "Laura", estado: "backlog", prioridad: "media", horasEstimadas: "8", horasReales: "0", fechaLimite: "2026-05-15", descripcion: "Migrar 4 reportes existentes al nuevo formato." },
      { titulo: "Conectar Stripe sandbox al POS", proyecto: "Integración POS Nova", asignado: "Carlos", estado: "en_curso", prioridad: "alta", horasEstimadas: "16", horasReales: "10", fechaLimite: "2026-05-05", descripcion: "Test de pago end-to-end con tarjeta de prueba." },
      { titulo: "Sincronizar inventario con TPV en tiempo real", proyecto: "Integración POS Nova", asignado: "Carlos", estado: "backlog", prioridad: "media", horasEstimadas: "20", horasReales: "0", fechaLimite: "2026-05-20", descripcion: "Webhook bidireccional con sistema TPV existente." },
      { titulo: "Investigar causa raíz del cuelgue del soporte IA", proyecto: "Plataforma soporte Binary", asignado: "Ana", estado: "en_curso", prioridad: "alta", horasEstimadas: "12", horasReales: "8", fechaLimite: "2026-04-30", descripcion: "Memory leak en el worker de embeddings cuando hay >50 conversaciones." },
      { titulo: "Documentar arquitectura del sistema de embeddings", proyecto: "Plataforma soporte Binary", asignado: "Ana", estado: "en_revision", prioridad: "media", horasEstimadas: "6", horasReales: "5", fechaLimite: "2026-04-26", descripcion: "Diagrama + decisiones de diseño del pipeline de embeddings." },
      { titulo: "Configurar entorno de pruebas con datos reales anonimizados", proyecto: "Plataforma soporte Binary", asignado: "Diego", estado: "bloqueada", prioridad: "alta", horasEstimadas: "10", horasReales: "2", fechaLimite: "2026-05-01", descripcion: "Bloqueada esperando aprobación legal del cliente sobre datos." },
      { titulo: "Formación a usuarios del taller López en módulo de OT", proyecto: "Gestión taller López", asignado: "Miguel", estado: "hecho", prioridad: "media", horasEstimadas: "4", horasReales: "4", fechaLimite: "2026-04-10", descripcion: "Sesión de 2 horas con 4 mecánicos." },
      { titulo: "Bug: precios IVA mal calculados en facturas con descuento", proyecto: "Gestión taller López", asignado: "Miguel", estado: "en_curso", prioridad: "alta", horasEstimadas: "4", horasReales: "2", fechaLimite: "2026-04-29", descripcion: "El descuento se aplica antes del IVA en lugar de después." },
      { titulo: "Mejorar UX del registro de horas en móvil", proyecto: "Gestión taller López", asignado: "Miguel", estado: "backlog", prioridad: "baja", horasEstimadas: "12", horasReales: "0", fechaLimite: "2026-06-01", descripcion: "Los mecánicos se quejan del flujo en móvil al imputar horas." },
      { titulo: "Despliegue en producción del módulo de pedidos", proyecto: "ERP comercial Acme — Fase 2", asignado: "Pablo", estado: "backlog", prioridad: "alta", horasEstimadas: "4", horasReales: "0", fechaLimite: "2026-05-10", descripcion: "Tras revisión, deploy con migration y rollback plan." },
    ]},
    { moduleKey: "incidencias", records: [
      { codigo: "INC-2026-001", titulo: "Login lento (>5s) por las mañanas", proyecto: "ERP comercial Acme — Fase 2", reportadoPor: "Cliente Acme", asignado: "Pablo", severidad: "alta", tipo: "bug", estado: "en_curso", version: "v1.2.0", fechaApertura: "2026-04-22", descripcion: "Los usuarios reportan que el primer login del día tarda más de 5 segundos. Reproducible entre 8:00-9:00.", solucion: "" },
      { codigo: "INC-2026-002", titulo: "Falta opción de exportar a CSV en módulo de productos", proyecto: "ERP comercial Acme — Fase 2", reportadoPor: "Laura Martín (Acme)", asignado: "Laura", severidad: "media", tipo: "mejora", estado: "esperando_cliente", version: "v1.2.0", fechaApertura: "2026-04-19", descripcion: "Los usuarios necesitan exportar el catálogo para enviárselo a proveedores.", solucion: "" },
      { codigo: "INC-2026-003", titulo: "Pago Stripe falla con tarjetas sin 3D Secure", proyecto: "Integración POS Nova", reportadoPor: "QA Nova", asignado: "Carlos", severidad: "critica", tipo: "bug", estado: "resuelta", version: "v0.5.0", fechaApertura: "2026-04-15", fechaResolucion: "2026-04-17", descripcion: "Tarjetas legacy sin 3DS no completan el cobro.", solucion: "Activado fallback a SCA exemption para tarjetas EU bajo 30€." },
      { codigo: "INC-2026-004", titulo: "Memory leak en worker de embeddings", proyecto: "Plataforma soporte Binary", reportadoPor: "Equipo interno", asignado: "Ana", severidad: "alta", tipo: "bug", estado: "en_curso", version: "v0.3.2", fechaApertura: "2026-04-20", descripcion: "Tras 24h con >50 conversaciones simultáneas el worker llega a 4GB y muere.", solucion: "" },
      { codigo: "INC-2026-005", titulo: "Pregunta del cliente sobre integración con LDAP", proyecto: "Plataforma soporte Binary", reportadoPor: "Diego Peña (Binary Forge)", asignado: "Diego", severidad: "baja", tipo: "consulta", estado: "abierta", version: "", fechaApertura: "2026-04-25", descripcion: "Si en algún momento podemos conectar con su LDAP corporativo.", solucion: "" },
      { codigo: "INC-2026-006", titulo: "IVA incorrecto en facturas con descuento (taller López)", proyecto: "Gestión taller López", reportadoPor: "Cliente López", asignado: "Miguel", severidad: "alta", tipo: "bug", estado: "en_curso", version: "v2.1.0", fechaApertura: "2026-04-23", descripcion: "Cuando hay descuento, el IVA se aplica antes en lugar de después, y el total no cuadra con el ticket.", solucion: "" },
      { codigo: "INC-2026-007", titulo: "Cambio de logo solicitado para portal cliente", proyecto: "Gestión taller López", reportadoPor: "Cliente López", asignado: "Miguel", severidad: "baja", tipo: "configuracion", estado: "resuelta", version: "v2.1.0", fechaApertura: "2026-04-12", fechaResolucion: "2026-04-13", descripcion: "Han renovado imagen corporativa.", solucion: "Subido nuevo logo a /assets/customer/lopez/. Verificado en pre y pro." },
      { codigo: "INC-2026-008", titulo: "Error 500 al intentar borrar línea de pedido", proyecto: "ERP comercial Acme — Fase 2", reportadoPor: "Usuario admin Acme", asignado: "Pablo", severidad: "media", tipo: "bug", estado: "abierta", version: "v1.2.0", fechaApertura: "2026-04-26", descripcion: "Al intentar borrar la última línea de un pedido, el servidor devuelve 500.", solucion: "" },
    ]},
    { moduleKey: "actividades", records: [
      // ===== Acme Labs — Fase 2 (facturable, presupuesto cerrado: NO se factura por horas, va al hito) =====
      { fecha: "2026-04-21", persona: "Pablo", proyecto: "ERP comercial Acme — Fase 2", tareaRelacionada: "Implementar API REST de pedidos", concepto: "Diseño endpoints + validaciones", horas: "6", kilometros: "0", facturable: "no", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "desarrollo", notas: "Cubierto por presupuesto cerrado de Fase 2." },
      { fecha: "2026-04-22", persona: "Pablo", proyecto: "ERP comercial Acme — Fase 2", tareaRelacionada: "Implementar API REST de pedidos", concepto: "Implementación CRUD pedidos", horas: "6", kilometros: "0", facturable: "no", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "desarrollo", notas: "" },
      { fecha: "2026-04-22", persona: "Laura", proyecto: "ERP comercial Acme — Fase 2", tareaRelacionada: "Diseñar modelo de datos del módulo de pedidos", concepto: "Cierre de modelo + revisión con cliente", horas: "4", kilometros: "120", facturable: "no", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "analisis", notas: "Reunión presencial en Acme." },
      // ===== Acme Labs — SOP (facturable por horas) =====
      { fecha: "2026-04-15", persona: "Pablo", proyecto: "Soporte usuarios Acme", tareaRelacionada: "", concepto: "Resolver dudas funcionales sobre módulo facturación", horas: "1.5", kilometros: "0", facturable: "si", tarifaHora: "55", facturado: "si", facturaNumero: "FAC-TECH-035", tipoTrabajo: "soporte", notas: "" },
      { fecha: "2026-04-22", persona: "Pablo", proyecto: "Soporte usuarios Acme", tareaRelacionada: "", concepto: "Diagnóstico problema de impresión en cliente concreto", horas: "2", kilometros: "0", facturable: "si", tarifaHora: "55", facturado: "no", facturaNumero: "", tipoTrabajo: "soporte", notas: "Pendiente de facturar este mes." },
      // ===== Acme Labs — EVOLU mensual =====
      { fecha: "2026-04-18", persona: "Laura", proyecto: "Evolutivo sprint mensual Acme", tareaRelacionada: "", concepto: "Mejora pantalla pedidos según feedback usuario", horas: "8", kilometros: "0", facturable: "si", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "desarrollo", notas: "" },
      { fecha: "2026-04-25", persona: "Laura", proyecto: "Evolutivo sprint mensual Acme", tareaRelacionada: "", concepto: "Filtros avanzados en listado clientes", horas: "6", kilometros: "60", facturable: "si", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "desarrollo", notas: "Visita a Acme para validar UX." },

      // ===== Nova Retail — Integración (facturable, presupuesto cerrado) =====
      { fecha: "2026-04-23", persona: "Carlos", proyecto: "Integración POS Nova", tareaRelacionada: "Conectar Stripe sandbox al POS", concepto: "Implementación SDK Stripe + tests", horas: "5", kilometros: "0", facturable: "no", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "desarrollo", notas: "" },
      { fecha: "2026-04-24", persona: "Carlos", proyecto: "Integración POS Nova", tareaRelacionada: "Conectar Stripe sandbox al POS", concepto: "Tests end-to-end de pago", horas: "5", kilometros: "180", facturable: "no", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "qa", notas: "Visita a tienda piloto Nova." },

      // ===== Binary Forge — Plataforma soporte =====
      { fecha: "2026-04-21", persona: "Ana", proyecto: "Plataforma soporte Binary", tareaRelacionada: "Investigar causa raíz del cuelgue", concepto: "Profile de memoria + análisis del worker", horas: "4", kilometros: "0", facturable: "no", tarifaHora: "65", facturado: "no", facturaNumero: "", tipoTrabajo: "analisis", notas: "" },
      { fecha: "2026-04-22", persona: "Ana", proyecto: "Plataforma soporte Binary", tareaRelacionada: "Investigar causa raíz del cuelgue", concepto: "Reproducción local del leak con datos sintéticos", horas: "4", kilometros: "0", facturable: "no", tarifaHora: "65", facturado: "no", facturaNumero: "", tipoTrabajo: "analisis", notas: "" },
      { fecha: "2026-04-25", persona: "Ana", proyecto: "Plataforma soporte Binary", tareaRelacionada: "Documentar arquitectura embeddings", concepto: "Redacción del documento técnico", horas: "5", kilometros: "0", facturable: "no", tarifaHora: "65", facturado: "no", facturaNumero: "", tipoTrabajo: "documentacion", notas: "" },

      // ===== Binary Forge — Bolsa horas correctivo (facturable contra bolsa) =====
      { fecha: "2026-04-15", persona: "Diego", proyecto: "Bolsa horas correctivo Binary", tareaRelacionada: "", concepto: "Hotfix bug autenticación SSO", horas: "3", kilometros: "0", facturable: "si", tarifaHora: "60", facturado: "si", facturaNumero: "FAC-TECH-036", tipoTrabajo: "soporte", notas: "Resta 3h de la bolsa de 30h." },
      { fecha: "2026-04-23", persona: "Diego", proyecto: "Bolsa horas correctivo Binary", tareaRelacionada: "", concepto: "Investigación error 500 en exportación", horas: "5", kilometros: "0", facturable: "si", tarifaHora: "60", facturado: "no", facturaNumero: "", tipoTrabajo: "soporte", notas: "" },

      // ===== Talleres López — Mantenimiento RGPD (cerrado, ya facturado) =====
      { fecha: "2026-03-15", persona: "Miguel", proyecto: "Mantenimiento adaptativo López — RGPD", tareaRelacionada: "", concepto: "Análisis requisitos RGPD nuevos", horas: "4", kilometros: "40", facturable: "si", tarifaHora: "65", facturado: "si", facturaNumero: "FAC-TECH-033", tipoTrabajo: "analisis", notas: "" },
      { fecha: "2026-03-20", persona: "Miguel", proyecto: "Mantenimiento adaptativo López — RGPD", tareaRelacionada: "", concepto: "Implementación módulo consentimientos", horas: "8", kilometros: "0", facturable: "si", tarifaHora: "65", facturado: "si", facturaNumero: "FAC-TECH-033", tipoTrabajo: "desarrollo", notas: "" },
      { fecha: "2026-04-05", persona: "Miguel", proyecto: "Mantenimiento adaptativo López — RGPD", tareaRelacionada: "", concepto: "Tests + entrega + documentación", horas: "4", kilometros: "40", facturable: "si", tarifaHora: "65", facturado: "si", facturaNumero: "FAC-TECH-033", tipoTrabajo: "qa", notas: "Cierre del proyecto." },

      // ===== Talleres López — Bolsa correctivo (sin facturar todavía) =====
      { fecha: "2026-04-23", persona: "Miguel", proyecto: "Bolsa horas correctivo López", tareaRelacionada: "Bug IVA descuento", concepto: "Diagnóstico cálculo erróneo IVA", horas: "2", kilometros: "40", facturable: "si", tarifaHora: "55", facturado: "no", facturaNumero: "", tipoTrabajo: "soporte", notas: "Visita al taller." },

      // ===== Talleres López — Formación cerrada y facturada =====
      { fecha: "2026-04-10", persona: "Miguel", proyecto: "Formación usuarios López", tareaRelacionada: "", concepto: "Sesión presencial 2h con mecánicos", horas: "2", kilometros: "60", facturable: "si", tarifaHora: "65", facturado: "si", facturaNumero: "FAC-TECH-034", tipoTrabajo: "reunion", notas: "Bien recibido." },
      { fecha: "2026-04-08", persona: "Miguel", proyecto: "Formación usuarios López", tareaRelacionada: "", concepto: "Preparación material formativo", horas: "2", kilometros: "0", facturable: "no", tarifaHora: "65", facturado: "no", facturaNumero: "", tipoTrabajo: "documentacion", notas: "Preparación interna no facturable al cliente." },

      // ===== Imputación a proyecto MANT (no facturable nunca) =====
      { fecha: "2026-04-26", persona: "Pablo", proyecto: "Mantenimiento anual Acme", tareaRelacionada: "", concepto: "Bug error 500 al borrar línea de pedido", horas: "1.5", kilometros: "0", facturable: "no", tarifaHora: "55", facturado: "no", facturaNumero: "", tipoTrabajo: "soporte", notas: "Bug propio cubierto por mantenimiento." },
    ]},
    { moduleKey: "versiones", records: [
      { version: "v1.0.0", proyecto: "ERP comercial Acme — Fase 2", tipo: "major", estado: "publicada", fechaPrevista: "2026-02-15", fechaEntrega: "2026-02-18", responsable: "Laura", notasRelease: "Primera versión productiva. Módulos: clientes, productos, facturación básica.", entornos: "Pro Acme" },
      { version: "v1.1.0", proyecto: "ERP comercial Acme — Fase 2", tipo: "minor", estado: "publicada", fechaPrevista: "2026-03-20", fechaEntrega: "2026-03-22", responsable: "Laura", notasRelease: "Reportes mensuales de ventas + exportación a Excel.", entornos: "Pro Acme" },
      { version: "v1.2.0", proyecto: "ERP comercial Acme — Fase 2", tipo: "minor", estado: "en_pruebas", fechaPrevista: "2026-05-10", fechaEntrega: "", responsable: "Laura", notasRelease: "Módulo de pedidos completo + ajustes de UX en facturación.", entornos: "Pre" },
      { version: "v0.5.0", proyecto: "Integración POS Nova", tipo: "minor", estado: "en_desarrollo", fechaPrevista: "2026-05-15", fechaEntrega: "", responsable: "Carlos", notasRelease: "Pago Stripe + sincronización inicial de catálogo.", entornos: "Pre" },
      { version: "v0.3.2", proyecto: "Plataforma soporte Binary", tipo: "patch", estado: "en_desarrollo", fechaPrevista: "2026-04-30", fechaEntrega: "", responsable: "Ana", notasRelease: "Hotfix del memory leak del worker de embeddings.", entornos: "Pre Binary" },
      { version: "v2.1.0", proyecto: "Gestión taller López", tipo: "minor", estado: "publicada", fechaPrevista: "2026-04-05", fechaEntrega: "2026-04-08", responsable: "Miguel", notasRelease: "Portal cliente con nuevo logo y mejora de OT.", entornos: "Pro López" },
      { version: "v2.1.1", proyecto: "Gestión taller López", tipo: "hotfix", estado: "planificada", fechaPrevista: "2026-04-30", fechaEntrega: "", responsable: "Miguel", notasRelease: "Hotfix bug IVA en facturas con descuento.", entornos: "Pre" },
    ]},
    { moduleKey: "mantenimientos", records: [
      { nombre: "Bolsa horas correctivo Acme", proyecto: "ERP comercial Acme — Fase 2", modalidad: "correctivo", horasContratadas: "30", horasConsumidas: "8", tarifaHora: "55 EUR", vigenciaDesde: "2026-01-01", vigenciaHasta: "2026-12-31", renovacion: "automatica", notas: "SLA 24h laborables. Excluye nuevos desarrollos." },
      { nombre: "Mantenimiento evolutivo Acme — sprint 14", proyecto: "ERP comercial Acme — Fase 2", modalidad: "evolutivo", horasContratadas: "40", horasConsumidas: "26", tarifaHora: "60 EUR", vigenciaDesde: "2026-04-01", vigenciaHasta: "2026-05-31", renovacion: "manual", notas: "Sprint mensual de mejoras priorizadas con cliente." },
      { nombre: "Soporte preventivo Nova POS", proyecto: "Integración POS Nova", modalidad: "preventivo", horasContratadas: "20", horasConsumidas: "0", tarifaHora: "55 EUR", vigenciaDesde: "2026-05-15", vigenciaHasta: "2026-11-15", renovacion: "automatica", notas: "Revisión mensual de logs + parche de dependencias trimestral. Empieza con la entrega." },
      { nombre: "Mantenimiento adaptativo López — RGPD", proyecto: "Gestión taller López", modalidad: "adaptativo", horasContratadas: "16", horasConsumidas: "16", tarifaHora: "65 EUR", vigenciaDesde: "2026-02-01", vigenciaHasta: "2026-04-15", renovacion: "manual", notas: "Adaptación a nuevos requisitos RGPD. Cerrado." },
      { nombre: "Bolsa horas correctivo López", proyecto: "Gestión taller López", modalidad: "correctivo", horasContratadas: "24", horasConsumidas: "11", tarifaHora: "55 EUR", vigenciaDesde: "2026-01-01", vigenciaHasta: "2026-12-31", renovacion: "automatica", notas: "" },
    ]},
    { moduleKey: "justificantes", records: [
      { numero: "JUS-2026-001", proyecto: "ERP comercial Acme — Fase 2", fecha: "2026-02-28", personaResponsable: "Laura", personaCliente: "Acme — Laura Martín", horas: "120", trabajos: "Análisis funcional, diseño de modelo de datos, implementación de módulos clientes y productos, formación inicial al equipo de Acme. Entrega de v1.0.0.", version: "v1.0.0", estado: "firmado", notas: "Cierre fase 1." },
      { numero: "JUS-2026-002", proyecto: "ERP comercial Acme — Fase 2", fecha: "2026-03-31", personaResponsable: "Laura", personaCliente: "Acme — Laura Martín", horas: "60", trabajos: "Reportes mensuales de ventas, exportación a Excel, ajustes UX. Entrega de v1.1.0.", version: "v1.1.0", estado: "firmado", notas: "" },
      { numero: "JUS-2026-003", proyecto: "Gestión taller López", fecha: "2026-04-08", personaResponsable: "Miguel", personaCliente: "Talleres López — Roberto López", horas: "32", trabajos: "Implementación del portal cliente con nuevo logo y mejora del módulo de órdenes de trabajo. Formación de 2h a mecánicos. Entrega v2.1.0.", version: "v2.1.0", estado: "firmado", notas: "" },
      { numero: "JUS-2026-004", proyecto: "Plataforma soporte Binary", fecha: "2026-04-25", personaResponsable: "Ana", personaCliente: "Binary Forge — Diego Peña", horas: "26", trabajos: "Análisis y diagnóstico del memory leak del worker de embeddings. Documentación de arquitectura. Pendiente publicar hotfix v0.3.2.", version: "", estado: "enviado", notas: "Pendiente firma del cliente." },
    ]},
    { moduleKey: "catalogo-servicios", records: [
      { codigo: "INST", descripcion: "Servicios de Actualización e Instalación de Software", facturablePorDefecto: "no", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Onboarding inicial incluido en el contrato. Versiones puntuales puntuales por petición." },
      { codigo: "MANT", descripcion: "Servicios de Mantenimiento contra errores de programación", facturablePorDefecto: "no", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Cubierto por la cuota mensual. Bugs introducidos por nosotros. NO cubre nuevos desarrollos ni cambios de alcance." },
      { codigo: "NUEDES", descripcion: "Servicios de Desarrollo de nuevos módulos/funcionalidades", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "60", notas: "Funcionalidad nueva pedida por el cliente. Se factura por horas." },
      { codigo: "SOP", descripcion: "Soporte a usuarios", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Asistencia funcional a usuarios finales. Tickets, dudas, formación puntual. Bolsa de horas o por uso." },
      { codigo: "FORM", descripcion: "Formación a usuarios", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "6", tarifaHoraDefault: "65", notas: "Sesiones de formación presencial u online. Material formativo. Suele facturarse por jornada." },
      { codigo: "VERIFACTU", descripcion: "Adaptación a Veri*factu (AEAT)", facturablePorDefecto: "no", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Adaptación al sistema Veri*factu de la AEAT. Incluido en mantenimiento si el cliente está al día con cuotas." },
      { codigo: "SOPV", descripcion: "Soporte vConta (módulo contabilidad)", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Soporte específico del módulo de contabilidad vConta. Por uso." },
      { codigo: "SERPRE", descripcion: "Servicios de Desarrollo contra Presupuesto", facturablePorDefecto: "no", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "60", notas: "Servicio cerrado por presupuesto fijo. Las horas no se facturan en línea — se factura el presupuesto entero al cierre del hito." },
      { codigo: "FASE_I", descripcion: "Servicios de Desarrollo de fase de proyecto cerrado", facturablePorDefecto: "no", vigenciaMesesPorDefecto: "0", tarifaHoraDefault: "60", notas: "Iniciativa concreta con kickoff y deliverable final. Vigencia 0 = vinculada al cierre de fase, no a fecha." },
      { codigo: "BOLSA", descripcion: "Bolsa de horas prepagada", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "12", tarifaHoraDefault: "55", notas: "Bolsa prepagada. Las horas imputadas restan saldo. Cuando se agota, se renueva o se factura el sobreconsumo." },
      { codigo: "EVOLU", descripcion: "Mantenimiento evolutivo (sprint mensual)", facturablePorDefecto: "si", vigenciaMesesPorDefecto: "1", tarifaHoraDefault: "60", notas: "Sprint mensual de mejoras priorizadas con el cliente. Renovación mensual." },
    ]},
    { moduleKey: "descripciones-proyecto", records: [
      { proyecto: "ERP comercial Acme — Fase 2", objetivoNegocio: "Sustituir el ERP heredado de Acme (Navision 2010) por una solución moderna que permita escalar el negocio comercial sin la deuda técnica actual y reducir el tiempo de cierre mensual de 5 días a 1.", alcance: "Entra: módulos de clientes, productos, pedidos, facturación, reportes mensuales y exportación a contabilidad. NO entra: e-commerce, integración con Amazon, ni RRHH (lo gestionan en Sage).", restricciones: "Migración de 8 años de histórico desde Navision. Calendario condicionado al cierre fiscal de junio.", equipo: "Project lead: Laura. Devs: Pablo + freelance externo (4h/sem). QA: equipo de Acme.", riesgos: "1) Datos heredados con inconsistencias (alto). 2) Disponibilidad limitada del usuario clave de Acme (medio). 3) Integración con Sage no probada (medio).", estadoSituacional: "verde", ultimaActualizacion: "2026-04-22" },
      { proyecto: "Integración POS Nova", objetivoNegocio: "Conectar el TPV de las 14 tiendas físicas de Nova Retail con el ERP central, eliminando la conciliación manual diaria que hoy hacen 2 administrativas.", alcance: "Entra: integración bidireccional de productos y stock, cobro con Stripe, sincronización de tickets en tiempo real. NO entra: cambio de TPV (siguen con el actual de Glory).", restricciones: "Compatibilidad con TPV Glory v4.x. Conexión 4G en algunas tiendas obliga a sincronización offline-tolerant.", equipo: "Project lead: Carlos. Devs: Carlos. Cliente aporta: equipo IT Nova (Carlos Vidal).", riesgos: "1) Conectividad inestable en tiendas (alto). 2) Glory API documentada solo parcialmente (medio).", estadoSituacional: "verde", ultimaActualizacion: "2026-04-24" },
      { proyecto: "Plataforma soporte Binary", objetivoNegocio: "Construir un sistema de soporte conversacional con IA que reduzca el tiempo de primera respuesta de 4h a 5 minutos para los clientes finales de Binary Forge.", alcance: "Entra: ingesta de docs cliente, embeddings, chatbot conversacional, dashboard de métricas. NO entra: integración con Salesforce ni con tickets de soporte humano.", restricciones: "Coste de inferencia limitado a 2.000€/mes. Idioma español prioritario, inglés secundario.", equipo: "Project lead: Ana. Devs: Ana + Diego. Cliente aporta: Diego Peña como product owner.", riesgos: "1) Memory leak no resuelto (alto). 2) Calidad de la documentación cliente (medio). 3) Coste de tokens excede presupuesto si volumen sube (alto).", estadoSituacional: "ambar", ultimaActualizacion: "2026-04-25" },
      { proyecto: "Gestión taller López", objetivoNegocio: "Sustituir el cuaderno de papel y Excel del taller por un sistema digital de órdenes de trabajo, partes de horas y facturación, accesible también desde móvil para los mecánicos.", alcance: "Entra: clientes, vehículos, OTs, partes de horas, facturación con IVA, portal cliente. NO entra: pedidos a proveedores ni gestión de almacén (siguen con su sistema).", restricciones: "Mecánicos sin formación informática avanzada — UI debe ser muy simple. Móvil con mala conectividad en el foso del taller.", equipo: "Project lead: Miguel. Devs: Miguel. Cliente aporta: Roberto López como sponsor.", riesgos: "1) Resistencia al cambio del equipo (medio, mitigado con formación). 2) Móvil offline-first complejo (medio).", estadoSituacional: "verde", ultimaActualizacion: "2026-04-23" },
    ]},
  ],
  landing: {
    headline: "Controla clientes, proyectos, propuestas y cobros sin caos.",
    subheadline: "ERP online para software factories pequeñas.",
    bullets: [
      "Oportunidades, proyectos y entregables conectados",
      "Propuestas y facturas en el mismo flujo",
      "Pensado para equipos técnicos pequeños",
    ],
    cta: "Activa tu software factory online",
  },
  assistantCopy: {
    welcome: "Te ayudo a revisar oportunidades, proyectos, propuestas y facturas de la software factory.",
    suggestion: "Enséñame los proyectos activos y el pipeline abierto.",
  },
};

const GIMNASIO_PACK: SectorPackDefinition = {
  key: "gimnasio",
  label: "Gimnasio",
  sector: "fitness",
  businessType: "gimnasio",
  description: "ERP sectorial para gimnasios pequeños y medianos: socios, planes, clases, instructores y cuotas mensuales.",
  branding: {
    displayName: "Prontara Gym",
    shortName: "PG",
    accentColor: "#dc2626",
    logoHint: "energético, moderno, cercano",
    tone: "sectorial",
  },
  labels: {
    clientes: "Socios",
    crm: "Captación",
    proyectos: "Planes",
    presupuestos: "Bonos y packs",
    facturacion: "Cuotas",
    documentos: "Documentos",
    ajustes: "Ajustes",
    asistente: "Asistente",
  },
  renameMap: {
    cliente: "socio",
    clientes: "socios",
    proyecto: "plan",
    proyectos: "planes",
    factura: "cuota",
    facturas: "cuotas",
    presupuesto: "bono",
    presupuestos: "bonos",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Socios", navigationLabel: "Socios", emptyState: "Todavía no hay socios." },
    { moduleKey: "crm", enabled: true, label: "Captación", navigationLabel: "Captación", emptyState: "Sin leads en captación." },
    { moduleKey: "proyectos", enabled: true, label: "Planes y clases", navigationLabel: "Planes y clases", emptyState: "Todavía no hay planes ni clases." },
    { moduleKey: "presupuestos", enabled: true, label: "Bonos y packs", navigationLabel: "Bonos y packs", emptyState: "Sin bonos vendidos." },
    { moduleKey: "facturacion", enabled: true, label: "Cuotas", navigationLabel: "Cuotas", emptyState: "Todavía no hay cuotas." },
    { moduleKey: "documentos", enabled: true, label: "Documentos", navigationLabel: "Documentos", emptyState: "Sin contratos ni consentimientos cargados." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu gimnasio." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
  ],
  entities: [
    { key: "socio", label: "Socio", description: "Persona inscrita en el gimnasio.", moduleKey: "clientes", primaryFields: ["nombre", "telefono", "email", "plan_actual", "estado"], relatedTo: ["plan", "clase", "cuota", "documento"] },
    { key: "plan", label: "Plan", description: "Plan de entrenamiento o de cuota mensual.", moduleKey: "proyectos", primaryFields: ["nombre", "tipo", "precio_mensual"], relatedTo: ["socio", "cuota"] },
    { key: "clase", label: "Clase", description: "Clase colectiva o sesión grupal.", moduleKey: "proyectos", primaryFields: ["nombre", "instructor", "horario", "plazas"], relatedTo: ["instructor", "socio"] },
    { key: "instructor", label: "Instructor", description: "Profesional que imparte clases.", moduleKey: "clientes", primaryFields: ["nombre", "especialidad", "telefono"], relatedTo: ["clase"] },
    { key: "bono", label: "Bono", description: "Bono o pack puntual (no recurrente).", moduleKey: "presupuestos", primaryFields: ["concepto", "socio", "sesiones", "precio"], relatedTo: ["socio"] },
    { key: "cuota", label: "Cuota", description: "Cuota mensual del socio.", moduleKey: "facturacion", primaryFields: ["numero", "socio", "importe", "estado"], relatedTo: ["socio", "plan"] },
    { key: "documento", label: "Documento", description: "Contrato, consentimiento o certificado médico.", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "socio"], relatedTo: ["socio"] },
  ],
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Socio", kind: "text", required: true, placeholder: "Nombre del socio" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "socio@email.com" },
    { moduleKey: "clientes", fieldKey: "plan_actual", label: "Plan actual", kind: "text", placeholder: "Mensual / Trimestral / Personal" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / baja / pendiente_pago" },
    { moduleKey: "clientes", fieldKey: "fecha_alta", label: "Alta", kind: "date" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Plan o clase", kind: "text", required: true, placeholder: "Mensual, Personal training, Pilates..." },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "plan / clase" },
    { moduleKey: "proyectos", fieldKey: "instructor", label: "Instructor", kind: "text", placeholder: "Solo si es clase" },
    { moduleKey: "proyectos", fieldKey: "horario", label: "Horario", kind: "text", placeholder: "L-X-V 19:00 (solo clases)" },
    { moduleKey: "proyectos", fieldKey: "plazas", label: "Plazas", kind: "number", placeholder: "12" },
    { moduleKey: "proyectos", fieldKey: "precio_mensual", label: "Precio mensual", kind: "money", placeholder: "39 EUR" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº cuota", kind: "text", required: true, placeholder: "CUO-GYM-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Socio", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", placeholder: "Cuota mensual abril" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "39 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitida / cobrada / vencida" },

    // Bonos y packs (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº bono", kind: "text", placeholder: "Déjalo vacío y se autoasigna PRES-YYYY-NNN" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Socio", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Bono 10 sesiones personal" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "350 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / agotado", options: [
      { value: "activo", label: "Activo" },
      { value: "agotado", label: "Agotado" },
    ] },

    // CRM (Captación) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible socio", kind: "text", required: true, placeholder: "Persona interesada en apuntarse" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "lead@email.com" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen", kind: "text", placeholder: "Instagram / Recomendación / Web" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "lead / visitado / socio / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "visitado", label: "Visitado" },
      { value: "socio", label: "Socio" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Llamar para visita, enviar tarifas..." },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", kind: "text", required: true, placeholder: "Contrato socio, Cert. médico..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, placeholder: "contrato / certificado_medico / consentimiento_imagen / tarifa", options: [
      { value: "contrato", label: "Contrato" },
      { value: "certificado_medico", label: "Certificado médico" },
      { value: "consentimiento_imagen", label: "Consentimiento imagen" },
      { value: "tarifa", label: "Tarifa" },
    ] },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Socio", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha", kind: "date" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "borrador / vigente / archivado", options: [
      { value: "borrador", label: "Borrador" },
      { value: "vigente", label: "Vigente" },
      { value: "archivado", label: "Archivado" },
    ] },
  ],
  tableColumns: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Socio", isPrimary: true },
    { moduleKey: "clientes", fieldKey: "plan_actual", label: "Plan" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado" },
    { moduleKey: "proyectos", fieldKey: "nombre", label: "Plan o clase", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "proyectos", fieldKey: "horario", label: "Horario" },
    { moduleKey: "proyectos", fieldKey: "precio_mensual", label: "Precio" },
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Socio" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },

    // Bonos y packs (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Socio" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },

    // CRM (Captación) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible socio", isPrimary: true },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Socio" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado" },
  ],
  dashboardPriorities: [
    { key: "clientes", label: "Socios activos", description: "Socios al día con su cuota.", order: 1 },
    { key: "facturas", label: "Cuotas vencidas", description: "Socios que no han pagado este mes.", order: 2 },
    { key: "proyectos", label: "Clases de hoy", description: "Sesiones programadas hoy.", order: 3 },
    { key: "presupuestos", label: "Bonos vendidos", description: "Bonos puntuales activos.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Altas, bajas y movimientos recientes.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "Raúl Pérez", telefono: "+34 600 222 001", email: "raul@email.com", plan_actual: "Mensual", estado: "activo", fecha_alta: "2025-09-15" },
      { nombre: "Lucía Castro", telefono: "+34 600 222 002", email: "lucia@email.com", plan_actual: "Trimestral", estado: "activo", fecha_alta: "2024-11-03" },
      { nombre: "Iván Núñez", telefono: "+34 600 222 003", email: "ivan@email.com", plan_actual: "Personal training", estado: "activo", fecha_alta: "2025-12-01" },
      { nombre: "Marta Vidal", telefono: "+34 600 222 004", email: "marta@email.com", plan_actual: "Mensual", estado: "pendiente_pago", fecha_alta: "2024-06-20" },
      { nombre: "Carlos Bravo", telefono: "+34 600 222 005", email: "carlos@email.com", plan_actual: "Mensual", estado: "baja", fecha_alta: "2023-03-12" },
      { nombre: "Sara Llanos", telefono: "+34 600 222 006", email: "sara@email.com", plan_actual: "Mensual + Pilates", estado: "activo", fecha_alta: "2026-01-08" },
    ]},
    { moduleKey: "crm", records: [
      { nombre: "Pablo Ruiz", telefono: "+34 600 333 001", email: "pablo@email.com", origen: "Instagram", estado: "lead", proximoPaso: "Llamar para visita" },
      { nombre: "Elena Soto", telefono: "+34 600 333 002", email: "elena@email.com", origen: "Recomendación", estado: "visitado", proximoPaso: "Cerrar inscripción" },
      { nombre: "Mateo García", telefono: "+34 600 333 003", email: "mateo@email.com", origen: "Web", estado: "lead", proximoPaso: "Enviar tarifas" },
    ]},
    { moduleKey: "proyectos", records: [
      { nombre: "Mensual", tipo: "plan", precio_mensual: "39 EUR", plazas: "" },
      { nombre: "Trimestral", tipo: "plan", precio_mensual: "33 EUR", plazas: "" },
      { nombre: "Personal training", tipo: "plan", precio_mensual: "120 EUR", plazas: "" },
      { nombre: "Pilates", tipo: "clase", instructor: "Marta Bonilla", horario: "M-J 19:00", plazas: "12", precio_mensual: "0 EUR" },
      { nombre: "Spinning", tipo: "clase", instructor: "Jorge Lara", horario: "L-X 20:00", plazas: "16", precio_mensual: "0 EUR" },
      { nombre: "Funcional", tipo: "clase", instructor: "Marta Bonilla", horario: "Sábado 11:00", plazas: "14", precio_mensual: "0 EUR" },
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "BON-GYM-001", cliente: "Iván Núñez", concepto: "Bono 10 sesiones personal", importe: "350 EUR", estado: "activo" },
      { numero: "BON-GYM-002", cliente: "Sara Llanos", concepto: "Bono Pilates 8 clases", importe: "80 EUR", estado: "activo" },
      { numero: "BON-GYM-003", cliente: "Marta Vidal", concepto: "Bono 5 sesiones funcional", importe: "55 EUR", estado: "agotado" },
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "CUO-GYM-2026-04-001", cliente: "Raúl Pérez", concepto: "Cuota mensual abril", importe: "39 EUR", estado: "cobrada" },
      { numero: "CUO-GYM-2026-04-002", cliente: "Lucía Castro", concepto: "Cuota trimestral abril-junio", importe: "99 EUR", estado: "cobrada" },
      { numero: "CUO-GYM-2026-04-003", cliente: "Iván Núñez", concepto: "Personal training abril", importe: "120 EUR", estado: "emitida" },
      { numero: "CUO-GYM-2026-04-004", cliente: "Marta Vidal", concepto: "Cuota mensual abril", importe: "39 EUR", estado: "vencida" },
      { numero: "CUO-GYM-2026-04-005", cliente: "Sara Llanos", concepto: "Cuota mensual + Pilates abril", importe: "55 EUR", estado: "cobrada" },
      { numero: "CUO-GYM-2026-03-004", cliente: "Marta Vidal", concepto: "Cuota mensual marzo", importe: "39 EUR", estado: "vencida" },
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Contrato socio Raúl Pérez", tipo: "contrato", cliente: "Raúl Pérez", estado: "vigente" },
      { nombre: "Consentimiento RGPD Lucía Castro", tipo: "rgpd", cliente: "Lucía Castro", estado: "vigente" },
      { nombre: "Certificado médico Iván Núñez", tipo: "medico", cliente: "Iván Núñez", estado: "vigente" },
      { nombre: "Baja voluntaria Carlos Bravo", tipo: "baja", cliente: "Carlos Bravo", estado: "archivado" },
    ]},
  ],
  landing: {
    headline: "Gestiona socios, clases y cuotas sin complicarte.",
    subheadline: "ERP online claro para gimnasios pequeños: control de cuotas mensuales, ocupación de clases y captación.",
    bullets: [
      "Socios y captación en un solo sitio",
      "Cuotas mensuales con detección de morosos",
      "Clases con horarios, instructores y plazas",
      "Bonos puntuales y packs personal training",
    ],
    cta: "Activa tu gimnasio online",
  },
  assistantCopy: {
    welcome: "Te ayudo a revisar socios, clases, instructores y cuotas del gimnasio. Puedo decirte quién está en mora, qué clases tienen plazas libres o cómo va la captación de leads.",
    suggestion: "¿Qué socios tienen cuotas vencidas este mes?",
  },
};

const PELUQUERIA_PACK: SectorPackDefinition = {
  key: "peluqueria",
  label: "Peluquería",
  sector: "belleza",
  businessType: "peluqueria",
  description: "ERP sectorial para peluquerías y centros de estética: agenda de citas, fichas de cliente, servicios, productos y tickets.",
  branding: {
    displayName: "Prontara Beauty",
    shortName: "PB",
    accentColor: "#db2777",
    logoHint: "cuidado, elegante, cercano",
    tone: "sectorial",
  },
  labels: {
    clientes: "Clientes",
    crm: "Captación",
    proyectos: "Citas y servicios",
    presupuestos: "Bonos",
    facturacion: "Tickets",
    documentos: "Fichas y consentimientos",
    ajustes: "Ajustes",
    asistente: "Asistente",
  },
  renameMap: {
    proyecto: "cita",
    proyectos: "citas",
    factura: "ticket",
    facturas: "tickets",
    presupuesto: "bono",
    presupuestos: "bonos",
    documento: "ficha",
    documentos: "fichas",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Clientes", navigationLabel: "Clientes", emptyState: "Todavía no hay clientes." },
    { moduleKey: "crm", enabled: true, label: "Captación", navigationLabel: "Captación", emptyState: "Sin leads en captación." },
    { moduleKey: "proyectos", enabled: true, label: "Citas y servicios", navigationLabel: "Citas y servicios", emptyState: "No hay citas en agenda." },
    { moduleKey: "presupuestos", enabled: true, label: "Bonos", navigationLabel: "Bonos", emptyState: "No hay bonos vendidos." },
    { moduleKey: "facturacion", enabled: true, label: "Tickets", navigationLabel: "Tickets", emptyState: "Todavía no hay tickets." },
    { moduleKey: "documentos", enabled: true, label: "Fichas", navigationLabel: "Fichas", emptyState: "Sin fichas técnicas o consentimientos cargados." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu peluquería." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
  ],
  entities: [
    { key: "cliente", label: "Cliente", description: "Cliente del salón.", moduleKey: "clientes", primaryFields: ["nombre", "telefono", "color_actual", "ultimo_servicio"], relatedTo: ["cita", "ticket", "ficha"] },
    { key: "estilista", label: "Estilista", description: "Profesional del salón.", moduleKey: "clientes", primaryFields: ["nombre", "especialidad"], relatedTo: ["cita"] },
    { key: "servicio", label: "Servicio", description: "Catálogo de servicios disponibles (corte, color, tratamiento).", moduleKey: "proyectos", primaryFields: ["nombre", "duracion", "precio"], relatedTo: ["cita", "ticket"] },
    { key: "cita", label: "Cita", description: "Cita agendada de un cliente con un estilista.", moduleKey: "proyectos", primaryFields: ["fecha", "cliente", "servicio", "estilista", "estado"], relatedTo: ["cliente", "estilista", "servicio", "ticket"] },
    { key: "bono", label: "Bono", description: "Bono prepago de servicios (10 cortes, 5 mechas, etc.).", moduleKey: "presupuestos", primaryFields: ["concepto", "cliente", "sesiones", "precio"], relatedTo: ["cliente"] },
    { key: "ticket", label: "Ticket", description: "Cobro de servicios y productos.", moduleKey: "facturacion", primaryFields: ["numero", "cliente", "importe", "estado"], relatedTo: ["cliente", "cita"] },
    { key: "ficha", label: "Ficha", description: "Ficha técnica del cliente: alergias, fórmulas de color, consentimientos.", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "cliente"], relatedTo: ["cliente"] },
  ],
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Cliente", kind: "text", required: true, placeholder: "Nombre del cliente" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "cliente@email.com" },
    { moduleKey: "clientes", fieldKey: "color_actual", label: "Color/fórmula", kind: "text", placeholder: "Mechas californianas / Color 5.6" },
    { moduleKey: "clientes", fieldKey: "ultimo_servicio", label: "Último servicio", kind: "text", placeholder: "Color + corte (12 abr)" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / inactivo" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Cita o servicio", kind: "text", required: true, placeholder: "Corte, color, mechas, tratamiento..." },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo", kind: "text", required: true, placeholder: "cita / servicio (catálogo)" },
    { moduleKey: "proyectos", fieldKey: "fecha", label: "Fecha y hora", kind: "text", placeholder: "Solo si es cita: 2026-04-29 10:00" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "proyectos", fieldKey: "estilista", label: "Estilista", kind: "text", placeholder: "Quién atiende" },
    { moduleKey: "proyectos", fieldKey: "duracion", label: "Duración", kind: "text", placeholder: "30 min / 1h 30m" },
    { moduleKey: "proyectos", fieldKey: "precio", label: "Precio", kind: "money", placeholder: "45 EUR" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "agendada / completada / no_show / cancelada" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº ticket", kind: "text", required: true, placeholder: "TIC-BEA-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", placeholder: "Corte y peinado + producto" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "45 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitido / cobrado / pendiente" },

    // Bonos (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº bono", kind: "text", placeholder: "Déjalo vacío y se autoasigna PRES-YYYY-NNN" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Bono 10 lavados + peinados" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "150 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / agotado", options: [
      { value: "activo", label: "Activo" },
      { value: "agotado", label: "Agotado" },
    ] },

    // CRM — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible cliente", kind: "text", required: true, placeholder: "Persona interesada" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "lead@email.com" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen", kind: "text", placeholder: "Instagram / Recomendación / Web" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "lead / visitado / cliente / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "visitado", label: "Visitado" },
      { value: "cliente", label: "Cliente" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Llamar para agendar primera cita..." },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", kind: "text", required: true, placeholder: "Ficha color cliente, Consentimiento..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, placeholder: "ficha_color / consentimiento / contrato / informe", options: [
      { value: "ficha_color", label: "Ficha de color" },
      { value: "consentimiento", label: "Consentimiento" },
      { value: "contrato", label: "Contrato" },
      { value: "informe", label: "Informe" },
    ] },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha", kind: "date" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "borrador / vigente / archivado", options: [
      { value: "borrador", label: "Borrador" },
      { value: "vigente", label: "Vigente" },
      { value: "archivado", label: "Archivado" },
    ] },
  ],
  tableColumns: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Cliente", isPrimary: true },
    { moduleKey: "clientes", fieldKey: "color_actual", label: "Fórmula" },
    { moduleKey: "clientes", fieldKey: "ultimo_servicio", label: "Último" },
    { moduleKey: "proyectos", fieldKey: "fecha", label: "Cuándo", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "proyectos", fieldKey: "nombre", label: "Servicio" },
    { moduleKey: "proyectos", fieldKey: "estilista", label: "Estilista" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },

    // Bonos (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Importe" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },

    // CRM — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible cliente", isPrimary: true },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado" },
  ],
  dashboardPriorities: [
    { key: "proyectos", label: "Citas de hoy", description: "Citas agendadas para hoy.", order: 1 },
    { key: "clientes", label: "Clientes recurrentes", description: "Clientes con visitas frecuentes.", order: 2 },
    { key: "facturas", label: "Tickets del día", description: "Cobros del día y pendientes.", order: 3 },
    { key: "presupuestos", label: "Bonos activos", description: "Bonos prepago aún no consumidos.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Últimos movimientos.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "María Ruiz", telefono: "+34 600 333 001", email: "maria@email.com", color_actual: "Mechas + 5.6", ultimo_servicio: "Color + corte (12 abr)", estado: "activo" },
      { nombre: "Sandra León", telefono: "+34 600 333 002", email: "sandra@email.com", color_actual: "Castaño natural", ultimo_servicio: "Corte y peinado (24 abr)", estado: "activo" },
      { nombre: "Pilar Soto", telefono: "+34 600 333 003", email: "pilar@email.com", color_actual: "Color 7.0 + reflejos", ultimo_servicio: "Mechas (28 mar)", estado: "activo" },
      { nombre: "Lola Méndez", telefono: "+34 600 333 004", email: "lola@email.com", color_actual: "Rubio platino", ultimo_servicio: "Decoloración (15 abr)", estado: "activo" },
      { nombre: "Andrea Solís", telefono: "+34 600 333 005", email: "andrea@email.com", color_actual: "Color 4.0", ultimo_servicio: "Color (10 mar)", estado: "inactivo" },
      { nombre: "Carmen Vidal", telefono: "+34 600 333 006", email: "carmen@email.com", color_actual: "Sin color (canas naturales)", ultimo_servicio: "Corte (22 abr)", estado: "activo" },
    ]},
    { moduleKey: "proyectos", records: [
      { nombre: "Corte y peinado", tipo: "servicio", duracion: "45 min", precio: "30 EUR" },
      { nombre: "Color completo", tipo: "servicio", duracion: "1h 30m", precio: "55 EUR" },
      { nombre: "Mechas", tipo: "servicio", duracion: "2h", precio: "75 EUR" },
      { nombre: "Tratamiento de hidratación", tipo: "servicio", duracion: "30 min", precio: "25 EUR" },
      { nombre: "María Ruiz - Color + corte", tipo: "cita", fecha: "2026-04-29 10:00", cliente: "María Ruiz", estilista: "Lucía", duracion: "2h", precio: "85 EUR", estado: "agendada" },
      { nombre: "Pilar Soto - Mechas", tipo: "cita", fecha: "2026-04-29 12:00", cliente: "Pilar Soto", estilista: "Lucía", duracion: "2h", precio: "75 EUR", estado: "agendada" },
      { nombre: "Sandra León - Corte", tipo: "cita", fecha: "2026-04-29 17:00", cliente: "Sandra León", estilista: "Marta", duracion: "45 min", precio: "30 EUR", estado: "agendada" },
      { nombre: "Lola Méndez - Retoque", tipo: "cita", fecha: "2026-04-30 11:00", cliente: "Lola Méndez", estilista: "Lucía", duracion: "1h", precio: "45 EUR", estado: "agendada" },
    ]},
    { moduleKey: "crm", records: [
      { nombre: "Eva Martín", telefono: "+34 600 444 001", email: "eva@email.com", origen: "Recomendación de María Ruiz", estado: "lead", proximoPaso: "Llamar para agendar primera cita" },
      { nombre: "Beatriz Olmo", telefono: "+34 600 444 002", email: "bea@email.com", origen: "Instagram", estado: "lead", proximoPaso: "Enviar tarifas y disponibilidad" },
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "BON-BEA-001", cliente: "María Ruiz", concepto: "Bono 10 lavados + peinados", importe: "150 EUR", estado: "activo" },
      { numero: "BON-BEA-002", cliente: "Pilar Soto", concepto: "Bono 5 mechas anuales", importe: "320 EUR", estado: "activo" },
      { numero: "BON-BEA-003", cliente: "Carmen Vidal", concepto: "Bono 8 cortes", importe: "120 EUR", estado: "agotado" },
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "TIC-BEA-2026-04-024", cliente: "Sandra León", concepto: "Corte y peinado", importe: "30 EUR", estado: "cobrado" },
      { numero: "TIC-BEA-2026-04-025", cliente: "Lola Méndez", concepto: "Decoloración + tono", importe: "110 EUR", estado: "cobrado" },
      { numero: "TIC-BEA-2026-04-026", cliente: "Carmen Vidal", concepto: "Corte (consumido bono)", importe: "0 EUR", estado: "cobrado" },
      { numero: "TIC-BEA-2026-04-027", cliente: "María Ruiz", concepto: "Color + corte (4ª sesión)", importe: "85 EUR", estado: "emitido" },
      { numero: "TIC-BEA-2026-04-028", cliente: "Pilar Soto", concepto: "Producto - mascarilla pro", importe: "28 EUR", estado: "pendiente" },
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Ficha técnica color María Ruiz", tipo: "ficha_tecnica", cliente: "María Ruiz", estado: "vigente" },
      { nombre: "Consentimiento RGPD Sandra León", tipo: "rgpd", cliente: "Sandra León", estado: "vigente" },
      { nombre: "Alergias y observaciones Lola Méndez", tipo: "ficha_tecnica", cliente: "Lola Méndez", estado: "vigente" },
      { nombre: "Consentimiento decoloración Lola Méndez", tipo: "consentimiento", cliente: "Lola Méndez", estado: "vigente" },
    ]},
  ],
  landing: {
    headline: "Agenda, fichas técnicas y tickets en un solo sitio.",
    subheadline: "ERP online para peluquerías y centros de estética: control de citas, bonos prepago y fichas de fórmula del cliente.",
    bullets: [
      "Agenda diaria con cliente, servicio y estilista",
      "Ficha técnica del cliente (color, alergias, RGPD)",
      "Bonos prepago con saldo de sesiones",
      "Tickets cobrados al instante en caja",
    ],
    cta: "Activa tu peluquería online",
  },
  assistantCopy: {
    welcome: "Te ayudo con la agenda del salón, fichas técnicas, bonos y tickets. Puedo decirte qué citas hay hoy, qué bonos tienen saldo o qué clientes no han venido en 3 meses.",
    suggestion: "¿Qué citas tengo agendadas hoy?",
  },
};

const TALLER_PACK: SectorPackDefinition = {
  key: "taller",
  label: "Taller",
  sector: "automocion",
  businessType: "taller",
  description: "ERP sectorial para talleres mecánicos pequeños y medianos: clientes con sus vehículos, órdenes de trabajo, partes de horas, presupuestos firmables y facturación con IVA.",
  branding: {
    displayName: "Prontara Taller",
    shortName: "PTA",
    accentColor: "#ea580c",
    logoHint: "industrial, claro, fiable",
    tone: "sectorial",
  },
  labels: {
    clientes: "Clientes",
    crm: "Captación",
    proyectos: "Órdenes de trabajo",
    presupuestos: "Presupuestos",
    facturacion: "Facturas",
    documentos: "Partes y fotos",
    ajustes: "Ajustes",
    asistente: "Asistente",
  },
  renameMap: {
    proyecto: "OT",
    proyectos: "órdenes",
    documento: "parte",
    documentos: "partes",
    presupuesto: "presupuesto",
    presupuestos: "presupuestos",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Clientes y vehículos", navigationLabel: "Clientes", emptyState: "Todavía no hay clientes ni vehículos registrados." },
    { moduleKey: "crm", enabled: true, label: "Captación", navigationLabel: "Captación", emptyState: "Sin leads en captación." },
    { moduleKey: "proyectos", enabled: true, label: "Órdenes de trabajo", navigationLabel: "Órdenes (OT)", emptyState: "Sin órdenes abiertas." },
    { moduleKey: "presupuestos", enabled: true, label: "Presupuestos", navigationLabel: "Presupuestos", emptyState: "Sin presupuestos abiertos." },
    { moduleKey: "facturacion", enabled: true, label: "Facturas", navigationLabel: "Facturas", emptyState: "Sin facturas emitidas." },
    { moduleKey: "documentos", enabled: true, label: "Partes y fotos", navigationLabel: "Partes", emptyState: "Sin partes ni fotos del coche cargados." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu taller." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
  ],
  entities: [
    { key: "cliente", label: "Cliente", description: "Cliente del taller (particular o empresa).", moduleKey: "clientes", primaryFields: ["nombre", "telefono", "email", "tipo", "nif"], relatedTo: ["vehiculo", "orden", "presupuesto", "factura"] },
    { key: "vehiculo", label: "Vehículo", description: "Vehículo del cliente con matrícula y datos técnicos.", moduleKey: "clientes", primaryFields: ["matricula", "marca_modelo", "cliente", "kilometraje"], relatedTo: ["cliente", "orden"] },
    { key: "mecanico", label: "Mecánico", description: "Mecánico del taller que ejecuta órdenes.", moduleKey: "clientes", primaryFields: ["nombre", "especialidad"], relatedTo: ["orden"] },
    { key: "orden", label: "Orden de trabajo", description: "OT abierta para reparar/revisar un vehículo.", moduleKey: "proyectos", primaryFields: ["numero", "vehiculo", "cliente", "mecanico", "estado", "tipo"], relatedTo: ["cliente", "vehiculo", "mecanico", "presupuesto", "parte", "factura"] },
    { key: "presupuesto", label: "Presupuesto", description: "Presupuesto antes de empezar la reparación.", moduleKey: "presupuestos", primaryFields: ["numero", "cliente", "vehiculo", "importe", "estado"], relatedTo: ["cliente", "vehiculo", "orden", "factura"] },
    { key: "factura", label: "Factura", description: "Factura emitida al cliente.", moduleKey: "facturacion", primaryFields: ["numero", "cliente", "importe", "estado"], relatedTo: ["cliente", "orden"] },
    { key: "parte", label: "Parte / foto", description: "Parte de trabajo o foto del estado del vehículo.", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "cliente", "vehiculo"], relatedTo: ["cliente", "vehiculo", "orden"] },
  ],
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Cliente / matrícula", kind: "text", required: true, placeholder: "Nombre o matrícula" },
    { moduleKey: "clientes", fieldKey: "tipo", label: "Tipo", kind: "text", placeholder: "cliente / vehiculo / mecanico" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "cliente@email.com" },
    { moduleKey: "clientes", fieldKey: "nif", label: "NIF / CIF", kind: "text", placeholder: "12345678A" },
    { moduleKey: "clientes", fieldKey: "matricula", label: "Matrícula (vehículo)", kind: "text", placeholder: "1234 ABC" },
    { moduleKey: "clientes", fieldKey: "marca_modelo", label: "Marca y modelo (vehículo)", kind: "text", placeholder: "VW Golf 2018 1.6 TDI" },
    { moduleKey: "clientes", fieldKey: "kilometraje", label: "Kilometraje", kind: "number", placeholder: "85000" },
    { moduleKey: "clientes", fieldKey: "cliente", label: "Propietario (vehículo)", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / inactivo" },

    { moduleKey: "proyectos", fieldKey: "numero", label: "Nº OT", kind: "text", required: true, placeholder: "OT-2026-0042" },
    { moduleKey: "proyectos", fieldKey: "vehiculo", label: "Vehículo (matrícula)", kind: "text", required: true, placeholder: "1234 ABC" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "proyectos", fieldKey: "mecanico", label: "Mecánico asignado", kind: "text", placeholder: "Nombre del mecánico" },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo de trabajo", kind: "status", required: true, placeholder: "revision / averia / mantenimiento / itv / siniestro" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "abierta / en_taller / esperando_piezas / lista_para_entrega / entregada" },
    { moduleKey: "proyectos", fieldKey: "fecha_entrada", label: "Fecha entrada", kind: "date" },
    { moduleKey: "proyectos", fieldKey: "fecha_entrega", label: "Fecha entrega", kind: "date" },
    { moduleKey: "proyectos", fieldKey: "kilometraje_entrada", label: "Km entrada", kind: "number", placeholder: "85000" },
    { moduleKey: "proyectos", fieldKey: "horas_estimadas", label: "Horas estimadas", kind: "number", placeholder: "3" },
    { moduleKey: "proyectos", fieldKey: "horas_reales", label: "Horas reales", kind: "number", placeholder: "0" },
    { moduleKey: "proyectos", fieldKey: "descripcion_problema", label: "Descripción del problema", kind: "textarea", placeholder: "Lo que reporta el cliente" },

    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº presupuesto", kind: "text", required: true, placeholder: "PRE-TAL-2026-0042" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "vehiculo", label: "Vehículo (matrícula)", kind: "text", placeholder: "1234 ABC" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "textarea", required: true, placeholder: "Detalle del trabajo a realizar" },
    { moduleKey: "presupuestos", fieldKey: "mano_obra", label: "Mano de obra", kind: "money", placeholder: "120 EUR" },
    { moduleKey: "presupuestos", fieldKey: "piezas", label: "Importe piezas", kind: "money", placeholder: "180 EUR" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Total (con IVA)", kind: "money", required: true, placeholder: "363 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "borrador / enviado / aprobado / rechazado / caducado" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº factura", kind: "text", required: true, placeholder: "FAC-TAL-2026-0042" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", placeholder: "OT-2026-0042 - Cambio de aceite y filtros" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe (con IVA)", kind: "money", required: true, placeholder: "108 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitida / cobrada / vencida" },

    // CRM (Captación) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible cliente", kind: "text", required: true, placeholder: "Nombre del interesado" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "lead@email.com" },
    { moduleKey: "crm", fieldKey: "vehiculo", label: "Vehículo", kind: "text", placeholder: "Marca/modelo y matrícula del coche" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen", kind: "text", placeholder: "Recomendación / Cartel / Web" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "lead / visitado / cliente / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "visitado", label: "Visitado" },
      { value: "cliente", label: "Cliente" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Diagnosticar ruido, enviar presupuesto..." },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", kind: "text", required: true, placeholder: "Albarán proveedor, hoja de taller..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, placeholder: "albaran / hoja_taller / certificado / factura_proveedor / informe", options: [
      { value: "albaran", label: "Albarán" },
      { value: "hoja_taller", label: "Hoja de taller" },
      { value: "certificado", label: "Certificado" },
      { value: "factura_proveedor", label: "Factura proveedor" },
      { value: "informe", label: "Informe" },
    ] },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha", kind: "date" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "borrador / vigente / archivado", options: [
      { value: "borrador", label: "Borrador" },
      { value: "vigente", label: "Vigente" },
      { value: "archivado", label: "Archivado" },
    ] },
  ],
  tableColumns: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Cliente / vehículo", isPrimary: true },
    { moduleKey: "clientes", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "clientes", fieldKey: "matricula", label: "Matrícula" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado" },
    { moduleKey: "proyectos", fieldKey: "numero", label: "Nº OT", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "vehiculo", label: "Vehículo" },
    { moduleKey: "proyectos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "proyectos", fieldKey: "mecanico", label: "Mecánico" },
    { moduleKey: "proyectos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "presupuestos", fieldKey: "importe", label: "Total" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },

    // CRM (Captación) — AUDIT-03.
    { moduleKey: "crm", fieldKey: "nombre", label: "Posible cliente", isPrimary: true },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "crm", fieldKey: "vehiculo", label: "Vehículo" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    // Documentos — AUDIT-04.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Cliente" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado" },
  ],
  dashboardPriorities: [
    { key: "proyectos", label: "Vehículos en taller", description: "OTs en estado en_taller o esperando_piezas.", order: 1 },
    { key: "presupuestos", label: "Presupuestos sin aprobar", description: "Presupuestos enviados al cliente esperando luz verde.", order: 2 },
    { key: "facturas", label: "Facturas vencidas", description: "Cobros pendientes que necesitan seguimiento.", order: 3 },
    { key: "clientes", label: "Vehículos próximos a ITV", description: "Vehículos con ITV próxima por kilometraje o fecha.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Últimos movimientos.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "Javier Martín", tipo: "cliente", telefono: "+34 600 444 001", email: "javier@email.com", nif: "12345678A", estado: "activo" },
      { nombre: "Nuria Díaz", tipo: "cliente", telefono: "+34 600 444 002", email: "nuria@email.com", nif: "23456789B", estado: "activo" },
      { nombre: "Transportes Reyes S.L.", tipo: "cliente", telefono: "+34 600 444 003", email: "flota@reyes.com", nif: "B98765432", estado: "activo" },
      { nombre: "Marina Bouza", tipo: "cliente", telefono: "+34 600 444 004", email: "marina@email.com", nif: "34567890C", estado: "activo" },
      { nombre: "Hugo Roca", tipo: "cliente", telefono: "+34 600 444 005", email: "hugo@email.com", nif: "45678901D", estado: "activo" },
      { matricula: "1234 ABC", marca_modelo: "VW Golf 2018 1.6 TDI", tipo: "vehiculo", cliente: "Javier Martín", kilometraje: "98500", estado: "activo" },
      { matricula: "5678 DEF", marca_modelo: "Citroën C3 2020 1.2 PureTech", tipo: "vehiculo", cliente: "Nuria Díaz", kilometraje: "62300", estado: "activo" },
      { matricula: "9012 GHI", marca_modelo: "Mercedes Sprinter 2019 2.1 CDI", tipo: "vehiculo", cliente: "Transportes Reyes S.L.", kilometraje: "245000", estado: "activo" },
      { matricula: "3456 JKL", marca_modelo: "Toyota Yaris 2017 1.0", tipo: "vehiculo", cliente: "Transportes Reyes S.L.", kilometraje: "112000", estado: "activo" },
      { matricula: "7890 MNO", marca_modelo: "Renault Clio 2021 1.0 TCe", tipo: "vehiculo", cliente: "Marina Bouza", kilometraje: "34000", estado: "activo" },
      { matricula: "2345 PQR", marca_modelo: "Ford Focus 2015 1.6 TDCI", tipo: "vehiculo", cliente: "Hugo Roca", kilometraje: "187000", estado: "activo" },
      { nombre: "Antonio Mecánico", tipo: "mecanico", telefono: "+34 600 555 001", estado: "activo" },
      { nombre: "Pedro Mecánico", tipo: "mecanico", telefono: "+34 600 555 002", estado: "activo" },
      { nombre: "Sara Mecánica", tipo: "mecanico", telefono: "+34 600 555 003", estado: "activo" },
    ]},
    { moduleKey: "crm", records: [
      { nombre: "Roberto Solís", telefono: "+34 600 666 001", origen: "Recomendación de Javier Martín", estado: "lead", proximoPaso: "Llamar para diagnosticar ruido suspensión" },
      { nombre: "Helena Mora", telefono: "+34 600 666 002", origen: "Cartel taller", estado: "visitado", proximoPaso: "Enviar presupuesto cambio embrague" },
    ]},
    { moduleKey: "proyectos", records: [
      { numero: "OT-2026-0040", vehiculo: "1234 ABC", cliente: "Javier Martín", mecanico: "Antonio Mecánico", tipo: "mantenimiento", estado: "entregada", fecha_entrada: "2026-04-15", fecha_entrega: "2026-04-16", kilometraje_entrada: "98000", horas_estimadas: "1.5", horas_reales: "1.5", descripcion_problema: "Cambio de aceite y filtros" },
      { numero: "OT-2026-0041", vehiculo: "5678 DEF", cliente: "Nuria Díaz", mecanico: "Pedro Mecánico", tipo: "averia", estado: "esperando_piezas", fecha_entrada: "2026-04-22", kilometraje_entrada: "62300", horas_estimadas: "8", horas_reales: "3", descripcion_problema: "Embrague patina al pisar acelerador en cuesta. Ruido al arrancar." },
      { numero: "OT-2026-0042", vehiculo: "9012 GHI", cliente: "Transportes Reyes S.L.", mecanico: "Antonio Mecánico", tipo: "revision", estado: "en_taller", fecha_entrada: "2026-04-26", kilometraje_entrada: "245000", horas_estimadas: "4", horas_reales: "2", descripcion_problema: "Revisión 250.000 km: aceite, filtros, correa, frenos." },
      { numero: "OT-2026-0043", vehiculo: "7890 MNO", cliente: "Marina Bouza", mecanico: "Sara Mecánica", tipo: "itv", estado: "lista_para_entrega", fecha_entrada: "2026-04-27", kilometraje_entrada: "34000", horas_estimadas: "1", horas_reales: "1", descripcion_problema: "Pre-ITV: revisión luces, frenos, neumáticos." },
      { numero: "OT-2026-0044", vehiculo: "2345 PQR", cliente: "Hugo Roca", mecanico: "Pedro Mecánico", tipo: "averia", estado: "abierta", fecha_entrada: "2026-04-28", kilometraje_entrada: "187000", horas_estimadas: "0", descripcion_problema: "Pierde aceite. Diagnosticar pendiente." },
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "PRE-TAL-2026-0041", cliente: "Nuria Díaz", vehiculo: "5678 DEF", concepto: "Cambio de embrague kit completo + mano de obra", mano_obra: "240 EUR", piezas: "320 EUR", importe: "678 EUR", estado: "aprobado" },
      { numero: "PRE-TAL-2026-0042", cliente: "Transportes Reyes S.L.", vehiculo: "9012 GHI", concepto: "Revisión 250.000 km: aceite, filtros (4), correa distribución, pastillas freno", mano_obra: "180 EUR", piezas: "420 EUR", importe: "726 EUR", estado: "aprobado" },
      { numero: "PRE-TAL-2026-0043", cliente: "Marina Bouza", vehiculo: "7890 MNO", concepto: "Pre-ITV: revisión + ajuste freno trasero + bombilla cruce", mano_obra: "60 EUR", piezas: "8 EUR", importe: "82 EUR", estado: "aprobado" },
      { numero: "PRE-TAL-2026-0044", cliente: "Hugo Roca", vehiculo: "2345 PQR", concepto: "Pendiente diagnóstico — fuga aceite", mano_obra: "0 EUR", piezas: "0 EUR", importe: "0 EUR", estado: "borrador" },
      { numero: "PRE-TAL-2026-0045", cliente: "Helena Mora", vehiculo: "(externo)", concepto: "Cambio embrague + revisión general", mano_obra: "260 EUR", piezas: "340 EUR", importe: "726 EUR", estado: "enviado" },
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "FAC-TAL-2026-0040", cliente: "Javier Martín", concepto: "OT-2026-0040 - Cambio de aceite y filtros", importe: "108 EUR", estado: "cobrada" },
      { numero: "FAC-TAL-2026-0041", cliente: "Nuria Díaz", concepto: "OT-2026-0041 - Cambio embrague (50% inicial)", importe: "339 EUR", estado: "cobrada" },
      { numero: "FAC-TAL-2026-0042", cliente: "Transportes Reyes S.L.", concepto: "OT-2026-0042 - Revisión 250.000 km", importe: "726 EUR", estado: "emitida" },
      { numero: "FAC-TAL-2026-0043", cliente: "Marina Bouza", concepto: "OT-2026-0043 - Pre-ITV", importe: "82 EUR", estado: "emitida" },
      { numero: "FAC-TAL-2026-0038", cliente: "Hugo Roca", concepto: "OT-2026-0038 - Cambio frenos delanteros", importe: "215 EUR", estado: "vencida" },
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Foto entrada VW Golf 1234 ABC", tipo: "foto_entrada", cliente: "Javier Martín", vehiculo: "1234 ABC", estado: "vigente" },
      { nombre: "Parte trabajo OT-2026-0040", tipo: "parte", cliente: "Javier Martín", vehiculo: "1234 ABC", estado: "vigente" },
      { nombre: "Foto daño embrague Citroën C3", tipo: "foto_diagnostico", cliente: "Nuria Díaz", vehiculo: "5678 DEF", estado: "vigente" },
      { nombre: "Albarán de piezas Mercedes Sprinter", tipo: "albaran", cliente: "Transportes Reyes S.L.", vehiculo: "9012 GHI", estado: "vigente" },
      { nombre: "Parte ITV pendiente Renault Clio", tipo: "parte", cliente: "Marina Bouza", vehiculo: "7890 MNO", estado: "vigente" },
      { nombre: "Consentimiento RGPD Javier Martín", tipo: "rgpd", cliente: "Javier Martín", estado: "firmado" },
    ]},
  ],
  landing: {
    headline: "Clientes, vehículos, OTs y facturas en un solo entorno.",
    subheadline: "ERP online claro para talleres mecánicos pequeños y medianos: agenda de trabajos, presupuestos firmables, partes de horas y facturación con IVA. Compatible con flotas y particulares.",
    bullets: [
      "Cliente y sus vehículos vinculados con su historial",
      "Órdenes de trabajo con mecánico, horas estimadas vs reales y estado claro",
      "Presupuestos firmables antes de empezar la reparación",
      "Facturación con IVA y detección de cobros vencidos",
    ],
    cta: "Activa tu taller online",
  },
  assistantCopy: {
    welcome: "Te ayudo con la operación del taller: vehículos en cola, presupuestos esperando OK del cliente, facturas vencidas, vehículos próximos a la ITV, mecánicos disponibles. Pídeme lo que necesites en lenguaje natural.",
    suggestion: "¿Qué vehículos tengo en taller ahora mismo y qué presupuestos llevan más de 5 días sin aprobar?",
  },
};

const COLEGIO_PACK: SectorPackDefinition = {
  key: "colegio",
  label: "Colegio",
  sector: "educacion",
  businessType: "colegio",
  description: "ERP sectorial para colegios pequeños y academias: familias, alumnos, cursos, recibos mensuales y expedientes académicos.",
  branding: {
    displayName: "Prontara School",
    shortName: "PS",
    accentColor: "#7c3aed",
    logoHint: "educativo, cercano, ordenado",
    tone: "sectorial",
  },
  labels: {
    clientes: "Familias",
    crm: "Admisiones",
    proyectos: "Cursos y grupos",
    presupuestos: "Servicios complementarios",
    facturacion: "Recibos",
    documentos: "Expedientes",
    ajustes: "Ajustes",
    asistente: "Asistente",
    // SCHOOL-01 — módulos extendidos
    calificaciones: "Calificaciones",
    asistencia: "Asistencia",
    docentes: "Docentes",
    horarios: "Horarios",
    planeaciones: "Planeaciones",
    disciplina: "Convivencia",
    orientacion: "Orientación",
    enfermeria: "Enfermería",
    comunicaciones: "Comunicaciones",
    eventos: "Calendario",
    transporte: "Transporte",
    comedor: "Comedor",
    biblioteca: "Biblioteca",
    inventario: "Inventario",
    mantenimiento: "Mantenimiento",
    personal: "Personal",
    visitantes: "Visitantes",
    tramites: "Trámites",
    becas: "Becas",
    actividades: "Extracurriculares",
    salidas: "Salidas",
    egresados: "Egresados",
  },
  renameMap: {
    cliente: "familia",
    clientes: "familias",
    proyecto: "curso",
    proyectos: "cursos",
    factura: "recibo",
    facturas: "recibos",
    documento: "expediente",
    documentos: "expedientes",
    presupuesto: "servicio",
    presupuestos: "servicios",
  },
  modules: [
    { moduleKey: "clientes", enabled: true, label: "Familias", navigationLabel: "Familias", emptyState: "Todavía no hay familias." },
    { moduleKey: "crm", enabled: true, label: "Admisiones", navigationLabel: "Admisiones", emptyState: "Sin solicitudes de admisión pendientes." },
    { moduleKey: "proyectos", enabled: true, label: "Cursos y grupos", navigationLabel: "Cursos y grupos", emptyState: "Todavía no hay cursos." },
    { moduleKey: "presupuestos", enabled: true, label: "Servicios complementarios", navigationLabel: "Servicios complementarios", emptyState: "Sin servicios complementarios contratados." },
    { moduleKey: "facturacion", enabled: true, label: "Recibos", navigationLabel: "Recibos", emptyState: "Todavía no hay recibos." },
    { moduleKey: "documentos", enabled: true, label: "Expedientes", navigationLabel: "Expedientes", emptyState: "Sin expedientes cargados." },
    { moduleKey: "ajustes", enabled: true, label: "Ajustes", navigationLabel: "Ajustes", emptyState: "Configura tu colegio." },
    // SCHOOL-01 — los 22 módulos extendidos del ERP escolar.
    { moduleKey: "calificaciones", enabled: true, label: "Calificaciones", navigationLabel: "Calificaciones", emptyState: "Todavía no hay notas registradas." },
    { moduleKey: "asistencia", enabled: true, label: "Asistencia", navigationLabel: "Asistencia", emptyState: "Sin registros de asistencia hoy." },
    { moduleKey: "docentes", enabled: true, label: "Docentes", navigationLabel: "Docentes", emptyState: "Todavía no hay docentes." },
    { moduleKey: "horarios", enabled: true, label: "Horarios", navigationLabel: "Horarios", emptyState: "Sin horarios definidos." },
    { moduleKey: "planeaciones", enabled: true, label: "Planeaciones", navigationLabel: "Planeaciones", emptyState: "Sin planeaciones cargadas." },
    { moduleKey: "disciplina", enabled: true, label: "Convivencia", navigationLabel: "Convivencia", emptyState: "Sin incidencias registradas." },
    { moduleKey: "orientacion", enabled: true, label: "Orientación", navigationLabel: "Orientación", emptyState: "Sin atenciones registradas." },
    { moduleKey: "enfermeria", enabled: true, label: "Enfermería", navigationLabel: "Enfermería", emptyState: "Sin atenciones médicas registradas." },
    { moduleKey: "comunicaciones", enabled: true, label: "Comunicaciones", navigationLabel: "Comunicaciones", emptyState: "Sin comunicados enviados." },
    { moduleKey: "eventos", enabled: true, label: "Calendario", navigationLabel: "Calendario", emptyState: "Sin eventos en el calendario." },
    { moduleKey: "transporte", enabled: true, label: "Transporte", navigationLabel: "Transporte", emptyState: "Sin rutas configuradas." },
    { moduleKey: "comedor", enabled: true, label: "Comedor", navigationLabel: "Comedor", emptyState: "Sin menús cargados." },
    { moduleKey: "biblioteca", enabled: true, label: "Biblioteca", navigationLabel: "Biblioteca", emptyState: "Sin préstamos registrados." },
    { moduleKey: "inventario", enabled: true, label: "Inventario", navigationLabel: "Inventario", emptyState: "Sin activos registrados." },
    { moduleKey: "mantenimiento", enabled: true, label: "Mantenimiento", navigationLabel: "Mantenimiento", emptyState: "Sin solicitudes de mantenimiento." },
    { moduleKey: "personal", enabled: true, label: "Personal", navigationLabel: "Personal", emptyState: "Sin personal registrado." },
    { moduleKey: "visitantes", enabled: true, label: "Visitantes", navigationLabel: "Visitantes", emptyState: "Sin registros de visitantes." },
    { moduleKey: "tramites", enabled: true, label: "Trámites", navigationLabel: "Trámites", emptyState: "Sin trámites pendientes." },
    { moduleKey: "becas", enabled: true, label: "Becas", navigationLabel: "Becas", emptyState: "Sin becas concedidas." },
    { moduleKey: "actividades", enabled: true, label: "Extracurriculares", navigationLabel: "Extracurriculares", emptyState: "Sin actividades extracurriculares." },
    { moduleKey: "salidas", enabled: true, label: "Salidas", navigationLabel: "Salidas", emptyState: "Sin salidas pedagógicas planificadas." },
    { moduleKey: "egresados", enabled: true, label: "Egresados", navigationLabel: "Egresados", emptyState: "Sin egresados registrados." },
    { moduleKey: "asistente", enabled: true, label: "Asistente", navigationLabel: "Asistente", emptyState: "Haz tu primera consulta." },
  ],
  entities: [
    { key: "familia", label: "Familia", description: "Unidad familiar pagadora del colegio.", moduleKey: "clientes", primaryFields: ["nombre", "telefono", "email", "tutor_principal", "estado"], relatedTo: ["alumno", "curso", "recibo", "expediente"] },
    { key: "alumno", label: "Alumno", description: "Estudiante matriculado.", moduleKey: "clientes", primaryFields: ["nombre", "familia", "curso", "fecha_nacimiento"], relatedTo: ["familia", "curso", "expediente"] },
    { key: "curso", label: "Curso", description: "Curso, grupo o etapa académica.", moduleKey: "proyectos", primaryFields: ["nombre", "etapa", "tutor", "alumnos_matriculados"], relatedTo: ["alumno", "expediente"] },
    { key: "servicio_complementario", label: "Servicio complementario", description: "Comedor, transporte, extraescolares, idiomas, etc.", moduleKey: "presupuestos", primaryFields: ["concepto", "familia", "precio_mensual"], relatedTo: ["familia"] },
    { key: "recibo", label: "Recibo", description: "Recibo mensual de la familia (cuota + complementarios).", moduleKey: "facturacion", primaryFields: ["numero", "familia", "importe", "estado"], relatedTo: ["familia"] },
    { key: "expediente", label: "Expediente", description: "Expediente académico del alumno (notas, partes, autorizaciones).", moduleKey: "documentos", primaryFields: ["nombre", "tipo", "familia"], relatedTo: ["familia", "alumno", "curso"] },
  ],
  fields: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Familia / Alumno", kind: "text", required: true, placeholder: "Apellidos de la familia" },
    { moduleKey: "clientes", fieldKey: "tipo", label: "Tipo", kind: "text", placeholder: "familia / alumno" },
    { moduleKey: "clientes", fieldKey: "tutor_principal", label: "Tutor principal", kind: "text", placeholder: "Nombre del tutor" },
    { moduleKey: "clientes", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "clientes", fieldKey: "email", label: "Email", kind: "email", placeholder: "familia@email.com" },
    { moduleKey: "clientes", fieldKey: "familia", label: "Familia (si es alumno)", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "clientes", fieldKey: "curso", label: "Curso (si es alumno)", kind: "text", placeholder: "Primaria 2º, Infantil 5..." },
    { moduleKey: "clientes", fieldKey: "fecha_nacimiento", label: "Fecha nacimiento (alumno)", kind: "date" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "matriculado / baja / pendiente" },

    { moduleKey: "proyectos", fieldKey: "nombre", label: "Curso o grupo", kind: "text", required: true, placeholder: "Primaria 2º A, Infantil 5..." },
    { moduleKey: "proyectos", fieldKey: "etapa", label: "Etapa", kind: "text", placeholder: "Infantil / Primaria / ESO" },
    { moduleKey: "proyectos", fieldKey: "tutor", label: "Tutor del grupo", kind: "text", placeholder: "Profesor tutor" },
    { moduleKey: "proyectos", fieldKey: "alumnos_matriculados", label: "Alumnos matriculados", kind: "number", placeholder: "20" },
    { moduleKey: "proyectos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "abierto / cerrado" },

    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº recibo", kind: "text", required: true, placeholder: "REC-SCH-2026-04-001" },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Familia", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "facturacion", fieldKey: "concepto", label: "Concepto", kind: "text", placeholder: "Cuota mensual + comedor + transporte" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe", kind: "money", required: true, placeholder: "320 EUR" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "emitido / cobrado / vencido / devuelto" },

    // Servicios complementarios (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº servicio", kind: "text", placeholder: "Déjalo vacío y se autoasigna PRES-YYYY-NNN" },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Familia", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto", kind: "text", required: true, placeholder: "Comedor + transporte" },
    { moduleKey: "presupuestos", fieldKey: "precio_mensual", label: "Precio mensual", kind: "money", required: true, placeholder: "180 EUR" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "activo / suspendido / baja", options: [
      { value: "activo", label: "Activo" },
      { value: "suspendido", label: "Suspendido" },
      { value: "baja", label: "Baja" },
    ] },

    // CRM (Admisiones) — AUDIT-02.
    { moduleKey: "crm", fieldKey: "nombre", label: "Familia interesada", kind: "text", required: true, placeholder: "Apellidos de la familia" },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono", kind: "tel", placeholder: "+34 ..." },
    { moduleKey: "crm", fieldKey: "email", label: "Email", kind: "email", placeholder: "familia@email.com" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen", kind: "text", placeholder: "Open day / Recomendación / Web" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "lead / visitado / matriculado / perdido", options: [
      { value: "lead", label: "Lead" },
      { value: "visitado", label: "Visitado" },
      { value: "matriculado", label: "Matriculado" },
      { value: "perdido", label: "Perdido" },
    ] },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso", kind: "textarea", placeholder: "Enviar formulario admisión, agendar visita..." },

    // Expedientes (documentos) — AUDIT-02.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", kind: "text", required: true, placeholder: "Expediente, Autorización, Boletín..." },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, placeholder: "expediente / autorizacion / admision / boletin / informe", options: [
      { value: "expediente", label: "Expediente académico" },
      { value: "autorizacion", label: "Autorización" },
      { value: "admision", label: "Admisión" },
      { value: "boletin", label: "Boletín" },
      { value: "informe", label: "Informe" },
    ] },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Familia", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha", kind: "date" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado", kind: "status", placeholder: "vigente / en_revision / archivado", options: [
      { value: "vigente", label: "Vigente" },
      { value: "en_revision", label: "En revisión" },
      { value: "archivado", label: "Archivado" },
    ] },

    // ============================================================
    // SCHOOL-01 — fields de los 22 módulos extendidos del ERP escolar
    // ============================================================

    // Calificaciones
    { moduleKey: "calificaciones", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "calificaciones", fieldKey: "asignatura", label: "Asignatura", kind: "text", required: true, placeholder: "Matemáticas, Lengua..." },
    { moduleKey: "calificaciones", fieldKey: "periodo", label: "Periodo", kind: "status", required: true, placeholder: "1T / 2T / 3T / final", options: [
      { value: "1T", label: "1er trimestre" }, { value: "2T", label: "2º trimestre" }, { value: "3T", label: "3er trimestre" }, { value: "final", label: "Final" },
    ] },
    { moduleKey: "calificaciones", fieldKey: "tipoEvaluacion", label: "Tipo", kind: "status", placeholder: "examen / trabajo / participacion / proyecto", options: [
      { value: "examen", label: "Examen" }, { value: "trabajo", label: "Trabajo" }, { value: "participacion", label: "Participación" }, { value: "proyecto", label: "Proyecto" },
    ] },
    { moduleKey: "calificaciones", fieldKey: "nota", label: "Nota", kind: "number", required: true, placeholder: "0-10" },
    { moduleKey: "calificaciones", fieldKey: "peso", label: "Peso (%)", kind: "number", placeholder: "10, 20, 40..." },
    { moduleKey: "calificaciones", fieldKey: "observaciones", label: "Observaciones", kind: "textarea" },

    // Asistencia
    { moduleKey: "asistencia", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "asistencia", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
    { moduleKey: "asistencia", fieldKey: "curso", label: "Curso", kind: "relation", relationModuleKey: "proyectos" },
    { moduleKey: "asistencia", fieldKey: "estado", label: "Estado", kind: "status", required: true, placeholder: "presente / ausente / tarde / justificada", options: [
      { value: "presente", label: "Presente" }, { value: "ausente", label: "Ausente" }, { value: "tarde", label: "Tarde" }, { value: "justificada", label: "Falta justificada" },
    ] },
    { moduleKey: "asistencia", fieldKey: "motivo", label: "Motivo / justificación", kind: "textarea" },

    // Docentes
    { moduleKey: "docentes", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
    { moduleKey: "docentes", fieldKey: "email", label: "Email", kind: "email" },
    { moduleKey: "docentes", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
    { moduleKey: "docentes", fieldKey: "especialidad", label: "Especialidad", kind: "text", placeholder: "Matemáticas, Inglés, Educación física..." },
    { moduleKey: "docentes", fieldKey: "etapa", label: "Etapa", kind: "text", placeholder: "Infantil / Primaria / ESO" },
    { moduleKey: "docentes", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "activo", label: "Activo" }, { value: "baja", label: "Baja" }, { value: "sustituto", label: "Sustituto" },
    ] },

    // Horarios
    { moduleKey: "horarios", fieldKey: "curso", label: "Curso", kind: "relation", required: true, relationModuleKey: "proyectos" },
    { moduleKey: "horarios", fieldKey: "diaSemana", label: "Día", kind: "status", required: true, options: [
      { value: "lunes", label: "Lunes" }, { value: "martes", label: "Martes" }, { value: "miercoles", label: "Miércoles" }, { value: "jueves", label: "Jueves" }, { value: "viernes", label: "Viernes" },
    ] },
    { moduleKey: "horarios", fieldKey: "horaInicio", label: "Hora inicio", kind: "text", placeholder: "09:00", required: true },
    { moduleKey: "horarios", fieldKey: "horaFin", label: "Hora fin", kind: "text", placeholder: "10:00", required: true },
    { moduleKey: "horarios", fieldKey: "asignatura", label: "Asignatura", kind: "text", required: true },
    { moduleKey: "horarios", fieldKey: "docente", label: "Docente", kind: "relation", relationModuleKey: "docentes" },
    { moduleKey: "horarios", fieldKey: "aula", label: "Aula", kind: "text", placeholder: "A-12, B-3..." },

    // Planeaciones
    { moduleKey: "planeaciones", fieldKey: "asignatura", label: "Asignatura", kind: "text", required: true },
    { moduleKey: "planeaciones", fieldKey: "curso", label: "Curso", kind: "relation", relationModuleKey: "proyectos" },
    { moduleKey: "planeaciones", fieldKey: "docente", label: "Docente", kind: "relation", relationModuleKey: "docentes" },
    { moduleKey: "planeaciones", fieldKey: "periodo", label: "Periodo", kind: "text", placeholder: "1T 2026, Unidad 3..." },
    { moduleKey: "planeaciones", fieldKey: "objetivos", label: "Objetivos de aprendizaje", kind: "textarea", required: true },
    { moduleKey: "planeaciones", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "borrador", label: "Borrador" }, { value: "aprobada", label: "Aprobada" }, { value: "en_curso", label: "En curso" }, { value: "completada", label: "Completada" },
    ] },

    // Convivencia (disciplina)
    { moduleKey: "disciplina", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "disciplina", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
    { moduleKey: "disciplina", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
      { value: "leve", label: "Falta leve" }, { value: "grave", label: "Falta grave" }, { value: "muy_grave", label: "Muy grave" }, { value: "positivo", label: "Reconocimiento positivo" },
    ] },
    { moduleKey: "disciplina", fieldKey: "descripcion", label: "Descripción", kind: "textarea", required: true },
    { moduleKey: "disciplina", fieldKey: "medida", label: "Medida adoptada", kind: "textarea" },
    { moduleKey: "disciplina", fieldKey: "responsable", label: "Reportado por", kind: "text" },

    // Orientación
    { moduleKey: "orientacion", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "orientacion", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
    { moduleKey: "orientacion", fieldKey: "motivo", label: "Motivo", kind: "text", required: true, placeholder: "Dificultades aprendizaje, conducta, familiar..." },
    { moduleKey: "orientacion", fieldKey: "intervencion", label: "Intervención", kind: "textarea" },
    { moduleKey: "orientacion", fieldKey: "responsable", label: "Profesional", kind: "text", placeholder: "Orientador / psicólogo" },
    { moduleKey: "orientacion", fieldKey: "estado", label: "Estado", kind: "status", options: [
      { value: "abierto", label: "Abierto" }, { value: "seguimiento", label: "En seguimiento" }, { value: "cerrado", label: "Cerrado" },
    ] },

    // Enfermería
    { moduleKey: "enfermeria", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "enfermeria", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
    { moduleKey: "enfermeria", fieldKey: "motivo", label: "Motivo", kind: "text", required: true, placeholder: "Dolor cabeza, caída, fiebre..." },
    { moduleKey: "enfermeria", fieldKey: "atencion", label: "Atención prestada", kind: "textarea" },
    { moduleKey: "enfermeria", fieldKey: "medicacion", label: "Medicación administrada", kind: "text" },
    { moduleKey: "enfermeria", fieldKey: "avisoFamilia", label: "Aviso familia", kind: "status", options: [
      { value: "si", label: "Sí" }, { value: "no", label: "No" },
    ] },

    // Comunicaciones
    { moduleKey: "comunicaciones", fieldKey: "asunto", label: "Asunto", kind: "text", required: true },
    { moduleKey: "comunicaciones", fieldKey: "destinatarios", label: "Destinatarios", kind: "text", placeholder: "Toda la familia / Primaria / Curso 2ºA..." },
    { moduleKey: "comunicaciones", fieldKey: "mensaje", label: "Mensaje", kind: "textarea", required: true },
    { moduleKey: "comunicaciones", fieldKey: "fechaEnvio", label: "Fecha envío", kind: "date" },
    { moduleKey: "comunicaciones", fieldKey: "canal", label: "Canal", kind: "status", options: [
      { value: "email", label: "Email" }, { value: "app", label: "App" }, { value: "sms", label: "SMS" }, { value: "papel", label: "Papel" },
    ] },
    { moduleKey: "comunicaciones", fieldKey: "estado", label: "Estado", kind: "status", options: [
      { value: "borrador", label: "Borrador" }, { value: "enviado", label: "Enviado" },
    ] },

    // Eventos
    { moduleKey: "eventos", fieldKey: "titulo", label: "Título", kind: "text", required: true },
    { moduleKey: "eventos", fieldKey: "fechaInicio", label: "Fecha inicio", kind: "date", required: true },
    { moduleKey: "eventos", fieldKey: "fechaFin", label: "Fecha fin", kind: "date" },
    { moduleKey: "eventos", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
      { value: "academico", label: "Académico" }, { value: "festivo", label: "Festivo" }, { value: "reunion", label: "Reunión" }, { value: "salida", label: "Salida" }, { value: "evaluacion", label: "Evaluaciones" },
    ] },
    { moduleKey: "eventos", fieldKey: "alcance", label: "Alcance", kind: "text", placeholder: "Toda la escuela / Primaria / 3ºA..." },
    { moduleKey: "eventos", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },

    // Transporte
    { moduleKey: "transporte", fieldKey: "ruta", label: "Ruta", kind: "text", required: true, placeholder: "Ruta Norte, Ruta Centro..." },
    { moduleKey: "transporte", fieldKey: "alumno", label: "Alumno", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "transporte", fieldKey: "parada", label: "Parada", kind: "text", placeholder: "Plaza Mayor, esquina..." },
    { moduleKey: "transporte", fieldKey: "horaRecogida", label: "Hora recogida", kind: "text", placeholder: "08:15" },
    { moduleKey: "transporte", fieldKey: "conductor", label: "Conductor", kind: "text" },
    { moduleKey: "transporte", fieldKey: "estado", label: "Estado", kind: "status", options: [
      { value: "activo", label: "Activo" }, { value: "suspendido", label: "Suspendido" }, { value: "baja", label: "Baja" },
    ] },

    // Comedor
    { moduleKey: "comedor", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "comedor", fieldKey: "modalidad", label: "Modalidad", kind: "status", required: true, options: [
      { value: "diario", label: "Diario" }, { value: "esporadico", label: "Esporádico" }, { value: "alergico", label: "Menú especial" },
    ] },
    { moduleKey: "comedor", fieldKey: "alergias", label: "Alergias / restricciones", kind: "textarea" },
    { moduleKey: "comedor", fieldKey: "fechaInicio", label: "Inicio servicio", kind: "date" },
    { moduleKey: "comedor", fieldKey: "estado", label: "Estado", kind: "status", options: [
      { value: "activo", label: "Activo" }, { value: "suspendido", label: "Suspendido" }, { value: "baja", label: "Baja" },
    ] },

    // Biblioteca
    { moduleKey: "biblioteca", fieldKey: "titulo", label: "Título", kind: "text", required: true, placeholder: "Don Quijote de la Mancha" },
    { moduleKey: "biblioteca", fieldKey: "autor", label: "Autor", kind: "text" },
    { moduleKey: "biblioteca", fieldKey: "isbn", label: "ISBN", kind: "text" },
    { moduleKey: "biblioteca", fieldKey: "alumno", label: "Prestado a (alumno)", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "biblioteca", fieldKey: "fechaPrestamo", label: "Fecha préstamo", kind: "date" },
    { moduleKey: "biblioteca", fieldKey: "fechaDevolucion", label: "Fecha devolución prevista", kind: "date" },
    { moduleKey: "biblioteca", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "disponible", label: "Disponible" }, { value: "prestado", label: "Prestado" }, { value: "atrasado", label: "Atrasado" }, { value: "perdido", label: "Perdido" },
    ] },

    // Inventario
    { moduleKey: "inventario", fieldKey: "nombre", label: "Activo", kind: "text", required: true, placeholder: "Proyector aula 12" },
    { moduleKey: "inventario", fieldKey: "categoria", label: "Categoría", kind: "text", placeholder: "Mobiliario, electrónica, deportivo..." },
    { moduleKey: "inventario", fieldKey: "ubicacion", label: "Ubicación", kind: "text", placeholder: "Aula A-12, Sala profes..." },
    { moduleKey: "inventario", fieldKey: "responsable", label: "Responsable", kind: "text" },
    { moduleKey: "inventario", fieldKey: "fechaCompra", label: "Fecha compra", kind: "date" },
    { moduleKey: "inventario", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "operativo", label: "Operativo" }, { value: "averiado", label: "Averiado" }, { value: "baja", label: "Baja" },
    ] },

    // Mantenimiento
    { moduleKey: "mantenimiento", fieldKey: "asunto", label: "Asunto", kind: "text", required: true, placeholder: "Goteras aula 5" },
    { moduleKey: "mantenimiento", fieldKey: "ubicacion", label: "Ubicación", kind: "text" },
    { moduleKey: "mantenimiento", fieldKey: "prioridad", label: "Prioridad", kind: "status", required: true, options: [
      { value: "baja", label: "Baja" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "critica", label: "Crítica" },
    ] },
    { moduleKey: "mantenimiento", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
    { moduleKey: "mantenimiento", fieldKey: "responsable", label: "Asignado a", kind: "text" },
    { moduleKey: "mantenimiento", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "abierta", label: "Abierta" }, { value: "en_curso", label: "En curso" }, { value: "completada", label: "Completada" }, { value: "cancelada", label: "Cancelada" },
    ] },

    // Personal (RRHH no académico)
    { moduleKey: "personal", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
    { moduleKey: "personal", fieldKey: "puesto", label: "Puesto", kind: "text", placeholder: "Secretaría, Limpieza, Conserjería..." },
    { moduleKey: "personal", fieldKey: "email", label: "Email", kind: "email" },
    { moduleKey: "personal", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
    { moduleKey: "personal", fieldKey: "fechaAlta", label: "Fecha alta", kind: "date" },
    { moduleKey: "personal", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "activo", label: "Activo" }, { value: "baja", label: "Baja" }, { value: "vacaciones", label: "Vacaciones" },
    ] },

    // Visitantes
    { moduleKey: "visitantes", fieldKey: "nombre", label: "Visitante", kind: "text", required: true },
    { moduleKey: "visitantes", fieldKey: "dni", label: "DNI", kind: "text" },
    { moduleKey: "visitantes", fieldKey: "motivo", label: "Motivo visita", kind: "text", placeholder: "Tutoría con docente, recogida alumno..." },
    { moduleKey: "visitantes", fieldKey: "horaEntrada", label: "Entrada", kind: "text", placeholder: "10:30" },
    { moduleKey: "visitantes", fieldKey: "horaSalida", label: "Salida", kind: "text" },
    { moduleKey: "visitantes", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },

    // Trámites
    { moduleKey: "tramites", fieldKey: "asunto", label: "Asunto", kind: "text", required: true, placeholder: "Solicitud certificado escolar" },
    { moduleKey: "tramites", fieldKey: "solicitante", label: "Solicitante", kind: "relation", relationModuleKey: "clientes" },
    { moduleKey: "tramites", fieldKey: "tipo", label: "Tipo", kind: "status", required: true, options: [
      { value: "certificado", label: "Certificado" }, { value: "permiso", label: "Permiso" }, { value: "cambio_datos", label: "Cambio de datos" }, { value: "queja", label: "Queja / Sugerencia" },
    ] },
    { moduleKey: "tramites", fieldKey: "descripcion", label: "Descripción", kind: "textarea" },
    { moduleKey: "tramites", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "abierto", label: "Abierto" }, { value: "en_curso", label: "En curso" }, { value: "resuelto", label: "Resuelto" }, { value: "rechazado", label: "Rechazado" },
    ] },

    // Becas
    { moduleKey: "becas", fieldKey: "alumno", label: "Alumno", kind: "relation", required: true, relationModuleKey: "clientes" },
    { moduleKey: "becas", fieldKey: "tipo", label: "Tipo de beca", kind: "text", placeholder: "Comedor, transporte, total, parcial..." },
    { moduleKey: "becas", fieldKey: "porcentaje", label: "Porcentaje (%)", kind: "number", placeholder: "10, 50, 100" },
    { moduleKey: "becas", fieldKey: "vigenciaDesde", label: "Desde", kind: "date" },
    { moduleKey: "becas", fieldKey: "vigenciaHasta", label: "Hasta", kind: "date" },
    { moduleKey: "becas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "solicitada", label: "Solicitada" }, { value: "aprobada", label: "Aprobada" }, { value: "rechazada", label: "Rechazada" }, { value: "vencida", label: "Vencida" },
    ] },

    // Extracurriculares (actividades)
    { moduleKey: "actividades", fieldKey: "nombre", label: "Actividad", kind: "text", required: true, placeholder: "Inglés extraescolar, Robótica..." },
    { moduleKey: "actividades", fieldKey: "responsable", label: "Responsable", kind: "text" },
    { moduleKey: "actividades", fieldKey: "horario", label: "Horario", kind: "text", placeholder: "L y X 17:00-18:00" },
    { moduleKey: "actividades", fieldKey: "cupo", label: "Plazas", kind: "number" },
    { moduleKey: "actividades", fieldKey: "precio", label: "Precio mensual", kind: "money" },
    { moduleKey: "actividades", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "abierta", label: "Abierta" }, { value: "completa", label: "Completa" }, { value: "cancelada", label: "Cancelada" },
    ] },

    // Salidas pedagógicas
    { moduleKey: "salidas", fieldKey: "destino", label: "Destino", kind: "text", required: true, placeholder: "Museo Reina Sofía" },
    { moduleKey: "salidas", fieldKey: "curso", label: "Curso", kind: "relation", relationModuleKey: "proyectos" },
    { moduleKey: "salidas", fieldKey: "fecha", label: "Fecha", kind: "date", required: true },
    { moduleKey: "salidas", fieldKey: "responsable", label: "Responsable", kind: "text" },
    { moduleKey: "salidas", fieldKey: "presupuestoFamilia", label: "Coste familia", kind: "money" },
    { moduleKey: "salidas", fieldKey: "estado", label: "Estado", kind: "status", required: true, options: [
      { value: "planificada", label: "Planificada" }, { value: "autorizaciones", label: "Recogiendo autorizaciones" }, { value: "confirmada", label: "Confirmada" }, { value: "realizada", label: "Realizada" }, { value: "cancelada", label: "Cancelada" },
    ] },

    // Egresados
    { moduleKey: "egresados", fieldKey: "nombre", label: "Nombre", kind: "text", required: true },
    { moduleKey: "egresados", fieldKey: "anioEgreso", label: "Año de egreso", kind: "number" },
    { moduleKey: "egresados", fieldKey: "etapaFinal", label: "Etapa final", kind: "text", placeholder: "Bachillerato, ESO..." },
    { moduleKey: "egresados", fieldKey: "email", label: "Email actual", kind: "email" },
    { moduleKey: "egresados", fieldKey: "telefono", label: "Teléfono", kind: "tel" },
    { moduleKey: "egresados", fieldKey: "trayectoria", label: "Trayectoria actual", kind: "textarea", placeholder: "Universidad, profesión..." },
  ],
  tableColumns: [
    { moduleKey: "clientes", fieldKey: "nombre", label: "Familia / Alumno", isPrimary: true },
    { moduleKey: "clientes", fieldKey: "curso", label: "Curso" },
    { moduleKey: "clientes", fieldKey: "tutor_principal", label: "Tutor" },
    { moduleKey: "clientes", fieldKey: "estado", label: "Estado" },
    { moduleKey: "proyectos", fieldKey: "nombre", label: "Curso/Grupo", isPrimary: true },
    { moduleKey: "proyectos", fieldKey: "etapa", label: "Etapa" },
    { moduleKey: "proyectos", fieldKey: "tutor", label: "Tutor" },
    { moduleKey: "proyectos", fieldKey: "alumnos_matriculados", label: "Alumnos" },
    { moduleKey: "facturacion", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "facturacion", fieldKey: "cliente", label: "Familia" },
    { moduleKey: "facturacion", fieldKey: "importe", label: "Importe" },
    { moduleKey: "facturacion", fieldKey: "estado", label: "Estado" },

    // Servicios complementarios (presupuestos) — SF-19.
    { moduleKey: "presupuestos", fieldKey: "numero", label: "Nº", isPrimary: true },
    { moduleKey: "presupuestos", fieldKey: "cliente", label: "Familia" },
    { moduleKey: "presupuestos", fieldKey: "concepto", label: "Concepto" },
    { moduleKey: "presupuestos", fieldKey: "precio_mensual", label: "Precio mensual" },
    { moduleKey: "presupuestos", fieldKey: "estado", label: "Estado" },

    // CRM (Admisiones) — AUDIT-02.
    { moduleKey: "crm", fieldKey: "nombre", label: "Familia interesada", isPrimary: true },
    { moduleKey: "crm", fieldKey: "telefono", label: "Teléfono" },
    { moduleKey: "crm", fieldKey: "origen", label: "Origen" },
    { moduleKey: "crm", fieldKey: "estado", label: "Estado" },
    { moduleKey: "crm", fieldKey: "proximoPaso", label: "Próximo paso" },

    // Expedientes (documentos) — AUDIT-02.
    { moduleKey: "documentos", fieldKey: "nombre", label: "Documento", isPrimary: true },
    { moduleKey: "documentos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "documentos", fieldKey: "cliente", label: "Familia" },
    { moduleKey: "documentos", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "documentos", fieldKey: "estado", label: "Estado" },

    // ============================================================
    // SCHOOL-01 — tableColumns de los 22 módulos extendidos
    // ============================================================
    { moduleKey: "calificaciones", fieldKey: "alumno", label: "Alumno", isPrimary: true },
    { moduleKey: "calificaciones", fieldKey: "asignatura", label: "Asignatura" },
    { moduleKey: "calificaciones", fieldKey: "periodo", label: "Periodo" },
    { moduleKey: "calificaciones", fieldKey: "tipoEvaluacion", label: "Tipo" },
    { moduleKey: "calificaciones", fieldKey: "nota", label: "Nota" },

    { moduleKey: "asistencia", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "asistencia", fieldKey: "alumno", label: "Alumno" },
    { moduleKey: "asistencia", fieldKey: "curso", label: "Curso" },
    { moduleKey: "asistencia", fieldKey: "estado", label: "Estado" },

    { moduleKey: "docentes", fieldKey: "nombre", label: "Docente", isPrimary: true },
    { moduleKey: "docentes", fieldKey: "especialidad", label: "Especialidad" },
    { moduleKey: "docentes", fieldKey: "etapa", label: "Etapa" },
    { moduleKey: "docentes", fieldKey: "email", label: "Email" },
    { moduleKey: "docentes", fieldKey: "estado", label: "Estado" },

    { moduleKey: "horarios", fieldKey: "diaSemana", label: "Día", isPrimary: true },
    { moduleKey: "horarios", fieldKey: "horaInicio", label: "Inicio" },
    { moduleKey: "horarios", fieldKey: "horaFin", label: "Fin" },
    { moduleKey: "horarios", fieldKey: "asignatura", label: "Asignatura" },
    { moduleKey: "horarios", fieldKey: "curso", label: "Curso" },
    { moduleKey: "horarios", fieldKey: "docente", label: "Docente" },
    { moduleKey: "horarios", fieldKey: "aula", label: "Aula" },

    { moduleKey: "planeaciones", fieldKey: "asignatura", label: "Asignatura", isPrimary: true },
    { moduleKey: "planeaciones", fieldKey: "curso", label: "Curso" },
    { moduleKey: "planeaciones", fieldKey: "docente", label: "Docente" },
    { moduleKey: "planeaciones", fieldKey: "periodo", label: "Periodo" },
    { moduleKey: "planeaciones", fieldKey: "estado", label: "Estado" },

    { moduleKey: "disciplina", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "disciplina", fieldKey: "alumno", label: "Alumno" },
    { moduleKey: "disciplina", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "disciplina", fieldKey: "descripcion", label: "Descripción" },
    { moduleKey: "disciplina", fieldKey: "responsable", label: "Reportado por" },

    { moduleKey: "orientacion", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "orientacion", fieldKey: "alumno", label: "Alumno" },
    { moduleKey: "orientacion", fieldKey: "motivo", label: "Motivo" },
    { moduleKey: "orientacion", fieldKey: "responsable", label: "Profesional" },
    { moduleKey: "orientacion", fieldKey: "estado", label: "Estado" },

    { moduleKey: "enfermeria", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "enfermeria", fieldKey: "alumno", label: "Alumno" },
    { moduleKey: "enfermeria", fieldKey: "motivo", label: "Motivo" },
    { moduleKey: "enfermeria", fieldKey: "atencion", label: "Atención" },
    { moduleKey: "enfermeria", fieldKey: "avisoFamilia", label: "Aviso fam." },

    { moduleKey: "comunicaciones", fieldKey: "asunto", label: "Asunto", isPrimary: true },
    { moduleKey: "comunicaciones", fieldKey: "destinatarios", label: "Destinatarios" },
    { moduleKey: "comunicaciones", fieldKey: "fechaEnvio", label: "Enviado" },
    { moduleKey: "comunicaciones", fieldKey: "canal", label: "Canal" },
    { moduleKey: "comunicaciones", fieldKey: "estado", label: "Estado" },

    { moduleKey: "eventos", fieldKey: "titulo", label: "Evento", isPrimary: true },
    { moduleKey: "eventos", fieldKey: "fechaInicio", label: "Inicio" },
    { moduleKey: "eventos", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "eventos", fieldKey: "alcance", label: "Alcance" },

    { moduleKey: "transporte", fieldKey: "ruta", label: "Ruta", isPrimary: true },
    { moduleKey: "transporte", fieldKey: "alumno", label: "Alumno" },
    { moduleKey: "transporte", fieldKey: "parada", label: "Parada" },
    { moduleKey: "transporte", fieldKey: "horaRecogida", label: "Recogida" },
    { moduleKey: "transporte", fieldKey: "estado", label: "Estado" },

    { moduleKey: "comedor", fieldKey: "alumno", label: "Alumno", isPrimary: true },
    { moduleKey: "comedor", fieldKey: "modalidad", label: "Modalidad" },
    { moduleKey: "comedor", fieldKey: "alergias", label: "Alergias" },
    { moduleKey: "comedor", fieldKey: "estado", label: "Estado" },

    { moduleKey: "biblioteca", fieldKey: "titulo", label: "Título", isPrimary: true },
    { moduleKey: "biblioteca", fieldKey: "autor", label: "Autor" },
    { moduleKey: "biblioteca", fieldKey: "alumno", label: "Prestado a" },
    { moduleKey: "biblioteca", fieldKey: "fechaDevolucion", label: "Devolución" },
    { moduleKey: "biblioteca", fieldKey: "estado", label: "Estado" },

    { moduleKey: "inventario", fieldKey: "nombre", label: "Activo", isPrimary: true },
    { moduleKey: "inventario", fieldKey: "categoria", label: "Categoría" },
    { moduleKey: "inventario", fieldKey: "ubicacion", label: "Ubicación" },
    { moduleKey: "inventario", fieldKey: "responsable", label: "Responsable" },
    { moduleKey: "inventario", fieldKey: "estado", label: "Estado" },

    { moduleKey: "mantenimiento", fieldKey: "asunto", label: "Asunto", isPrimary: true },
    { moduleKey: "mantenimiento", fieldKey: "ubicacion", label: "Ubicación" },
    { moduleKey: "mantenimiento", fieldKey: "prioridad", label: "Prioridad" },
    { moduleKey: "mantenimiento", fieldKey: "responsable", label: "Asignado" },
    { moduleKey: "mantenimiento", fieldKey: "estado", label: "Estado" },

    { moduleKey: "personal", fieldKey: "nombre", label: "Nombre", isPrimary: true },
    { moduleKey: "personal", fieldKey: "puesto", label: "Puesto" },
    { moduleKey: "personal", fieldKey: "email", label: "Email" },
    { moduleKey: "personal", fieldKey: "estado", label: "Estado" },

    { moduleKey: "visitantes", fieldKey: "fecha", label: "Fecha", isPrimary: true },
    { moduleKey: "visitantes", fieldKey: "nombre", label: "Visitante" },
    { moduleKey: "visitantes", fieldKey: "motivo", label: "Motivo" },
    { moduleKey: "visitantes", fieldKey: "horaEntrada", label: "Entrada" },
    { moduleKey: "visitantes", fieldKey: "horaSalida", label: "Salida" },

    { moduleKey: "tramites", fieldKey: "asunto", label: "Asunto", isPrimary: true },
    { moduleKey: "tramites", fieldKey: "solicitante", label: "Solicitante" },
    { moduleKey: "tramites", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "tramites", fieldKey: "estado", label: "Estado" },

    { moduleKey: "becas", fieldKey: "alumno", label: "Alumno", isPrimary: true },
    { moduleKey: "becas", fieldKey: "tipo", label: "Tipo" },
    { moduleKey: "becas", fieldKey: "porcentaje", label: "%" },
    { moduleKey: "becas", fieldKey: "vigenciaHasta", label: "Hasta" },
    { moduleKey: "becas", fieldKey: "estado", label: "Estado" },

    { moduleKey: "actividades", fieldKey: "nombre", label: "Actividad", isPrimary: true },
    { moduleKey: "actividades", fieldKey: "responsable", label: "Responsable" },
    { moduleKey: "actividades", fieldKey: "horario", label: "Horario" },
    { moduleKey: "actividades", fieldKey: "cupo", label: "Plazas" },
    { moduleKey: "actividades", fieldKey: "estado", label: "Estado" },

    { moduleKey: "salidas", fieldKey: "destino", label: "Destino", isPrimary: true },
    { moduleKey: "salidas", fieldKey: "curso", label: "Curso" },
    { moduleKey: "salidas", fieldKey: "fecha", label: "Fecha" },
    { moduleKey: "salidas", fieldKey: "responsable", label: "Responsable" },
    { moduleKey: "salidas", fieldKey: "estado", label: "Estado" },

    { moduleKey: "egresados", fieldKey: "nombre", label: "Egresado", isPrimary: true },
    { moduleKey: "egresados", fieldKey: "anioEgreso", label: "Año" },
    { moduleKey: "egresados", fieldKey: "etapaFinal", label: "Etapa" },
    { moduleKey: "egresados", fieldKey: "trayectoria", label: "Trayectoria" },
  ],
  dashboardPriorities: [
    { key: "clientes", label: "Familias matriculadas", description: "Familias activas en el centro.", order: 1 },
    { key: "facturas", label: "Recibos vencidos", description: "Recibos no cobrados o devueltos por el banco.", order: 2 },
    { key: "proyectos", label: "Cursos abiertos", description: "Cursos del año en marcha.", order: 3 },
    { key: "presupuestos", label: "Servicios complementarios", description: "Comedor, transporte, extraescolares contratados.", order: 4 },
    { key: "actividad", label: "Actividad reciente", description: "Últimos movimientos.", order: 5 },
  ],
  demoData: [
    { moduleKey: "clientes", records: [
      { nombre: "Familia Romero", tipo: "familia", tutor_principal: "Carmen Romero", telefono: "+34 600 555 001", email: "romero@email.com", estado: "matriculado" },
      { nombre: "Familia Pérez", tipo: "familia", tutor_principal: "Andrés Pérez", telefono: "+34 600 555 002", email: "perez@email.com", estado: "matriculado" },
      { nombre: "Familia Iglesias", tipo: "familia", tutor_principal: "Marta Iglesias", telefono: "+34 600 555 003", email: "iglesias@email.com", estado: "matriculado" },
      { nombre: "Familia Núñez", tipo: "familia", tutor_principal: "Roberto Núñez", telefono: "+34 600 555 004", email: "nunez@email.com", estado: "pendiente" },
      { nombre: "Familia Vázquez", tipo: "familia", tutor_principal: "Beatriz Vázquez", telefono: "+34 600 555 005", email: "vazquez@email.com", estado: "matriculado" },
      { nombre: "Lucía Romero", tipo: "alumno", familia: "Familia Romero", curso: "Primaria 2º A", fecha_nacimiento: "2018-09-12", estado: "matriculado" },
      { nombre: "Mateo Pérez", tipo: "alumno", familia: "Familia Pérez", curso: "Infantil 5 años", fecha_nacimiento: "2020-04-03", estado: "matriculado" },
      { nombre: "Diego Iglesias", tipo: "alumno", familia: "Familia Iglesias", curso: "Primaria 4º A", fecha_nacimiento: "2016-02-22", estado: "matriculado" },
      { nombre: "Sofía Iglesias", tipo: "alumno", familia: "Familia Iglesias", curso: "Infantil 4 años", fecha_nacimiento: "2021-08-17", estado: "matriculado" },
      { nombre: "Hugo Vázquez", tipo: "alumno", familia: "Familia Vázquez", curso: "Primaria 1º A", fecha_nacimiento: "2019-11-29", estado: "matriculado" },
    ]},
    { moduleKey: "crm", records: [
      { nombre: "Familia Soto", telefono: "+34 600 666 001", email: "soto@email.com", origen: "Open day", estado: "lead", proximoPaso: "Enviar formulario de admisión" },
      { nombre: "Familia Cabrera", telefono: "+34 600 666 002", email: "cabrera@email.com", origen: "Recomendación familia Iglesias", estado: "visitado", proximoPaso: "Cerrar matrícula 2026-2027" },
    ]},
    { moduleKey: "proyectos", records: [
      { nombre: "Infantil 4 años", etapa: "Infantil", tutor: "Lara Méndez", alumnos_matriculados: "18", estado: "abierto" },
      { nombre: "Infantil 5 años", etapa: "Infantil", tutor: "Lara Méndez", alumnos_matriculados: "20", estado: "abierto" },
      { nombre: "Primaria 1º A", etapa: "Primaria", tutor: "Pablo Solano", alumnos_matriculados: "22", estado: "abierto" },
      { nombre: "Primaria 2º A", etapa: "Primaria", tutor: "Sara Beltrán", alumnos_matriculados: "21", estado: "abierto" },
      { nombre: "Primaria 4º A", etapa: "Primaria", tutor: "Diego Lago", alumnos_matriculados: "23", estado: "abierto" },
    ]},
    { moduleKey: "presupuestos", records: [
      { numero: "SVC-SCH-001", cliente: "Familia Romero", concepto: "Comedor + extraescolar inglés", precio_mensual: "180 EUR", estado: "activo" },
      { numero: "SVC-SCH-002", cliente: "Familia Pérez", concepto: "Comedor + transporte", precio_mensual: "210 EUR", estado: "activo" },
      { numero: "SVC-SCH-003", cliente: "Familia Iglesias", concepto: "Comedor (2 alumnos) + extraescolar música", precio_mensual: "320 EUR", estado: "activo" },
      { numero: "SVC-SCH-004", cliente: "Familia Vázquez", concepto: "Transporte", precio_mensual: "75 EUR", estado: "activo" },
    ]},
    { moduleKey: "facturacion", records: [
      { numero: "REC-SCH-2026-04-001", cliente: "Familia Romero", concepto: "Cuota abril + comedor + inglés", importe: "400 EUR", estado: "cobrado" },
      { numero: "REC-SCH-2026-04-002", cliente: "Familia Pérez", concepto: "Cuota abril + comedor + transporte", importe: "430 EUR", estado: "cobrado" },
      { numero: "REC-SCH-2026-04-003", cliente: "Familia Iglesias", concepto: "Cuota abril (2 alumnos) + comedor + música", importe: "740 EUR", estado: "emitido" },
      { numero: "REC-SCH-2026-04-004", cliente: "Familia Núñez", concepto: "Cuota abril", importe: "220 EUR", estado: "vencido" },
      { numero: "REC-SCH-2026-04-005", cliente: "Familia Vázquez", concepto: "Cuota abril + transporte", importe: "295 EUR", estado: "devuelto" },
      { numero: "REC-SCH-2026-03-005", cliente: "Familia Vázquez", concepto: "Cuota marzo + transporte", importe: "295 EUR", estado: "vencido" },
    ]},
    { moduleKey: "documentos", records: [
      { nombre: "Expediente académico Lucía Romero", tipo: "expediente", cliente: "Familia Romero", estado: "vigente" },
      { nombre: "Expediente académico Mateo Pérez", tipo: "expediente", cliente: "Familia Pérez", estado: "vigente" },
      { nombre: "Autorización imagen Diego Iglesias", tipo: "autorizacion", cliente: "Familia Iglesias", estado: "vigente" },
      { nombre: "Autorización imagen Sofía Iglesias", tipo: "autorizacion", cliente: "Familia Iglesias", estado: "vigente" },
      { nombre: "Solicitud admisión Familia Cabrera", tipo: "admision", cliente: "Familia Cabrera", estado: "en_revision" },
    ]},
    { moduleKey: "calificaciones", records: [
      { alumno: "Lucía Romero", asignatura: "Matemáticas", periodo: "2T", tipoEvaluacion: "examen", nota: "8.5", peso: "40" },
      { alumno: "Lucía Romero", asignatura: "Lengua", periodo: "2T", tipoEvaluacion: "trabajo", nota: "9", peso: "30" },
      { alumno: "Mateo Pérez", asignatura: "Plástica", periodo: "2T", tipoEvaluacion: "proyecto", nota: "10", peso: "50", observaciones: "Trabajo creativo y bien presentado." },
      { alumno: "Diego Iglesias", asignatura: "Inglés", periodo: "2T", tipoEvaluacion: "examen", nota: "6.5", peso: "40" },
      { alumno: "Hugo Vázquez", asignatura: "Matemáticas", periodo: "2T", tipoEvaluacion: "examen", nota: "7", peso: "40" },
    ]},
    { moduleKey: "asistencia", records: [
      { alumno: "Lucía Romero", curso: "Primaria 2º A", fecha: "2026-05-04", estado: "presente" },
      { alumno: "Mateo Pérez", curso: "Infantil 5 años", fecha: "2026-05-04", estado: "ausente", motivo: "Sin justificar" },
      { alumno: "Diego Iglesias", curso: "Primaria 4º A", fecha: "2026-05-04", estado: "tarde" },
      { alumno: "Sofía Iglesias", curso: "Infantil 4 años", fecha: "2026-05-04", estado: "justificada", motivo: "Cita médica (justificante adjunto)" },
    ]},
    { moduleKey: "docentes", records: [
      { nombre: "Lara Méndez", email: "lara.mendez@colegio.es", telefono: "+34 600 777 001", especialidad: "Infantil", etapa: "Infantil", estado: "activo" },
      { nombre: "Pablo Solano", email: "pablo.solano@colegio.es", telefono: "+34 600 777 002", especialidad: "Tutor 1ºA", etapa: "Primaria", estado: "activo" },
      { nombre: "Sara Beltrán", email: "sara.beltran@colegio.es", telefono: "+34 600 777 003", especialidad: "Tutor 2ºA / Lengua", etapa: "Primaria", estado: "activo" },
      { nombre: "Diego Lago", email: "diego.lago@colegio.es", telefono: "+34 600 777 004", especialidad: "Tutor 4ºA / Mat", etapa: "Primaria", estado: "activo" },
      { nombre: "Marina Costa", email: "marina.costa@colegio.es", telefono: "+34 600 777 005", especialidad: "Inglés", etapa: "Primaria", estado: "sustituto" },
    ]},
    { moduleKey: "horarios", records: [
      { curso: "Primaria 2º A", diaSemana: "lunes", horaInicio: "09:00", horaFin: "10:00", asignatura: "Matemáticas", docente: "Sara Beltrán", aula: "A-12" },
      { curso: "Primaria 2º A", diaSemana: "lunes", horaInicio: "10:00", horaFin: "11:00", asignatura: "Lengua", docente: "Sara Beltrán", aula: "A-12" },
      { curso: "Primaria 2º A", diaSemana: "martes", horaInicio: "09:00", horaFin: "10:00", asignatura: "Inglés", docente: "Marina Costa", aula: "A-12" },
      { curso: "Infantil 5 años", diaSemana: "lunes", horaInicio: "09:30", horaFin: "10:30", asignatura: "Lectoescritura", docente: "Lara Méndez", aula: "I-5" },
    ]},
    { moduleKey: "planeaciones", records: [
      { asignatura: "Matemáticas — Multiplicación", curso: "Primaria 2º A", docente: "Sara Beltrán", periodo: "2T 2026", objetivos: "Tabla del 2 al 10. Resolución de problemas con multiplicación.", estado: "en_curso" },
      { asignatura: "Lengua — Comprensión lectora", curso: "Primaria 2º A", docente: "Sara Beltrán", periodo: "2T 2026", objetivos: "Lectura de cuentos clásicos. Identificar idea principal.", estado: "en_curso" },
      { asignatura: "Plástica — Color y forma", curso: "Primaria 4º A", docente: "Diego Lago", periodo: "2T 2026", objetivos: "Composición con colores primarios y secundarios. Proyecto de mural.", estado: "completada" },
    ]},
    { moduleKey: "disciplina", records: [
      { alumno: "Diego Iglesias", fecha: "2026-04-22", tipo: "leve", descripcion: "Conversación durante examen", medida: "Llamada de atención y observación al tutor", responsable: "Diego Lago" },
      { alumno: "Hugo Vázquez", fecha: "2026-04-25", tipo: "positivo", descripcion: "Ayudó a un compañero nuevo durante toda la mañana", medida: "Reconocimiento ante la clase", responsable: "Pablo Solano" },
    ]},
    { moduleKey: "orientacion", records: [
      { alumno: "Mateo Pérez", fecha: "2026-04-20", motivo: "Adaptación al cambio de etapa", intervencion: "Sesión inicial. Plan de seguimiento mensual.", responsable: "Orientadora Carmen Ríos", estado: "seguimiento" },
      { alumno: "Diego Iglesias", fecha: "2026-04-28", motivo: "Bajada en rendimiento académico 2T", intervencion: "Tutoría con familia. Plan de refuerzo en Mat e Inglés.", responsable: "Orientadora Carmen Ríos", estado: "abierto" },
    ]},
    { moduleKey: "enfermeria", records: [
      { alumno: "Lucía Romero", fecha: "2026-04-15", motivo: "Dolor de cabeza tras recreo", atencion: "Reposo 30 min. Sin medicación.", medicacion: "—", avisoFamilia: "no" },
      { alumno: "Sofía Iglesias", fecha: "2026-04-22", motivo: "Caída leve en patio", atencion: "Curación rasguño rodilla con antiséptico y tirita.", medicacion: "—", avisoFamilia: "si" },
      { alumno: "Hugo Vázquez", fecha: "2026-04-29", motivo: "Fiebre 38.2", atencion: "Aislamiento + aviso familia inmediato. Recogido por madre.", medicacion: "—", avisoFamilia: "si" },
    ]},
    { moduleKey: "comunicaciones", records: [
      { asunto: "Vacaciones de Semana Santa", destinatarios: "Toda la escuela", mensaje: "Estimadas familias, las vacaciones serán del 27 marzo al 7 abril. Volvemos lunes 8 abril.", fechaEnvio: "2026-03-15", canal: "email", estado: "enviado" },
      { asunto: "Reunión 2T Primaria 2ºA", destinatarios: "Familias 2ºA", mensaje: "Convocatoria reunión informativa 2T el martes 12 de mayo a las 18:00.", fechaEnvio: "2026-05-02", canal: "app", estado: "enviado" },
      { asunto: "Recordatorio salida Museo", destinatarios: "Familias 4ºA", mensaje: "Mañana salida Museo Reina Sofía. Almuerzo y agua. 8:30 puntuales.", fechaEnvio: "2026-05-05", canal: "sms", estado: "borrador" },
    ]},
    { moduleKey: "eventos", records: [
      { titulo: "Reunión 2T Primaria 2ºA", fechaInicio: "2026-05-12", fechaFin: "2026-05-12", tipo: "reunion", alcance: "Familias 2ºA", descripcion: "Información de avance del 2T y plan del 3T." },
      { titulo: "Salida Museo Reina Sofía", fechaInicio: "2026-05-06", fechaFin: "2026-05-06", tipo: "salida", alcance: "Primaria 4º A", descripcion: "Visita guiada exposición Picasso." },
      { titulo: "Festividad escolar 1 mayo", fechaInicio: "2026-05-01", fechaFin: "2026-05-01", tipo: "festivo", alcance: "Toda la escuela", descripcion: "Día festivo no lectivo." },
      { titulo: "Exámenes 2T primaria", fechaInicio: "2026-05-19", fechaFin: "2026-05-23", tipo: "evaluacion", alcance: "Primaria", descripcion: "Periodo de exámenes finales 2T." },
    ]},
    { moduleKey: "transporte", records: [
      { ruta: "Ruta Norte", alumno: "Lucía Romero", parada: "Plaza San Vicente", horaRecogida: "08:15", conductor: "Antonio López", estado: "activo" },
      { ruta: "Ruta Norte", alumno: "Hugo Vázquez", parada: "C/ Mayor 12", horaRecogida: "08:20", conductor: "Antonio López", estado: "activo" },
      { ruta: "Ruta Sur", alumno: "Diego Iglesias", parada: "Av. Constitución 5", horaRecogida: "08:00", conductor: "Marta Vega", estado: "activo" },
    ]},
    { moduleKey: "comedor", records: [
      { alumno: "Lucía Romero", modalidad: "diario", alergias: "—", fechaInicio: "2025-09-01", estado: "activo" },
      { alumno: "Mateo Pérez", modalidad: "diario", alergias: "Frutos secos", fechaInicio: "2025-09-01", estado: "activo" },
      { alumno: "Diego Iglesias", modalidad: "alergico", alergias: "Lactosa, huevo", fechaInicio: "2025-09-01", estado: "activo" },
      { alumno: "Hugo Vázquez", modalidad: "esporadico", alergias: "—", fechaInicio: "2026-02-01", estado: "activo" },
    ]},
    { moduleKey: "biblioteca", records: [
      { titulo: "El Principito", autor: "Antoine de Saint-Exupéry", isbn: "978-84-204-9023-3", alumno: "Lucía Romero", fechaPrestamo: "2026-04-20", fechaDevolucion: "2026-05-04", estado: "prestado" },
      { titulo: "Charlie y la fábrica de chocolate", autor: "Roald Dahl", isbn: "978-84-204-7891-0", alumno: "Diego Iglesias", fechaPrestamo: "2026-04-15", fechaDevolucion: "2026-04-29", estado: "atrasado" },
      { titulo: "Manolito Gafotas", autor: "Elvira Lindo", isbn: "978-84-204-8888-9", estado: "disponible" },
      { titulo: "Matilda", autor: "Roald Dahl", isbn: "978-84-204-7777-7", estado: "disponible" },
    ]},
    { moduleKey: "inventario", records: [
      { nombre: "Proyector aula A-12", categoria: "electrónica", ubicacion: "Aula A-12", responsable: "Sara Beltrán", fechaCompra: "2024-09-10", estado: "operativo" },
      { nombre: "Pizarra digital infantil 5", categoria: "electrónica", ubicacion: "Aula I-5", responsable: "Lara Méndez", fechaCompra: "2023-11-15", estado: "averiado" },
      { nombre: "Set de balones EF", categoria: "deportivo", ubicacion: "Almacén polideportivo", responsable: "Educación física", estado: "operativo" },
      { nombre: "Mesa profesor sala A-12", categoria: "mobiliario", ubicacion: "Aula A-12", responsable: "Sara Beltrán", estado: "operativo" },
    ]},
    { moduleKey: "mantenimiento", records: [
      { asunto: "Pizarra digital aula I-5 no enciende", ubicacion: "Aula I-5", prioridad: "alta", descripcion: "La pizarra digital no se enciende desde el lunes. Lara reportó.", responsable: "Mantenimiento centro", estado: "en_curso" },
      { asunto: "Goteras pasillo planta 1", ubicacion: "Pasillo P1", prioridad: "media", descripcion: "Manchas de humedad tras lluvias intensas.", responsable: "Mantenimiento centro", estado: "abierta" },
      { asunto: "Cerradura puerta secretaría", ubicacion: "Secretaría", prioridad: "baja", descripcion: "Cerradura cuesta girar la llave.", responsable: "Conserje", estado: "completada" },
    ]},
    { moduleKey: "personal", records: [
      { nombre: "Marina Estévez", puesto: "Secretaría", email: "marina.estevez@colegio.es", telefono: "+34 600 888 001", fechaAlta: "2020-09-01", estado: "activo" },
      { nombre: "Carlos Roca", puesto: "Conserjería", email: "carlos.roca@colegio.es", telefono: "+34 600 888 002", fechaAlta: "2018-09-01", estado: "activo" },
      { nombre: "Beatriz Lago", puesto: "Limpieza coordinadora", email: "beatriz.lago@colegio.es", telefono: "+34 600 888 003", fechaAlta: "2022-09-01", estado: "vacaciones" },
    ]},
    { moduleKey: "visitantes", records: [
      { fecha: "2026-05-04", nombre: "Luis Romero (padre Lucía)", dni: "12345678A", motivo: "Tutoría con Sara Beltrán", horaEntrada: "10:30", horaSalida: "11:00" },
      { fecha: "2026-05-04", nombre: "Comercial editorial Anaya", dni: "87654321B", motivo: "Reunión jefa de estudios", horaEntrada: "12:00", horaSalida: "12:45" },
      { fecha: "2026-05-05", nombre: "Inspector educativo", dni: "11223344C", motivo: "Visita ordinaria", horaEntrada: "09:00", horaSalida: "11:30" },
    ]},
    { moduleKey: "tramites", records: [
      { asunto: "Solicitud certificado escolar Diego Iglesias", solicitante: "Familia Iglesias", tipo: "certificado", descripcion: "Certificado de estudios para presentación beca municipal.", estado: "en_curso" },
      { asunto: "Cambio teléfono contacto", solicitante: "Familia Pérez", tipo: "cambio_datos", descripcion: "Nuevo teléfono móvil de Andrés.", estado: "resuelto" },
      { asunto: "Queja menú comedor", solicitante: "Familia Vázquez", tipo: "queja", descripcion: "Considera que falta variedad en el menú vegetariano.", estado: "abierto" },
    ]},
    { moduleKey: "becas", records: [
      { alumno: "Hugo Vázquez", tipo: "Comedor parcial", porcentaje: "50", vigenciaDesde: "2025-09-01", vigenciaHasta: "2026-06-30", estado: "aprobada" },
      { alumno: "Mateo Pérez", tipo: "Transporte", porcentaje: "100", vigenciaDesde: "2025-09-01", vigenciaHasta: "2026-06-30", estado: "aprobada" },
      { alumno: "Diego Iglesias", tipo: "Cuota parcial", porcentaje: "20", vigenciaDesde: "2026-01-01", vigenciaHasta: "2026-06-30", estado: "solicitada" },
    ]},
    { moduleKey: "actividades", records: [
      { nombre: "Inglés extraescolar", responsable: "Marina Costa", horario: "L y X 17:00-18:00", cupo: "20", precio: "30 EUR", estado: "abierta" },
      { nombre: "Robótica educativa", responsable: "Diego Lago", horario: "M y J 17:00-18:30", cupo: "15", precio: "45 EUR", estado: "completa" },
      { nombre: "Coro escolar", responsable: "Lara Méndez", horario: "V 17:00-18:00", cupo: "25", precio: "20 EUR", estado: "abierta" },
      { nombre: "Ajedrez", responsable: "Pablo Solano", horario: "X 17:00-18:00", cupo: "12", precio: "25 EUR", estado: "abierta" },
    ]},
    { moduleKey: "salidas", records: [
      { destino: "Museo Reina Sofía", curso: "Primaria 4º A", fecha: "2026-05-06", responsable: "Diego Lago", presupuestoFamilia: "8 EUR", estado: "confirmada" },
      { destino: "Granja escuela El Encinar", curso: "Infantil 5 años", fecha: "2026-05-22", responsable: "Lara Méndez", presupuestoFamilia: "18 EUR", estado: "autorizaciones" },
      { destino: "Teatro Real (función infantil)", curso: "Primaria 1º A", fecha: "2026-06-04", responsable: "Pablo Solano", presupuestoFamilia: "12 EUR", estado: "planificada" },
    ]},
    { moduleKey: "egresados", records: [
      { nombre: "Marta Sánchez", anioEgreso: "2024", etapaFinal: "Primaria 6º", email: "marta.sanchez@instituto.es", telefono: "+34 600 999 001", trayectoria: "ESO en IES Las Lomas, sigue en contacto." },
      { nombre: "Javier Costa", anioEgreso: "2023", etapaFinal: "Primaria 6º", email: "javier.costa@email.com", telefono: "+34 600 999 002", trayectoria: "ESO + Bachillerato científico previsto." },
      { nombre: "Lucía Vega", anioEgreso: "2022", etapaFinal: "Primaria 6º", email: "lucia.vega@email.com", telefono: "+34 600 999 003", trayectoria: "ESO completa, premios al rendimiento académico." },
    ]},
  ],
  landing: {
    headline: "Familias, alumnos, cursos y recibos en un solo entorno.",
    subheadline: "ERP online para colegios pequeños y academias: cuotas mensuales con servicios complementarios, expedientes académicos y admisiones.",
    bullets: [
      "Familias y alumnos vinculados con su curso",
      "Recibos mensuales con cuota + comedor + transporte + extraescolares",
      "Detección de recibos vencidos o devueltos",
      "Expedientes académicos y autorizaciones digitales",
    ],
    cta: "Activa tu colegio online",
  },
  assistantCopy: {
    welcome: "Te ayudo con familias, alumnos, cursos y recibos del colegio. Puedo decirte qué familias tienen recibos vencidos, qué cursos están al límite de plazas o cuántos alumnos hay en cada etapa.",
    suggestion: "¿Qué familias tienen recibos vencidos o devueltos este mes?",
  },
};

/**
 * Verticales base definidos en código. Estos son la fuente de verdad
 * inmutable; las ediciones del Factory Admin vía UI/chat se guardan como
 * overrides en `data/saas/vertical-overrides/<key>.json` y se mergean
 * encima al resolverse con getSectorPackByKey / listSectorPacks.
 *
 * Si necesitas acceder al pack sin overrides (para diffs, chat read-only
 * en modo "base", etc.) usa listSectorPacksBase / getSectorPackBaseByKey.
 */
export const SECTOR_PACKS: SectorPackDefinition[] = [
  CLINICA_DENTAL_PACK,
  SOFTWARE_FACTORY_PACK,
  GIMNASIO_PACK,
  PELUQUERIA_PACK,
  TALLER_PACK,
  COLEGIO_PACK,
];

function resolvePackMerged(base: SectorPackDefinition): SectorPackDefinition {
  const override = readVerticalOverride(base.key);
  return applyVerticalOverride(base, override);
}

/** Lista todos los verticales con overrides aplicados. */
export function listSectorPacks(): SectorPackDefinition[] {
  return SECTOR_PACKS.map(resolvePackMerged);
}

/** Lista los verticales base sin aplicar overrides. Útil para diffs. */
export function listSectorPacksBase(): SectorPackDefinition[] {
  return SECTOR_PACKS.map((p) => ({ ...p }));
}

function findBasePack(key: string): SectorPackDefinition | null {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    SECTOR_PACKS.find(
      (item) =>
        item.key.trim().toLowerCase() === normalized ||
        item.businessType.trim().toLowerCase() === normalized,
    ) || null
  );
}

/**
 * Devuelve la definición final del vertical con overrides aplicados.
 * Esta es la función que usan composers, engine, UI resolvers, chat, etc.
 */
export function getSectorPackByKey(key: string): SectorPackDefinition | null {
  const base = findBasePack(key);
  if (!base) return null;
  return resolvePackMerged(base);
}

/** Devuelve la definición base, sin overrides. */
export function getSectorPackBaseByKey(key: string): SectorPackDefinition | null {
  return findBasePack(key);
}