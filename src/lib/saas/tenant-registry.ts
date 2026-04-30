import fs from "node:fs";
import type { ActiveTenantState, TenantDefinition } from "@/lib/saas/tenant-definition";
import { getActiveClientState } from "@/lib/factory/active-client-registry";
import {
  getTenantArtifactsRoot,
  getTenantDataRoot,
  getTenantDefinition,
  getTenantDefinitionPath,
  listTenantIds,
} from "@/lib/factory/tenant-context";

type ClientFileShape = {
  clientId?: string;
  displayName?: string;
  sector?: string;
  businessType?: string;
};

function ensureSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "tenant";
}

export function readActiveTenantState(): ActiveTenantState {
  const state = getActiveClientState();

  const clientId =
    typeof state.clientId === "string" && state.clientId.trim()
      ? state.clientId.trim()
      : null;

  return {
    tenantId: clientId,
    clientId,
    updatedAt:
      typeof state.updatedAt === "string" && state.updatedAt.trim()
        ? state.updatedAt
        : new Date(0).toISOString(),
  };
}

export function resolveTenantByClientId(clientId: string): TenantDefinition | null {
  const trimmedClientId = String(clientId || "").trim();
  if (!trimmedClientId) {
    return null;
  }

  const clientFilePath = getTenantDefinitionPath(trimmedClientId);
  if (!fs.existsSync(clientFilePath)) {
    return null;
  }

  const clientJson = getTenantDefinition(trimmedClientId) as ClientFileShape;

  const displayName =
    (clientJson.displayName && String(clientJson.displayName).trim()) ||
    trimmedClientId;

  const sector =
    clientJson.sector && String(clientJson.sector).trim()
      ? String(clientJson.sector).trim()
      : undefined;

  const businessType =
    clientJson.businessType && String(clientJson.businessType).trim()
      ? String(clientJson.businessType).trim()
      : undefined;

  const activeState = readActiveTenantState();

  return {
    tenantId: trimmedClientId,
    clientId: trimmedClientId,
    slug: ensureSlug(displayName),
    displayName,
    sector,
    businessType,
    status: "active",
    branding: {
      displayName,
      sector,
      businessType,
    },
    paths: {
      clientFilePath,
      runtimeConfigPath: "",
      dataPath: getTenantDataRoot(trimmedClientId),
      artifactsPath: getTenantArtifactsRoot(trimmedClientId),
    },
    updatedAt: activeState.clientId === trimmedClientId ? activeState.updatedAt : undefined,
  };
}

export function resolveActiveTenant(): TenantDefinition | null {
  const activeState = readActiveTenantState();
  if (!activeState.clientId) {
    return null;
  }

  return resolveTenantByClientId(activeState.clientId);
}

export function listDiskTenants(): TenantDefinition[] {
  return listTenantIds()
    .map((clientId) => resolveTenantByClientId(clientId))
    .filter((item): item is TenantDefinition => item !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}