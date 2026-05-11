#!/usr/bin/env node
/**
 * Diagnóstico rápido: muestra 1 registro del módulo `proyectos` del tenant
 * para verificar la forma del payloadJson.
 *
 * Uso:
 *   node scripts/inspect-tenant-data.mjs [moduleKey] [clientId]
 *
 * Defaults: moduleKey="proyectos", clientId="estandar-20260419194129".
 *
 * Lee DATABASE_URL desde .env.local o .env (igual que reseed-tenant.mjs).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDatabaseUrlFromEnvFiles() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let value = m[1].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && /^postgres(ql)?:\/\//i.test(value)) {
        process.env.DATABASE_URL = value;
        console.log("[inspect] DATABASE_URL leída de " + file);
        return;
      }
    }
  }
}

loadDatabaseUrlFromEnvFiles();

const moduleKey = process.argv[2] || "proyectos";
const clientId = process.argv[3] || "estandar-20260419194129";

const prisma = new PrismaClient();

async function main() {
  console.log("[inspect] tenant   :", clientId);
  console.log("[inspect] moduleKey:", moduleKey);

  const totalCount = await prisma.tenantModuleRecord.count({
    where: { clientId, moduleKey },
  });
  console.log("[inspect] total registros:", totalCount);

  const first = await prisma.tenantModuleRecord.findFirst({
    where: { clientId, moduleKey },
    select: { id: true, payloadJson: true, createdAt: true },
  });

  if (!first) {
    console.log("[inspect] No hay ningún registro.");
    return;
  }

  console.log("[inspect] primer registro:");
  console.log(JSON.stringify(first, null, 2));
}

main()
  .catch((err) => {
    console.error("[inspect] Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
