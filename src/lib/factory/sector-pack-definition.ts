export type SectorPackEntity = {
  key: string;
  label: string;
  description: string;
  moduleKey: string;
  primaryFields: string[];
  relatedTo?: string[];
};

export type SectorPackFieldOption = {
  value: string;
  label: string;
};

export type SectorPackField = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  // TEST-11 — añadidos "time" (hh:mm), kind nativo para horas del día.
  kind: "text" | "email" | "tel" | "textarea" | "date" | "time" | "number" | "money" | "status" | "relation";
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
  options?: SectorPackFieldOption[];
  /**
   * TEST-11 — Marca el campo como solo-salida en el editor: el usuario lo
   * ve pero no lo puede editar. Usado para:
   *   - Campos heredados de otra entidad (Cliente / Facturable / Método
   *     facturación / Tarifa heredados del Proyecto en parte de horas).
   *   - Campos calculados (Tiempo = Hora hasta − Hora desde).
   *   - Campos actualizados por un proceso (Facturado / Factura nº).
   */
  readOnly?: boolean;
  /**
   * TEST-11 — Herencia automática desde una relación. Cuando el usuario
   * elige el valor del campo `from` (que debe ser una relación), el editor
   * carga el registro destino y copia su campo `field` en este campo.
   * Ejemplo: en actividades, `cliente` se hereda con
   *   { from: "proyecto", field: "cliente" }.
   */
  inheritFrom?: { from: string; field: string };
  /**
   * TEST-11 — Cálculo automático del valor del campo a partir de otros del
   * mismo registro. Soportados:
   *   - { type: "duration", from: "horaInicio", to: "horaFin" }
   *     produce "hh:mm" entre las dos horas (Tiempo = Hora hasta − Hora desde).
   *   - TEST-13 E: { type: "derived", from: "tipoFacturacion",
   *                 map: { "no-facturable": "no" }, default: "si" }
   *     copia el valor del campo `from` mapeado por `map`; si no hay match
   *     usa `default`. Ejemplo en Proyectos: Facturable derivado de
   *     Método facturación (no-facturable → no, resto → sí).
   */
  computed?:
    | { type: "duration"; from: string; to: string }
    | { type: "derived"; from: string; map?: Record<string, string>; default?: string };
  /**
   * TEST-11 — Visibilidad condicional. El campo solo se renderiza en el
   * editor cuando otro campo del registro tiene uno de los valores
   * indicados. Ejemplo: Km solo si Lugar = "casa_cliente".
   */
  visibleWhen?: { field: string; equals: string | string[] };
  /**
   * TEST-13 E — Required condicional. El campo se valida como
   * obligatorio cuando otro campo del registro toma uno de los valores
   * indicados. Útil para "Horas totales (bolsa)": obligatorio si
   * Método facturación = "contra-bolsa", opcional en otro caso.
   */
  requiredWhen?: { field: string; equals: string | string[] };
  /**
   * TEST-13 E — Valor por defecto al crear un registro nuevo. Se aplica
   * solo cuando el editor está en mode="create" y el valor entrante
   * está vacío. Ejemplos:
   *   - Estado de Proyecto: "activo".
   *   - Fecha caducidad de Proyecto: "9999-12-31" (sin fecha).
   */
  defaultValue?: string;
};

export type SectorPackTableColumn = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  isPrimary?: boolean;
};

export type SectorPackDefinition = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  branding: {
    displayName: string;
    shortName: string;
    accentColor: string;
    logoHint: string;
    tone: "simple" | "professional" | "sectorial";
  };
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  modules: Array<{
    moduleKey: string;
    enabled: boolean;
    label: string;
    navigationLabel: string;
    emptyState: string;
  }>;
  /**
   * H15-A — moduleKeys de CORE que NO se inyectan a este vertical.
   * Por defecto applyCoreModulesToConfig inyecta los 8 módulos CORE
   * (tareas, tickets, compras, productos, reservas, encuestas,
   * etiquetas, plantillas) a TODOS los packs. Si un vertical no usa
   * alguno (ej. una software factory no maneja productos físicos ni
   * reservas), listarlo aquí los excluye del config + sidebar.
   */
  disabledCoreModules?: string[];
  /**
   * TEST-11 — moduleKeys donde NO se quiere mezclar CORE_FIELDS /
   * CORE_TABLE_COLUMNS con los del pack. Útil cuando el pack reutiliza
   * un moduleKey con semántica distinta a la del CORE (ej. en colegio
   * `actividades` significa "Extracurriculares", no "Parte de horas"
   * como en CORE/SF). El pack debe declarar TODOS los fields y columnas
   * que quiere para esos módulos — no se hace merge con el CORE.
   */
  noCoreFieldsFor?: string[];
  entities: SectorPackEntity[];
  fields: SectorPackField[];
  tableColumns: SectorPackTableColumn[];
  dashboardPriorities: Array<{
    key: string;
    label: string;
    description: string;
    order: number;
  }>;
  demoData: Array<{
    moduleKey: string;
    records: Record<string, string>[];
  }>;
  landing: {
    headline: string;
    subheadline: string;
    bullets: string[];
    cta: string;
  };
  assistantCopy: {
    welcome: string;
    suggestion: string;
  };
};