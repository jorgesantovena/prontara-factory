#!/usr/bin/env node
/**
 * Versión Postgres del create-admin-account.
 *
 * Crea (o actualiza) la cuenta admin/owner del Factory directamente en
 * Neon Postgres usando Prisma. Pensado para correrse desde local apuntando
 * al DATABASE_URL de producción cuando hace falta dar acceso al chat de
 * Factory desde app.prontara.com sin tener filesystem persistente.
 *
 * El script original (create-admin-account.mjs) escribe a JSON local — útil
 * para dev pero no aplica en serverless donde el filesystem es read-only y
 * la persistencia es Postgres.
 *
 * Variables de entorno aceptadas:
 *   DATABASE_URL              (OBLIGATORIA) URL de Postgres Neon
 *   PRONTARA_ADMIN_PASSWORD   (OBLIGATORIA) contraseña en claro
 *   PRONTARA_ADMIN_EMAIL      (OBLIGATORIA) email de la cuenta
 *   PRONTARA_ADMIN_CLIENT_ID  (OBLIGATORIA) clientId del tenant Factory
 *                             (en producción no hay active-client.json,
 *                             hay que pasarlo explícito)
 *   PRONTARA_ADMIN_FULL_NAME  (opcional) nombre completo
 *   PRONTARA_ADMIN_ROLE       (opcional) "owner" (default) o "admin"
 *
 * Uso típico (PowerShell / bash):
 *
 *   $env:DATABASE_URL = "postgresql://user:pass@neon-host/db?sslmode=require"
 *   $env:PRONTARA_ADMIN_EMAIL = "jorge.santovena@gmail.com"
 *   $env:PRONTARA_ADMIN_CLIENT_ID = "factory-prontara"
 *   $env:PRONTARA_ADMIN_PASSWORD = (Read-Host "Password" -AsSecureString | ConvertFrom-SecureString -AsPlainText)
 *   node scripts/create-admin-account-postgres.mjs
 *   Remove-Item Env:\PRONTARA_ADMIN_PASSWORD
 *
 * Idempotente: si ya existe una cuenta owner/admin en ese clientId la
 * actualiza con la nueva contraseña y email. Si no existe la crea.
 */

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

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

function readEnv(name, { required = false } = {}) {
  const value = String(process.env[name] || "").trim();
  if (required && !value) {
    console.error(`[create-admin] Falta la variable de entorno ${name}.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[create-admin] Falta DATABASE_URL.");
    process.exit(1);
  }

  const email = readEnv("PRONTARA_ADMIN_EMAIL", { required: true })
    .toLowerCase();
  const password = readEnv("PRONTARA_ADMIN_PASSWORD", { required: true });
  const clientId = readEnv("PRONTARA_ADMIN_CLIENT_ID", { required: true });
  const fullName =
    readEnv("PRONTARA_ADMIN_FULL_NAME") || email.split("@")[0] || "admin";
  const role =
    readEnv("PRONTARA_ADMIN_ROLE") === "admin" ? "admin" : "owner";

  if (password.length < 8) {
    console.error(
      "[create-admin] La contraseña debe tener al menos 8 caracteres.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 1. Localiza el tenant por clientId
    const tenant = await prisma.tenant.findUnique({
      where: { clientId },
      select: { id: true, slug: true, displayName: true },
    });
    if (!tenant) {
      console.error(
        `[create-admin] No existe el tenant con clientId='${clientId}'.`,
      );
      console.error(
        `[create-admin] Crea primero el tenant Factory o usa list para ver los clientIds disponibles.`,
      );
      process.exit(1);
    }

    // 2. Busca cuenta existente con este email en este tenant
    const existing = await prisma.tenantAccount.findUnique({
      where: { clientId_email: { clientId, email } },
    });

    const passwordHash = hashPassword(password);
    const now = new Date();

    if (existing) {
      const updated = await prisma.tenantAccount.update({
        where: { id: existing.id },
        data: {
          tenantId: tenant.id,
          slug: tenant.slug,
          fullName,
          role,
          status: "active",
          passwordHash,
          temporaryPassword: "",
          mustChangePassword: false,
          updatedAt: now,
          lastProvisionedAt: now,
        },
      });
      console.log(`[create-admin] OK: cuenta actualizada.`);
      console.log(`  id        : ${updated.id}`);
      console.log(`  email     : ${updated.email}`);
      console.log(`  clientId  : ${updated.clientId}`);
      console.log(`  role      : ${updated.role}`);
      console.log(`  status    : ${updated.status}`);
    } else {
      const created = await prisma.tenantAccount.create({
        data: {
          id: "acc-" + randomUUID(),
          tenantId: tenant.id,
          clientId,
          slug: tenant.slug,
          email,
          fullName,
          role,
          status: "active",
          passwordHash,
          temporaryPassword: "",
          mustChangePassword: false,
          createdAt: now,
          updatedAt: now,
          lastProvisionedAt: now,
        },
      });
      console.log(`[create-admin] OK: cuenta creada.`);
      console.log(`  id        : ${created.id}`);
      console.log(`  email     : ${created.email}`);
      console.log(`  clientId  : ${created.clientId}`);
      console.log(`  role      : ${created.role}`);
      console.log(`  status    : ${created.status}`);
    }

    console.log("");
    console.log("Login en https://app.prontara.com/acceso con este email + tu contraseña.");
    console.log(
      "Si tienes habilitado el rol 'owner' o 'admin' en la cuenta del tenant Factory,",
    );
    console.log("podrás acceder a /factory/* (chat, dashboard, auditoría, etc.).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[create-admin] Error:", err);
  process.exit(1);
});
