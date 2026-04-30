import fs from "node:fs";
import path from "node:path";

export type TenantDefinition = {
  clientId: string;
  businessType?: string;
  displayName?: string;
  branding?: Record<string, unknown>;
  modules?: string[];
  blueprintVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  provisioning?: Record<string, unknown>;
  generation?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TenantContext = {
  clientId: string;
  definitionPath: string;
  dataRoot: string;
  artifactsRoot: string;
  exportsRoot: string;
  deploymentsRoot: string;
  definition: TenantDefinition;
};

function getProjectRoot(): string {
  return process.cwd();
}

function getClientsRoot(): string {
  return path.join(getProjectRoot(), ".prontara", "clients");
}

function getDataBaseRoot(): string {
  return path.join(getProjectRoot(), ".prontara", "data");
}

function getArtifactsBaseRoot(): string {
  return path.join(getProjectRoot(), ".prontara", "artifacts");
}

function getExportsBaseRoot(): string {
  return path.join(getProjectRoot(), ".prontara", "exports");
}

function getDeploymentsBaseRoot(): string {
  return path.join(getProjectRoot(), ".prontara", "deployments");
}

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    throw new Error(`File is empty: ${filePath}`);
  }

  // Tolerar BOM UTF-8 (PowerShell/Windows lo a~aden y rompe JSON.parse).
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  return JSON.parse(raw) as T;
}

export function getTenantDefinitionsRoot(): string {
  return getClientsRoot();
}

export function listTenantIds(): string[] {
  const clientsRoot = getTenantDefinitionsRoot();

  if (!fs.existsSync(clientsRoot)) {
    return [];
  }

  return fs
    .readdirSync(clientsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/i, ""))
    .filter(Boolean)
    .sort();
}

export function getTenantDefinitionPath(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  return path.join(getClientsRoot(), `${normalized}.json`);
}

export function getTenantDefinition(clientId: string): TenantDefinition {
  const filePath = getTenantDefinitionPath(clientId);
  const definition = readJsonFile<TenantDefinition>(filePath);

  if (!definition.clientId || definition.clientId.trim() === "") {
    throw new Error(`Tenant definition missing clientId: ${filePath}`);
  }

  return definition;
}

export function getTenantDataRoot(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  return path.join(getDataBaseRoot(), normalized);
}

export function getTenantArtifactsRoot(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  return path.join(getArtifactsBaseRoot(), normalized);
}

export function getTenantExportsRoot(_clientId: string): string {
  return getExportsBaseRoot();
}

export function getTenantDeploymentsRoot(clientId: string): string {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  return path.join(getDeploymentsBaseRoot(), normalized);
}

export function resolveTenantContext(clientId: string): TenantContext {
  const normalized = clientId.trim();
  if (!normalized) {
    throw new Error("clientId cannot be empty");
  }

  const definitionPath = getTenantDefinitionPath(normalized);
  const definition = getTenantDefinition(normalized);

  return {
    clientId: normalized,
    definitionPath,
    dataRoot: getTenantDataRoot(normalized),
    artifactsRoot: getTenantArtifactsRoot(normalized),
    exportsRoot: getTenantExportsRoot(normalized),
    deploymentsRoot: getTenantDeploymentsRoot(normalized),
    definition,
  };
}