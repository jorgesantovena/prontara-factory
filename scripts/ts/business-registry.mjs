// Registro de tipos de negocio soportados por Prontara Factory.
// Port en TypeScript moderno de `business-registry.ps1` (F-09).
//
// La fuente canónica de los verticales vive en
// `src/lib/verticals/business-registry.ts` cuando arranque la unificación
// completa; por ahora este módulo es la fuente oficial para la CLI Node
// (y los .ps1 quedan como shim deprecado).

/**
 * @typedef {Object} BusinessDefinition
 * @property {string} key
 * @property {string} name
 * @property {string} legacySector
 * @property {string} suggestedName
 * @property {string[]} aliases
 * @property {string[]} modules
 */

/** @type {BusinessDefinition[]} */
export const BUSINESS_REGISTRY = [
  {
    key: "general",
    name: "ERP General",
    legacySector: "estandar",
    suggestedName: "Prontara ERP",
    aliases: ["erp", "empresa", "negocio", "pyme", "gestion", "gestión"],
    modules: ["clientes", "ventas", "facturacion", "ajustes"],
  },
  {
    key: "clinica-dental",
    name: "Clínica Dental",
    legacySector: "clinica",
    suggestedName: "Prontara Clínica",
    aliases: [
      "clinica dental",
      "clínica dental",
      "dentista",
      "dental",
      "odontologia",
      "odontología",
    ],
    modules: ["clientes", "citas", "documentos", "facturacion", "ajustes"],
  },
  {
    key: "software-factory",
    name: "Software Factory",
    legacySector: "estandar",
    suggestedName: "Prontara Software Factory",
    aliases: [
      "software factory",
      "fabrica de software",
      "fábrica de software",
      "empresa de software",
      "empresa de desarrollo",
      "consultora de software",
      "desarrollo de software",
      "estudio de software",
    ],
    modules: [
      "clientes",
      "ventas",
      "facturacion",
      "ajustes",
      "documentos",
      "proyectos",
      "tareas",
    ],
  },
  {
    key: "taller-auto",
    name: "Taller Auto",
    legacySector: "taller-auto",
    suggestedName: "Prontara Taller Auto",
    aliases: [
      "taller de coches",
      "taller mecanico",
      "taller mecánico",
      "taller de vehiculos",
      "taller de vehículos",
      "mecanica",
      "mecánica",
      "automocion",
      "automoción",
      "taller auto",
    ],
    modules: [
      "clientes",
      "vehiculos",
      "ordenes_trabajo",
      "citas",
      "facturacion",
      "cobros",
      "ajustes",
    ],
  },
  {
    key: "panaderia",
    name: "Panadería",
    legacySector: "panaderia",
    suggestedName: "Prontara Panadería",
    aliases: ["panaderia", "panadería", "obrador", "pasteleria", "pastelería"],
    modules: [
      "productos",
      "compras",
      "ventas",
      "pedidos",
      "almacen",
      "facturacion",
      "ajustes",
    ],
  },
  {
    key: "gimnasio",
    name: "Gimnasio",
    legacySector: "gimnasio",
    suggestedName: "Prontara Gym",
    aliases: [
      "gimnasio",
      "gym",
      "centro deportivo",
      "fitness",
      "box",
      "estudio de fitness",
      "crossfit",
    ],
    modules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
  },
  {
    key: "peluqueria",
    name: "Peluquería",
    legacySector: "peluqueria",
    suggestedName: "Prontara Salón",
    aliases: [
      "peluqueria",
      "peluquería",
      "peluquero",
      "peluquera",
      "barberia",
      "barbería",
      "barber shop",
      "salón de belleza",
      "salon de belleza",
      "estética",
      "estetica",
    ],
    modules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
  },
  {
    key: "colegio",
    name: "Colegio",
    legacySector: "colegio",
    suggestedName: "Prontara Educa",
    aliases: [
      "colegio",
      "escuela",
      "centro educativo",
      "centro de enseñanza",
      "academia",
      "instituto",
      "guarderia",
      "guardería",
    ],
    modules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
  },
];

/** @param {string} key */
export function getBusinessByKey(key) {
  return BUSINESS_REGISTRY.find((b) => b.key === key) ?? null;
}

/** @param {string} alias */
export function findBusinessByAlias(alias) {
  const needle = alias.toLowerCase().trim();
  return (
    BUSINESS_REGISTRY.find(
      (b) => b.key === needle || b.aliases.some((a) => a.toLowerCase() === needle),
    ) ?? null
  );
}
