/**
 * Almacenamiento simple de leads capturados desde la landing pública.
 *
 * Se guarda un JSON por lead en `data/saas/leads/<ts>-<id>.json`. Sin
 * base de datos, sin Stripe, sin CRM externo — solo el mínimo viable
 * para que el embudo no pierda leads mientras se construye el CRM real.
 *
 * El listado en `/factory/leads` es read-only; el CRM interno del ERP
 * se alimenta aparte. Cuando haya integración con Prontara propio
 * (usarlo como primer cliente), este store puede migrarse a
 * data/saas/<clientId-de-prontara>/crm.json.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeJsonAtomic } from "@/lib/saas/fs-atomic";

export type LeadStatus = "new" | "contacted" | "qualified" | "discarded";

export type LeadRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  sourceVertical: string | null;
  status: LeadStatus;
  userAgent: string;
  ip: string;
};

function projectRoot(): string {
  return process.cwd();
}

function getLeadsDir(): string {
  const dir = path.join(projectRoot(), "data", "saas", "leads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function leadFilePath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("id de lead inválido.");
  return path.join(getLeadsDir(), id + ".json");
}

function sanitize(value: string, maxLen: number): string {
  return String(value || "").trim().slice(0, maxLen);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type CreateLeadInput = {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  sourceVertical?: string;
  userAgent?: string;
  ip?: string;
};

export function createLead(input: CreateLeadInput): LeadRecord {
  const name = sanitize(input.name, 120);
  const email = sanitize(input.email, 180).toLowerCase();
  const company = sanitize(input.company || "", 180);
  const phone = sanitize(input.phone || "", 60);
  const message = sanitize(input.message || "", 2000);
  const sourceVertical = sanitize(input.sourceVertical || "", 80) || null;

  if (!name) throw new Error("Falta nombre.");
  if (!email || !validEmail(email)) throw new Error("Email no válido.");

  const now = new Date().toISOString();
  const id =
    "lead-" +
    now.slice(0, 10).replace(/-/g, "") +
    "-" +
    randomUUID().slice(0, 8);

  const record: LeadRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    name,
    email,
    company,
    phone,
    message,
    sourceVertical,
    status: "new",
    userAgent: sanitize(input.userAgent || "", 400),
    ip: sanitize(input.ip || "", 60),
  };

  writeJsonAtomic(leadFilePath(id), record);
  return record;
}

export function listLeads(options: { limit?: number; status?: LeadStatus } = {}): LeadRecord[] {
  const dir = getLeadsDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const limit = Math.max(1, Math.min(options.limit || 100, 500));
  const out: LeadRecord[] = [];
  for (const file of files) {
    if (out.length >= limit) break;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (!parsed || typeof parsed !== "object") continue;
      if (options.status && parsed.status !== options.status) continue;
      out.push(parsed as LeadRecord);
    } catch {
      // ignoramos ficheros corruptos
    }
  }
  return out;
}

export function updateLeadStatus(id: string, status: LeadStatus): LeadRecord {
  const filePath = leadFilePath(id);
  if (!fs.existsSync(filePath)) throw new Error("Lead no encontrado.");
  const current = JSON.parse(fs.readFileSync(filePath, "utf8")) as LeadRecord;
  const next: LeadRecord = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(filePath, next);
  return next;
}
