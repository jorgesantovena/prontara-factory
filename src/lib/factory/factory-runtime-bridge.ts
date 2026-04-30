import type { NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/saas/tenant-guard";
import { getTenantRuntimeConfigFromRequest } from "@/lib/saas/tenant-runtime-config";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";

export function buildFactoryRuntimeBridge(request: NextRequest) {
  const tenant = requireTenantScope(request);
  const runtime = getTenantRuntimeConfigFromRequest(request);
  const diskHistory = readFactoryDiskHistory();
  const currentDisk = diskHistory.find((item) => item.clientId === tenant.clientId);

  return {
    ok: true,
    tenant,
    runtime,
    disk: currentDisk || null,
  };
}