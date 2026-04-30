// Port TypeScript/ESM de `build-blueprint.ps1` (F-09).
// Mantiene exactamente los mismos CoreModules / OptionalModules / Entities /
// Workflows por business-type que la versión PowerShell.

import { getBusinessByKey } from "./business-registry.mjs";

/**
 * @typedef {Object} BlueprintBranding
 * @property {string} appName
 * @property {string} logoText
 *
 * @typedef {Object} Blueprint
 * @property {string} businessType
 * @property {string} businessName
 * @property {string} displayName
 * @property {string} legacySector
 * @property {string} blueprintVersion
 * @property {string[]} modules
 * @property {BlueprintBranding} branding
 * @property {string[]} coreModules
 * @property {string[]} optionalModules
 * @property {string[]} entities
 * @property {string[]} workflows
 */

const BLUEPRINT_VERSION = "0.1.0";

/** @type {Record<string, {coreModules: string[], optionalModules: string[], entities: string[], workflows: string[], legacySector: string}>} */
const BLUEPRINT_OVERRIDES = {
  "clinica-dental": {
    legacySector: "clinica",
    coreModules: ["clientes", "citas", "documentos", "facturacion", "ajustes"],
    optionalModules: ["cobros", "historiales", "recordatorios"],
    entities: ["pacientes", "citas", "facturas", "documentos"],
    workflows: ["agenda-clinica", "facturacion-clinica"],
  },
  panaderia: {
    legacySector: "panaderia",
    coreModules: [
      "productos",
      "compras",
      "ventas",
      "pedidos",
      "almacen",
      "facturacion",
      "ajustes",
    ],
    optionalModules: ["produccion", "repartos", "cobros"],
    entities: ["productos", "pedidos", "ventas", "facturas", "stock"],
    workflows: ["ventas-mostrador", "reposicion", "pedido-cliente"],
  },
  "taller-auto": {
    legacySector: "taller-auto",
    coreModules: [
      "clientes",
      "vehiculos",
      "ordenes_trabajo",
      "citas",
      "facturacion",
      "cobros",
      "ajustes",
      "taller",
    ],
    optionalModules: ["recambios", "presupuestos", "partes"],
    entities: ["clientes", "vehiculos", "ordenes", "citas", "facturas", "cobros"],
    workflows: ["recepcion-vehiculo", "orden-trabajo", "cierre-reparacion"],
  },
  "software-factory": {
    legacySector: "estandar",
    coreModules: [
      "clientes",
      "ventas",
      "facturacion",
      "ajustes",
      "documentos",
      "proyectos",
      "tareas",
    ],
    optionalModules: ["imputacion", "soporte", "cobros"],
    entities: ["clientes", "proyectos", "tareas", "facturas", "documentos"],
    workflows: [
      "alta-proyecto",
      "seguimiento-proyecto",
      "facturacion-servicios",
    ],
  },
  gimnasio: {
    legacySector: "gimnasio",
    coreModules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
    optionalModules: ["asistencias", "cuotas-recurrentes", "clases"],
    entities: ["socios", "planes", "cuotas", "clases"],
    workflows: [
      "alta-socio",
      "renovacion-cuota",
      "baja-socio",
    ],
  },
  peluqueria: {
    legacySector: "peluqueria",
    coreModules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
    optionalModules: ["citas", "catalogo-servicios", "productos"],
    entities: ["clientes", "servicios", "tickets", "citas"],
    workflows: [
      "reserva-cita",
      "cierre-servicio",
      "fidelizacion-cliente",
    ],
  },
  colegio: {
    legacySector: "colegio",
    coreModules: [
      "clientes",
      "crm",
      "proyectos",
      "presupuestos",
      "facturacion",
      "documentos",
      "ajustes",
    ],
    optionalModules: ["matriculas", "asistencias", "comunicaciones"],
    entities: ["familias", "cursos", "recibos", "expedientes"],
    workflows: [
      "matricula-alumno",
      "emision-recibos",
      "gestion-expediente",
    ],
  },
};

/**
 * @param {string} businessType
 * @param {string} [requestedName]
 * @returns {Blueprint}
 */
export function buildBlueprint(businessType, requestedName) {
  const business = getBusinessByKey(businessType);
  if (!business) {
    throw new Error("No existe el businessType: " + businessType);
  }

  const defaultName = business.suggestedName || "Prontara ERP";
  const displayName =
    requestedName && requestedName.trim() !== "" ? requestedName.trim() : defaultName;

  const override = BLUEPRINT_OVERRIDES[business.key];
  const coreModules = override?.coreModules ?? (business.modules.length > 0
    ? business.modules
    : ["clientes", "ventas", "facturacion", "ajustes"]);
  const optionalModules = override?.optionalModules ?? [];
  const entities = override?.entities ?? [];
  const workflows = override?.workflows ?? [];
  const legacySector = override?.legacySector ?? business.legacySector ?? "estandar";

  return {
    businessType: business.key,
    businessName: displayName,
    displayName,
    legacySector,
    blueprintVersion: BLUEPRINT_VERSION,
    modules: [...coreModules],
    branding: { appName: displayName, logoText: displayName },
    coreModules: [...coreModules],
    optionalModules: [...optionalModules],
    entities: [...entities],
    workflows: [...workflows],
  };
}
