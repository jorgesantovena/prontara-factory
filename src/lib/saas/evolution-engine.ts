import type { NextRequest } from "next/server";
import type {
  EvolutionActionPayload,
  EvolutionActionType,
  EvolutionRuntimeSnapshot,
  EvolutionStatusSnapshot,
} from "@/lib/saas/evolution-definition";
import {
  appendEvolutionHistory,
  getEvolutionCurrentSnapshot,
  listEvolutionHistory,
  saveEvolutionCurrentSnapshot,
} from "@/lib/saas/evolution-store";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";
import { buildDeliveryPackageFromRequest } from "@/lib/factory/delivery-package-builder";
import {
  createModuleRecord,
  listModuleRecords,
  saveModuleRecords,
} from "@/lib/erp/active-client-data-store";

function buildScopeFromRequest(request: NextRequest) {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const slug =
    String(request.nextUrl.searchParams.get("tenant") || "").trim() ||
    "default";
  const tenantId = slug;
  const clientId = slug;

  return {
    tenantId,
    clientId,
    slug,
    runtime,
  };
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildEmptySnapshot(
  clientId: string,
  wrapper: EvolutionRuntimeSnapshot["wrapper"]
): EvolutionRuntimeSnapshot {
  return {
    displayName: clientId,
    shortName: clientId.slice(0, 2).toUpperCase(),
    sector: "",
    businessType: "",
    companySize: "",
    labels: {},
    navigationLabelMap: {},
    emptyStateMap: {},
    modules: [],
    dashboardPriorities: [],
    landingRules: [],
    branding: {
      displayName: clientId,
      shortName: clientId.slice(0, 2).toUpperCase(),
      sectorLabel: "",
      businessTypeLabel: "",
      tone: "professional",
      accentColor: "#111827",
      logoHint: "",
    },
    texts: {
      welcomeHeadline: "",
      welcomeSubheadline: "",
      assistantWelcome: "",
      assistantSuggestion: "",
      navigationLabelMap: {},
      emptyStateMap: {},
    },
    fieldsByModule: {},
    demoDataByModule: {},
    flows: [],
    entities: [],
    wrapper,
  };
}

function getBaseSnapshotFromRequest(request: NextRequest): EvolutionRuntimeSnapshot {
  const scope = buildScopeFromRequest(request);
  const existing = getEvolutionCurrentSnapshot(scope.clientId);

  if (existing) {
    return existing;
  }

  const delivery = buildDeliveryPackageFromRequest(request);
  const config = scope.runtime.config;

  const snapshot: EvolutionRuntimeSnapshot = config
    ? {
        displayName: config.displayName,
        shortName: config.shortName,
        sector: config.sector,
        businessType: config.businessType,
        companySize: config.companySize,
        labels: config.labels,
        navigationLabelMap: config.navigationLabelMap,
        emptyStateMap: config.emptyStateMap,
        modules: config.modules,
        dashboardPriorities: config.dashboardPriorities,
        landingRules: config.landingRules,
        branding: {
          displayName: config.branding.displayName,
          shortName: config.branding.shortName,
          sectorLabel: config.branding.sectorLabel,
          businessTypeLabel: config.branding.businessTypeLabel,
          tone: config.branding.tone,
          accentColor: config.branding.accentColor,
          logoHint: config.branding.logoHint,
        },
        texts: config.texts,
        fieldsByModule: config.fieldsByModule,
        demoDataByModule: config.demoDataByModule,
        flows: config.flows,
        entities: config.entities,
        wrapper: delivery.wrapper,
      }
    : buildEmptySnapshot(scope.clientId, delivery.wrapper);

  saveEvolutionCurrentSnapshot(scope.clientId, snapshot);
  return snapshot;
}

function ensureModuleExists(snapshot: EvolutionRuntimeSnapshot, moduleKey: string) {
  const existing = snapshot.modules.find((item) => item.moduleKey === moduleKey);
  if (existing) {
    existing.enabled = true;
    return;
  }

  const label = snapshot.labels[moduleKey] || moduleKey;
  snapshot.modules.push({
    moduleKey,
    enabled: true,
    label,
    navigationLabel: snapshot.navigationLabelMap[moduleKey] || label,
    emptyState:
      snapshot.emptyStateMap[moduleKey] || ("Todavía no hay datos en " + label.toLowerCase() + "."),
  });
}

function disableModule(snapshot: EvolutionRuntimeSnapshot, moduleKey: string) {
  const existing = snapshot.modules.find((item) => item.moduleKey === moduleKey);
  if (existing) {
    existing.enabled = false;
  }
}

function patchBranding(snapshot: EvolutionRuntimeSnapshot, payload: EvolutionActionPayload) {
  const patch = payload.brandingPatch || {};
  snapshot.branding = {
    ...snapshot.branding,
    ...patch,
    displayName: patch.displayName || snapshot.branding.displayName,
    shortName: patch.shortName || snapshot.branding.shortName,
    accentColor: patch.accentColor || snapshot.branding.accentColor,
    logoHint: patch.logoHint || snapshot.branding.logoHint,
    tone: patch.tone || snapshot.branding.tone,
  };

  snapshot.displayName = snapshot.branding.displayName;
  snapshot.shortName = snapshot.branding.shortName;
}

function patchLabels(snapshot: EvolutionRuntimeSnapshot, payload: EvolutionActionPayload) {
  const patch = payload.labelPatch || {};
  snapshot.labels = {
    ...snapshot.labels,
    ...patch,
  };
  snapshot.navigationLabelMap = {
    ...snapshot.navigationLabelMap,
    ...patch,
  };

  snapshot.modules = snapshot.modules.map((item) => ({
    ...item,
    label: patch[item.moduleKey] || item.label,
    navigationLabel: patch[item.moduleKey] || item.navigationLabel,
  }));
}

function regenerateDemoData(snapshot: EvolutionRuntimeSnapshot, clientId: string) {
  for (const [moduleKey, records] of Object.entries(snapshot.demoDataByModule || {})) {
    saveModuleRecords(moduleKey, records, clientId);
  }
}

function patchDashboard(snapshot: EvolutionRuntimeSnapshot, payload: EvolutionActionPayload) {
  const desiredKeys = payload.dashboardPriorityKeys || [];
  if (desiredKeys.length === 0) {
    return;
  }

  const currentByKey = new Map(
    snapshot.dashboardPriorities.map((item) => [item.key, item] as const)
  );

  snapshot.dashboardPriorities = desiredKeys.map((key, index) => {
    const existing = currentByKey.get(key);
    if (existing) {
      return {
        ...existing,
        order: index + 1,
      };
    }

    return {
      key,
      label: key,
      description: "Prioridad configurada por evolución.",
      order: index + 1,
    };
  });
}

function patchLanding(snapshot: EvolutionRuntimeSnapshot, payload: EvolutionActionPayload) {
  const patches = payload.landingRulePatches || [];
  if (patches.length === 0) {
    return;
  }

  const currentByKey = new Map(
    snapshot.landingRules.map((item) => [item.key, item] as const)
  );

  for (const patch of patches) {
    const current = currentByKey.get(patch.key);
    if (current) {
      current.label = patch.label || current.label;
      current.description = patch.description || current.description;
      current.instruction = patch.instruction || current.instruction;
    } else {
      snapshot.landingRules.push({
        key: patch.key,
        label: patch.label || patch.key,
        description: patch.description || "Regla añadida por evolución.",
        instruction: patch.instruction || "Sin instrucción definida.",
      });
    }
  }
}

function regenerateWrapper(snapshot: EvolutionRuntimeSnapshot, payload: EvolutionActionPayload) {
  const patch = payload.wrapperPatch || {};
  const current = snapshot.wrapper || {
    appName: snapshot.displayName,
    installableName: snapshot.displayName.replace(/\s+/g, "") + "-Setup",
    executableName: snapshot.shortName + ".exe",
    bundleId: "com.prontara." + snapshot.shortName.toLowerCase(),
    desktopCaption: snapshot.displayName + " Desktop",
    iconHint: snapshot.branding.logoHint,
    accentColor: snapshot.branding.accentColor,
    windowTitle: snapshot.displayName,
    deliveryMode: "desktop-wrapper" as const,
  };

  snapshot.wrapper = {
    ...current,
    appName: patch.appName || snapshot.displayName,
    installableName:
      patch.installableName ||
      (patch.appName || snapshot.displayName).replace(/\s+/g, "") + "-Setup",
    executableName:
      patch.executableName ||
      ((patch.appName || snapshot.shortName).replace(/\s+/g, "") + ".exe"),
    desktopCaption: patch.desktopCaption || (patch.appName || snapshot.displayName) + " Desktop",
    iconHint: patch.iconHint || snapshot.branding.logoHint,
    accentColor: snapshot.branding.accentColor,
    windowTitle: patch.windowTitle || patch.appName || snapshot.displayName,
    deliveryMode: "desktop-wrapper",
    bundleId: current.bundleId,
  };
}

function buildSummary(actionType: EvolutionActionType, payload: EvolutionActionPayload): string {
  if (actionType === "add_module") {
    return "Se ha añadido el módulo " + String(payload.moduleKey || "");
  }
  if (actionType === "remove_module") {
    return "Se ha desactivado el módulo " + String(payload.moduleKey || "");
  }
  if (actionType === "change_branding") {
    return "Se ha actualizado el branding visible del tenant.";
  }
  if (actionType === "change_labels") {
    return "Se han actualizado etiquetas y navegación.";
  }
  if (actionType === "regenerate_demo_data") {
    return "Se han regenerado los datos demo del tenant.";
  }
  if (actionType === "update_dashboard") {
    return "Se ha actualizado la prioridad del dashboard.";
  }
  if (actionType === "update_landing") {
    return "Se han actualizado reglas y copy de landing.";
  }
  return "Se ha regenerado el wrapper o instalable comercial.";
}

function applyActionToSnapshot(
  snapshot: EvolutionRuntimeSnapshot,
  actionType: EvolutionActionType,
  payload: EvolutionActionPayload,
  clientId: string
): EvolutionRuntimeSnapshot {
  const next = cloneSnapshot(snapshot);

  if (actionType === "add_module" && payload.moduleKey) {
    ensureModuleExists(next, payload.moduleKey);
  }

  if (actionType === "remove_module" && payload.moduleKey) {
    disableModule(next, payload.moduleKey);
  }

  if (actionType === "change_branding") {
    patchBranding(next, payload);
  }

  if (actionType === "change_labels") {
    patchLabels(next, payload);
  }

  if (actionType === "regenerate_demo_data") {
    regenerateDemoData(next, clientId);
  }

  if (actionType === "update_dashboard") {
    patchDashboard(next, payload);
  }

  if (actionType === "update_landing") {
    patchLanding(next, payload);
  }

  if (actionType === "regenerate_wrapper") {
    regenerateWrapper(next, payload);
  }

  return next;
}

function seedModuleIfEnabled(snapshot: EvolutionRuntimeSnapshot, clientId: string, moduleKey: string) {
  const moduleEnabled = snapshot.modules.some(
    (item) => item.moduleKey === moduleKey && item.enabled
  );

  if (!moduleEnabled) {
    return;
  }

  const existing = listModuleRecords(moduleKey, clientId);
  if (existing.length > 0) {
    return;
  }

  const demoRows = snapshot.demoDataByModule[moduleKey] || [];
  if (demoRows.length > 0) {
    saveModuleRecords(moduleKey, demoRows, clientId);
    return;
  }

  if (moduleKey === "documentos") {
    createModuleRecord(
      "documentos",
      {
        nombre: "Documento inicial",
        tipo: "general",
        estado: "vigente",
        entidadOrigen: "evolucion",
      },
      clientId
    );
  }
}

export function getEvolutionStatusFromRequest(
  request: NextRequest
): EvolutionStatusSnapshot {
  const scope = buildScopeFromRequest(request);
  const current = getBaseSnapshotFromRequest(request);
  const history = listEvolutionHistory(scope.clientId);

  return {
    ok: true,
    tenantId: scope.tenantId,
    clientId: scope.clientId,
    slug: scope.slug,
    current,
    history,
    rollbackCandidates: history.filter((item) => item.rollbackSafe),
  };
}

export function applyEvolutionActionFromRequest(input: {
  request: NextRequest;
  actionType: EvolutionActionType;
  payload: EvolutionActionPayload;
  createdBy: string;
}) {
  const scope = buildScopeFromRequest(input.request);
  const current = getBaseSnapshotFromRequest(input.request);
  const beforeSnapshot = cloneSnapshot(current);

  const next = applyActionToSnapshot(
    current,
    input.actionType,
    input.payload,
    scope.clientId
  );

  for (const moduleItem of next.modules) {
    if (moduleItem.enabled) {
      seedModuleIfEnabled(next, scope.clientId, moduleItem.moduleKey);
    }
  }

  saveEvolutionCurrentSnapshot(scope.clientId, next);

  const historyEntry = appendEvolutionHistory(scope.clientId, {
    tenantId: scope.tenantId,
    clientId: scope.clientId,
    slug: scope.slug,
    actionType: input.actionType,
    payload: input.payload,
    createdBy: input.createdBy,
    summary: buildSummary(input.actionType, input.payload),
    rollbackSafe: true,
    snapshotBefore: JSON.stringify(beforeSnapshot),
    snapshotAfter: JSON.stringify(next),
  });

  return {
    ok: true,
    current: next,
    historyEntry,
  };
}

export function rollbackEvolutionEntryFromRequest(input: {
  request: NextRequest;
  entryId: string;
  createdBy: string;
}) {
  const scope = buildScopeFromRequest(input.request);
  const history = listEvolutionHistory(scope.clientId);
  const target = history.find((item) => item.id === input.entryId);

  if (!target) {
    throw new Error("No existe la entrada de historial indicada.");
  }

  if (!target.rollbackSafe) {
    throw new Error("La entrada seleccionada no permite rollback seguro.");
  }

  const current = getBaseSnapshotFromRequest(input.request);
  const beforeRollback = cloneSnapshot(current);
  const targetSnapshot = JSON.parse(target.snapshotBefore) as EvolutionRuntimeSnapshot;

  saveEvolutionCurrentSnapshot(scope.clientId, targetSnapshot);

  const historyEntry = appendEvolutionHistory(scope.clientId, {
    tenantId: scope.tenantId,
    clientId: scope.clientId,
    slug: scope.slug,
    actionType: "change_branding",
    payload: {},
    createdBy: input.createdBy,
    summary: "Rollback aplicado sobre la acción " + target.summary,
    rollbackSafe: true,
    snapshotBefore: JSON.stringify(beforeRollback),
    snapshotAfter: JSON.stringify(targetSnapshot),
    rollbackOfEntryId: target.id,
  });

  return {
    ok: true,
    current: targetSnapshot,
    historyEntry,
  };
}

/**
 * Thin wrappers that align with the API route names. Routes pass the raw
 * request + parsed body; the wrappers unwrap the body shape and delegate.
 */
export function getEvolutionHistoryFromRequest(request: NextRequest) {
  const scope = buildScopeFromRequest(request);
  return listEvolutionHistory(scope.clientId);
}

export function createEvolutionSnapshotFromRequest(
  request: NextRequest,
  body: { actionType?: EvolutionActionType; payload?: EvolutionActionPayload; createdBy?: string }
) {
  const actionType = body.actionType;
  const payload = (body.payload || {}) as EvolutionActionPayload;
  const createdBy = String(body.createdBy || "sistema");

  if (!actionType) {
    throw new Error("Falta actionType en el cuerpo de la petición.");
  }

  const result = applyEvolutionActionFromRequest({
    request,
    actionType,
    payload,
    createdBy,
  });

  return result.historyEntry;
}

export function rollbackEvolutionFromRequest(
  request: NextRequest,
  body: { entryId?: string; createdBy?: string }
) {
  const entryId = String(body.entryId || "").trim();
  const createdBy = String(body.createdBy || "sistema");

  if (!entryId) {
    throw new Error("Falta entryId en el cuerpo de la petición.");
  }

  const result = rollbackEvolutionEntryFromRequest({
    request,
    entryId,
    createdBy,
  });

  return result.historyEntry;
}