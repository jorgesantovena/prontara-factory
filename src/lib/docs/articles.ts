/**
 * Artículos de documentación pública (H4-DOCS).
 *
 * Cada vertical tiene un artículo con título, intro y secciones. Los
 * renderiza /docs/[vertical]/page.tsx. Es Markdown muy ligero — sin
 * dependencia externa, parseo manual de **negrita** y bullets.
 */

export type DocSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type DocArticle = {
  slug: string;
  title: string;
  vertical: string;
  intro: string;
  sections: DocSection[];
};

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: "clinica-dental",
    vertical: "Clínica dental",
    title: "Cómo gestionar tu clínica dental con Prontara",
    intro:
      "Prontara Dental cubre las necesidades del día a día de una clínica pequeña o mediana: pacientes con historia clínica, agenda con doctor y duración, presupuestos firmables y facturación con IVA. En 10 minutos tienes el ERP listo para empezar.",
    sections: [
      {
        heading: "Pacientes y citas",
        paragraphs: [
          "Cada paciente tiene su ficha con datos personales, fecha de nacimiento, alergias relevantes y doctor referente. Las citas se asocian a paciente + doctor + duración, y aparecen automáticamente en el calendario unificado.",
        ],
      },
      {
        heading: "Presupuestos firmables",
        paragraphs: [
          "Cada presupuesto se genera con su número correlativo automático y puede mandarse por email para firma del paciente. Cuando vuelve firmado, cambia a estado \"firmado\" y se desbloquea la generación de facturas asociadas.",
        ],
      },
      {
        heading: "Verifactu / AEAT",
        paragraphs: [
          "Prontara prepara el XML Verifactu de cada factura emitida con el CIF de la clínica como emisor. La firma XML-DSig y el envío real a AEAT requieren certificado digital de la clínica.",
        ],
      },
    ],
  },
  {
    slug: "software-factory",
    vertical: "Software Factory",
    title: "Software Factory en Prontara — proyectos, horas y emisión mensual",
    intro:
      "Para empresas de desarrollo de software que facturan por hora o por proyecto: bolsa de horas con saldo, emisión mensual de facturas desde actividades, renovación 1-clic de proyectos y portal cliente.",
    sections: [
      {
        heading: "Bolsa de horas",
        paragraphs: [
          "Cada proyecto puede tener una bolsa de horas con saldo. Cuando un técnico añade actividades, las horas se descuentan automáticamente del saldo. Si el saldo baja de cierto umbral, se notifica al operador.",
        ],
      },
      {
        heading: "Emisión mensual",
        paragraphs: [
          "El botón \"Emitir mes\" toma todas las actividades del mes anterior agrupadas por proyecto y genera las facturas correspondientes con números correlativos. Idempotente — se puede ejecutar varias veces sin duplicar.",
        ],
      },
      {
        heading: "Portal cliente",
        paragraphs: [
          "Cada cliente tiene acceso a un portal con sus facturas, proyectos en curso y bolsa de horas restante. El acceso se gestiona vía cuenta con rol \"clienteFinal\".",
        ],
      },
    ],
  },
  {
    slug: "gimnasio",
    vertical: "Gimnasio",
    title: "Gestiona tu gimnasio con Prontara",
    intro:
      "Para gimnasios y centros deportivos: socios, cuotas mensuales/anuales, clases dirigidas, bonos y facturación recurrente.",
    sections: [
      {
        heading: "Socios y cuotas",
        paragraphs: [
          "Cada socio tiene su ficha con tipo de cuota, fecha de alta y estado. Las cuotas vencidas se detectan automáticamente.",
        ],
      },
    ],
  },
  {
    slug: "peluqueria",
    vertical: "Peluquería",
    title: "Peluquería y estética en Prontara",
    intro:
      "Para salones de belleza, peluquerías y estética: agenda con servicios, fichas de cliente con histórico, productos vendidos y caja diaria.",
    sections: [
      {
        heading: "Agenda y servicios",
        paragraphs: [
          "Reserva citas asociadas a profesional + servicio + duración. Recordatorios automáticos al cliente.",
        ],
      },
    ],
  },
  {
    slug: "taller",
    vertical: "Taller mecánico",
    title: "Taller mecánico con Prontara",
    intro:
      "Para talleres mecánicos: vehículos, presupuestos por reparación, mano de obra + recambios, fichas de mantenimiento.",
    sections: [
      {
        heading: "Vehículos y reparaciones",
        paragraphs: [
          "Cada vehículo tiene matrícula, propietario y histórico de intervenciones. Las reparaciones se desglosan en mano de obra + recambios.",
        ],
      },
    ],
  },
  {
    slug: "colegio",
    vertical: "Colegio",
    title: "Gestión escolar con Prontara",
    intro:
      "Para centros educativos: alumnos, profesores, asignaturas, calificaciones con boletín PDF, asistencia, becas y portales separados para docente / familia / estudiante.",
    sections: [
      {
        heading: "Calificaciones y boletín",
        paragraphs: [
          "Las calificaciones se introducen por trimestre y se compilan en un boletín PDF con la nota media ponderada de cada asignatura.",
        ],
      },
      {
        heading: "Portales por perfil",
        paragraphs: [
          "Docente, familia y estudiante tienen su propia vista filtrada — la familia solo ve datos de sus hijos, el estudiante solo los suyos, el docente solo sus asignaturas.",
        ],
      },
    ],
  },
  {
    slug: "veterinaria",
    vertical: "Clínica veterinaria",
    title: "Clínica veterinaria con Prontara",
    intro:
      "Para clínicas veterinarias: mascotas con propietario, especie, raza y microchip; calendario de citas, vacunación con recordatorio automático, historial clínico y facturación al propietario.",
    sections: [
      {
        heading: "Mascotas y propietarios",
        paragraphs: [
          "Cada mascota tiene su ficha con especie, raza, edad, peso, microchip y propietario. El historial clínico agrupa vacunas, desparasitaciones, RX, analíticas e informes.",
        ],
      },
      {
        heading: "Recordatorios de vacunas",
        paragraphs: [
          "Cada vacuna tiene fecha aplicada y fecha de próxima dosis. Cuando se acerca el vencimiento, se genera un recordatorio automático al propietario.",
        ],
      },
    ],
  },
];

export function getDocBySlug(slug: string): DocArticle | null {
  return DOC_ARTICLES.find((d) => d.slug === slug) || null;
}
