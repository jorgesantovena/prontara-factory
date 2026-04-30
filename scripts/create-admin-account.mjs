#!/usr/bin/env node
/**
 * Crea (o resetea) una cuenta admin/owner en un tenant existente.
 *
 * Diseñado para uso one-shot desde PowerShell cuando no te acuerdas de la
 * contraseña del tenant o no llegaste a completar el alta. Hashea con scrypt
 * el valor que le pasas por variable de entorno (nunca por CLI para que no
 * quede en el historial) y lo escribe en data/saas/accounts/<clientId>.json.
 *
 * Variables de entorno aceptadas:
 *   PRONTARA_ADMIN_PASSWORD   (OBLIGATORIA) contraseña en claro
 *   PRONTARA_ADMIN_EMAIL      (OBLIGATORIA) email de la cuenta
 *   PRONTARA_ADMIN_CLIENT_ID  (opcional) clientId del tenant; si falta se
 *                             usa el active-client actual
 *   PRONTARA_ADMIN_FULL_NAME  (opcional) nombre completo; por defecto usa
 *                             el prefijo del email
 *   PRONTARA_ADMIN_ROLE       (opcional) "owner" (default) o "admin"
 *
 * Uso típico en PowerShell:
 *
 *   cd C:\ProntaraFactory\prontara-factory
 *   $env:PRONTARA_ADMIN_EMAIL = "jorge.santovena@gmail.com"
 *   $secure = Read-Host "Nueva contrasena" -AsSecureString
 *   $env:PRONTARA_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
 *   node scripts/create-admin-account.mjs
 *   Remove-Item Env:\PRONTARA_ADMIN_PASSWORD
 *   Remove-Item Env:\PRONTARA_ADMIN_EMAIL
 *
 * El script es idempotente: si la cuenta ya existe con ese email la actualiza
 * (nueva contraseña, mustChangePassword=false, status=active). Si no existe
 * la crea. Nunca borra cuentas existentes.
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

function hashPassword(plain) {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(String(plain || ""), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return (
    "scrypt$" +
    SCRYPT_N +
    "$" +
    SCRYPT_R +
    "$" +
    SCRYPT_P +
    "$" +
    salt.toString("base64") +
    "$" +
    derived.toString("base64")
  );
}

function fail(message) {
  process.stderr.write("[create-admin-account] ERROR: " + message + "\n");
  process.exit(1);
}

function readEnv(name, required = false) {
  const value = String(process.env[name] || "").trim();
  if (!value && required) {
    fail("Falta la variable de entorno " + name + ".");
  }
  return value;
}

function resolveClientId(projectRoot) {
  const fromEnv = readEnv("PRONTARA_ADMIN_CLIENT_ID");
  if (fromEnv) return fromEnv;

  const activeClientPath = path.join(projectRoot, "data", "factory", "active-client.json");
  if (!fs.existsSync(activeClientPath)) {
    fail(
      "No se ha indicado PRONTARA_ADMIN_CLIENT_ID y tampoco existe " +
        "data/factory/active-client.json. Define el clientId manualmente.",
    );
  }

  try {
    const raw = JSON.parse(fs.readFileSync(activeClientPath, "utf8"));
    const clientId = String(raw.clientId || "").trim();
    if (!clientId) fail("active-client.json no tiene clientId.");
    return clientId;
  } catch (err) {
    fail("No se pudo leer active-client.json: " + (err instanceof Error ? err.message : "error"));
  }
}

function loadTenantDefinition(projectRoot, clientId) {
  const defPath = path.join(projectRoot, ".prontara", "clients", clientId + ".json");
  if (!fs.existsSync(defPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(defPath, "utf8"));
  } catch {
    return null;
  }
}

function resolveTenantIdAndSlug(clientId, definition) {
  const def = definition || {};
  const branding = def.branding && typeof def.branding === "object" ? def.branding : {};
  const slug =
    String(def.slug || def.tenantSlug || branding.slug || clientId).trim() || clientId;
  const tenantId = String(def.tenantId || def.id || clientId).trim() || clientId;
  return { tenantId, slug };
}

function defaultFullNameFromEmail(email) {
  const prefix = email.split("@")[0] || "Admin";
  return prefix.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function main() {
  const projectRoot = process.cwd();

  const email = readEnv("PRONTARA_ADMIN_EMAIL", true).toLowerCase();
  const password = readEnv("PRONTARA_ADMIN_PASSWORD", true);
  const clientId = resolveClientId(projectRoot);
  const definition = loadTenantDefinition(projectRoot, clientId);
  const { tenantId, slug } = resolveTenantIdAndSlug(clientId, definition);
  const fullName = readEnv("PRONTARA_ADMIN_FULL_NAME") || defaultFullNameFromEmail(email);
  const roleInput = readEnv("PRONTARA_ADMIN_ROLE") || "owner";
  const role = roleInput === "admin" ? "admin" : "owner";

  if (password.length < 8) {
    fail("La contraseña debe tener al menos 8 caracteres.");
  }

  const accountsPath = path.join(
    projectRoot,
    "data",
    "saas",
    "accounts",
    clientId + ".json",
  );

  let accounts = [];
  if (fs.existsSync(accountsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
      if (Array.isArray(raw)) accounts = raw;
    } catch (err) {
      fail(
        "El fichero " +
          accountsPath +
          " existe pero no es JSON válido: " +
          (err instanceof Error ? err.message : "error"),
      );
    }
  }

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const existingIndex = accounts.findIndex(
    (acc) => String(acc.email || "").toLowerCase() === email,
  );

  let action = "";
  if (existingIndex >= 0) {
    const current = accounts[existingIndex];
    accounts[existingIndex] = {
      ...current,
      fullName: current.fullName || fullName,
      role,
      status: "active",
      passwordHash,
      temporaryPassword: "",
      mustChangePassword: false,
      updatedAt: now,
    };
    action = "actualizada";
  } else {
    accounts.push({
      id: "acc-" + randomUUID(),
      tenantId,
      clientId,
      slug,
      email,
      fullName,
      role,
      status: "active",
      passwordHash,
      temporaryPassword: "",
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
    });
    action = "creada";
  }

  writeJsonAtomic(accountsPath, accounts);

  process.stdout.write(
    [
      "",
      "Cuenta " + action + " correctamente.",
      "  clientId : " + clientId,
      "  tenant   : " + slug,
      "  email    : " + email,
      "  rol      : " + role,
      "  fichero  : " + path.relative(projectRoot, accountsPath),
      "",
      "Entra en http://localhost:3000/acceso con:",
      "  Tenant   : " + slug,
      "  Email    : " + email,
      "  Password : (la que acabas de elegir)",
      "",
    ].join("\n"),
  );
}

main();
