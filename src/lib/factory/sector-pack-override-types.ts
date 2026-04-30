import type {
  SectorPackDefinition,
  SectorPackEntity,
  SectorPackField,
} from "@/lib/factory/sector-pack-definition";

/**
 * Override persistido en disco para un sector pack.
 *
 * La idea: los `SECTOR_PACKS` declarados en código son la definición base
 * que se envía con el binario. El Factory Admin puede editar partes de un
 * vertical sin tocar código guardando un override en
 * `data/saas/vertical-overrides/<key>.json`. Al leer el pack, se merge
 * el override encima del base.
 *
 * Reglas de merge por campo:
 *   - label, description, branding, labels, renameMap, landing, assistantCopy:
 *     merge parcial campo-a-campo (Milestone 1).
 *   - dashboardPriorities: patch por key (Milestone 1).
 *   - modules: si el override trae `modules`, REEMPLAZA la lista base
 *     completa (Milestone 2). Si solo trae items con moduleKey presente en
 *     base, mantiene compatibilidad backward con Milestone 1 (patch por key).
 *     La UI Milestone 2 siempre envía la lista completa.
 *   - entities: si presente, REEMPLAZA completamente (Milestone 2).
 *   - fields: si presente, REEMPLAZA completamente (Milestone 2).
 *   - tableColumns, demoData: no editables aún — siempre del base.
 *   - sector, businessType, key: identidad, inmutables.
 */

/**
 * Override de un módulo. En Milestone 2 la UI envía items completos
 * (con label, navigationLabel, emptyState, enabled, order, isNew?) y el
 * merger los aplica como full replacement. El formato parcial antiguo
 * sigue siendo aceptado por compatibilidad con overrides Milestone 1.
 */
export type VerticalModuleOverride = {
  moduleKey: string;
  enabled?: boolean;
  label?: string;
  navigationLabel?: string;
  emptyState?: string;
  /** Orden dentro de la lista de módulos. 0 = primero. */
  order?: number;
};

export type VerticalDashboardPriorityOverride = {
  key: string;
  /** Orden dentro de las prioridades del dashboard. 0 = primero. */
  order?: number;
  label?: string;
  description?: string;
};

export type VerticalBrandingOverride = Partial<SectorPackDefinition["branding"]>;
export type VerticalLandingOverride = Partial<SectorPackDefinition["landing"]>;
export type VerticalAssistantCopyOverride = Partial<SectorPackDefinition["assistantCopy"]>;

export type SectorPackOverride = {
  key: string;
  label?: string;
  description?: string;
  branding?: VerticalBrandingOverride;
  /** Merge clave a clave encima del diccionario base. */
  labels?: Record<string, string>;
  /** Merge clave a clave encima del diccionario base. */
  renameMap?: Record<string, string>;
  /**
   * Si el flag `modulesFullReplace` está presente, los módulos se
   * reemplazan completamente por esta lista. Si no (Milestone 1), se
   * aplican como patch por moduleKey encima del base.
   */
  modulesFullReplace?: boolean;
  modules?: VerticalModuleOverride[];
  dashboardPriorities?: VerticalDashboardPriorityOverride[];
  /** Si presente, REEMPLAZA las entidades base. */
  entities?: SectorPackEntity[];
  /** Si presente, REEMPLAZA los campos base. */
  fields?: SectorPackField[];
  landing?: VerticalLandingOverride;
  assistantCopy?: VerticalAssistantCopyOverride;
  updatedAt?: string;
  updatedBy?: string;
};
