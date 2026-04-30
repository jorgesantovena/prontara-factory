/**
 * Persistencia de overrides de vertical.
 *
 * Un fichero JSON por vertical en `data/saas/vertical-overrides/<key>.json`.
 * Escrituras atómicas. Lecturas tolerantes a ficheros faltantes (devuelven null).
 */
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";
import type { SectorPackOverride } from "@/lib/factory/sector-pack-override-types";

const VALID_KEY = /^[a-z0-9][a-z0-9-]{1,80}$/;

function projectRoot(): string {
  return process.cwd();
}

function getOverridesDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "vertical-overrides");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOverridePath(key: string): string {
  if (!VALID_KEY.test(key)) {
    throw new Error("Key de vertical inválida: '" + key + "'.");
  }
  return path.join(getOverridesDir(), key + ".json");
}

export function readVerticalOverride(key: string): SectorPackOverride | null {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return null;

  let filePath: string;
  try {
    filePath = getOverridePath(normalized);
  } catch {
    return null;
  }

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SectorPackOverride;
    if (!parsed || typeof parsed !== "object") return null;
    if (String(parsed.key || "").toLowerCase() !== normalized) {
      // Defensa contra ficheros corruptos con key distinto.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function listVerticalOverrides(): SectorPackOverride[] {
  const dir = getOverridesDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const out: SectorPackOverride[] = [];
  for (const file of files) {
    const key = file.replace(/\.json$/, "");
    const override = readVerticalOverride(key);
    if (override) out.push(override);
  }
  return out;
}

export type WriteOverrideInput = {
  key: string;
  override: SectorPackOverride;
  updatedBy?: string;
};

export function writeVerticalOverride(input: WriteOverrideInput): SectorPackOverride {
  const normalized = String(input.key || "").trim().toLowerCase();
  if (!VALID_KEY.test(normalized)) {
    throw new Error("Key de vertical inválida: '" + input.key + "'.");
  }

  const merged: SectorPackOverride = {
    ...input.override,
    key: normalized,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy || input.override.updatedBy || "unknown",
  };

  const filePath = getOverridePath(normalized);
  writeJsonAtomic(filePath, merged);
  return merged;
}

export function deleteVerticalOverride(key: string): boolean {
  const normalized = String(key || "").trim().toLowerCase();
  if (!VALID_KEY.test(normalized)) return false;

  const filePath = getOverridePath(normalized);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
