import type { NextRequest } from "next/server";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";

export function getModuleUiConfigFromRequest(
  request: NextRequest,
  moduleKey: string
) {
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const config = runtime.config;

  if (!config) {
    return {
      moduleKey,
      label: moduleKey,
      emptyState: "Todavía no hay datos en " + moduleKey + ".",
      fields: [],
      tableColumns: [],
      renameMap: {},
    };
  }

  return {
    moduleKey,
    label:
      config.labels[moduleKey] ||
      config.navigationLabelMap[moduleKey] ||
      moduleKey,
    emptyState:
      config.emptyStateMap[moduleKey] ||
      ("Todavía no hay datos en " + moduleKey + "."),
    fields: config.fieldsByModule[moduleKey] || [],
    tableColumns: config.tableColumnsByModule[moduleKey] || [],
    renameMap: config.renameMap,
  };
}
