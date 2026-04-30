import fs from "node:fs";
import { getTenantDefinitionPath } from "@/lib/factory/tenant-context";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

type AnyRecord = Record<string, unknown>;

function getClientJsonPath(clientId: string) {
  return getTenantDefinitionPath(clientId);
}

function readClientJson(clientId: string): AnyRecord {
  const clientPath = getClientJsonPath(clientId);

  if (!fs.existsSync(clientPath)) {
    throw new Error("No existe el cliente activo en la fuente real del proyecto.");
  }

  const raw = fs.readFileSync(clientPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("El JSON del cliente activo no es válido.");
  }

  return parsed as AnyRecord;
}

function writeClientJson(clientId: string, data: AnyRecord) {
  const clientPath = getClientJsonPath(clientId);
  writeJsonAtomic(clientPath, data);
}

function normalizeModuleKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getModuleKeysFromJson(modulesValue: unknown): string[] {
  if (!Array.isArray(modulesValue)) {
    return [];
  }

  return modulesValue
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && typeof (item as AnyRecord).key === "string") {
        return String((item as AnyRecord).key);
      }

      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function addModuleToActiveClient(clientId: string, moduleName: string) {
  const json = readClientJson(clientId);
  const normalizedModule = normalizeModuleKey(moduleName);

  if (!normalizedModule) {
    throw new Error("No se pudo resolver el nombre del módulo a añadir.");
  }

  const currentModules = getModuleKeysFromJson(json.modules);
  const nextModules = uniqueStrings([...currentModules, normalizedModule]);

  json.modules = nextModules;
  json.updatedAt = new Date().toISOString();
  json.status = "updated";

  writeClientJson(clientId, json);

  return {
    clientId,
    module: normalizedModule,
    modules: nextModules,
  };
}

export function removeModuleFromActiveClient(clientId: string, moduleName: string) {
  const json = readClientJson(clientId);
  const normalizedModule = normalizeModuleKey(moduleName);

  if (!normalizedModule) {
    throw new Error("No se pudo resolver el nombre del módulo a quitar.");
  }

  const currentModules = getModuleKeysFromJson(json.modules);
  const nextModules = currentModules.filter((item) => item !== normalizedModule);

  json.modules = nextModules;
  json.updatedAt = new Date().toISOString();
  json.status = "updated";

  writeClientJson(clientId, json);

  return {
    clientId,
    module: normalizedModule,
    modules: nextModules,
    removed: currentModules.includes(normalizedModule),
  };
}

export function updateBrandingInstructionOnActiveClient(
  clientId: string,
  instruction: string
) {
  const json = readClientJson(clientId);

  const branding =
    json.branding && typeof json.branding === "object"
      ? ({ ...(json.branding as AnyRecord) } as AnyRecord)
      : ({} as AnyRecord);

  branding.instruction = instruction;
  branding.updatedAt = new Date().toISOString();

  json.branding = branding;
  json.updatedAt = new Date().toISOString();
  json.status = "updated";

  writeClientJson(clientId, json);

  return {
    clientId,
    branding,
  };
}