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
   */
  computed?: { type: "duration"; from: string; to: string };
  /**
   * TEST-11 — Visibilidad condicional. El campo solo se renderiza en el
   * editor cuando otro campo del registro tiene uno de los valores
   * indicados. Ejemplo: Km solo si Lugar = "casa_cliente".
   */
  visibleWhen?: { field: string; equals: string | string[] };
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