#!/usr/bin/env node
/**
 * Re-siembra los datos demo de un tenant en su Postgres directamente,
 * sin pasar por el chat de Factory ni por endpoints HTTP.
 *
 * Pensado para reseedear tu propio tenant cuando cambias el sector-pack
 * (modelo de proyectos, demo data, catálogo de servicios, etc.) y
 * quieres ver el resultado en producción sin tocar nada manualmente.
 *
 * Variables de entorno requeridas:
 *   DATABASE_URL              URL de Neon Postgres
 *   PRONTARA_RESEED_CLIENT_ID clientId del tenant a reseedear (ej:
 *                             estandar-20260419194129)
 *
 * Variables opcionales:
 *   PRONTARA_RESEED_MODE     "replace" (default) borra antes / "merge"
 *                             solo añade lo que falta.
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL = "postgresql://..."
 *   $env:PRONTARA_RESEED_CLIENT_ID = "estandar-20260419194129"
 *   node scripts/reseed-tenant.mjs
 *   Remove-Item Env:\DATABASE_URL
 *   Remove-Item Env:\PRONTARA_RESEED_CLIENT_ID
 *
 * El script hace lo siguiente:
 *   1. Conecta a la base de datos.
 *   2. Localiza el tenant por clientId (también lee businessType).
 *   3. Importa el sector pack que corresponde (software-factory, etc.)
 *      desde el código compilado en .next o cae a un require directo.
 *   4. Borra (mode=replace) o conserva (mode=merge) los TenantModuleRecord
 *      existentes y mete los demoData del pack.
 *
 * No toca cuentas, billing, trial ni lifecycle — solo datos del módulo
 * (clientes, proyectos, actividades, etc.).
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL) {
  console.error("[reseed] Falta DATABASE_URL.");
  process.exit(1);
}
const clientId = String(process.env.PRONTARA_RESEED_CLIENT_ID || "").trim();
if (!clientId) {
  console.error(
    "[reseed] Falta PRONTARA_RESEED_CLIENT_ID. Ejemplo: estandar-20260419194129",
  );
  process.exit(1);
}
const mode =
  String(process.env.PRONTARA_RESEED_MODE || "replace").toLowerCase() ===
  "merge"
    ? "merge"
    : "replace";

console.log("[reseed] tenant   :", clientId);
console.log("[reseed] modo     :", mode);

const prisma = new PrismaClient();

/**
 * Carga el sector pack del tenant. Como este script vive fuera del runtime
 * Next, no podemos hacer `import "@/lib/factory/sector-pack-registry"`
 * directamente. En su lugar, leemos el JS compilado del fichero TS
 * mediante un truco: parseamos el sector-pack-registry.ts y extraemos el
 * objeto demoData del pack que toca.
 *
 * Como es texto plano y la estructura del pack es estable, hacemos una
 * extracción muy ligera: buscamos `const FOO_PACK: SectorPackDefinition = {`,
 * cogemos hasta el cierre coincidente y lo evaluamos en un sandbox JS.
 *
 * Esto evita compilar el TS y evita arrastrar todo Next.
 */
function extractPackFromSource(packConstName) {
  const filePath = resolve(
    process.cwd(),
    "src",
    "lib",
    "factory",
    "sector-pack-registry.ts",
  );
  if (!existsSync(filePath)) {
    throw new Error("No encuentro " + filePath);
  }
  const source = readFileSync(filePath, "utf8");

  const startMarker =
    "const " + packConstName + ": SectorPackDefinition = {";
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("No encuentro la constante " + packConstName + " en el fichero.");
  }
  // Buscamos el cierre `};` que case con el `{` inicial. Recorremos
  // contando llaves para soportar JSON anidado.
  let i = source.indexOf("{", startIdx);
  let depth = 0;
  let endIdx = -1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) {
    throw new Error("No pude cerrar el objeto " + packConstName + ".");
  }
  const body = source.slice(source.indexOf("{", startIdx), endIdx);
  // El cuerpo es JS válido (incluye claves sin comillas y strings con
  // comillas dobles). Lo evaluamos con Function para sacar el objeto.
  // Es seguro porque la fuente es nuestro propio código del repo.
  const factory = new Function("return " + body + ";");
  return factory();
}

/**
 * Genera un id estable a partir del contenido — evita duplicados al
 * re-correr en modo merge. Misma lógica que demo-seeder.ts.
 */
function stableIdFromRow(moduleKey, row) {
  const keys = Object.keys(row)
    .filter((k) => k !== "id" && k !== "createdAt" && k !== "updatedAt")
    .sort();
  const payload = keys.map((k) => k + "=" + String(row[k] ?? "")).join("||");
  const hash = createHash("sha1").update(moduleKey + "::" + payload).digest("hex");
  return moduleKey + "-" + hash.slice(0, 16);
}

function normalizeRow(moduleKey, row, now) {
  const id = String(row.id || stableIdFromRow(moduleKey, row));
  const out = {
    id,
    createdAt: String(row.createdAt || now),
    updatedAt: now,
  };
  for (const [k, v] of Object.entries(row)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

async function main() {
  // 1. Localiza tenant
  const tenant = await prisma.tenant.findUnique({
    where: { clientId },
    select: {
      id: true,
      clientId: true,
      slug: true,
      displayName: true,
      businessType: true,
    },
  });
  if (!tenant) {
    console.error("[reseed] No existe tenant con clientId=" + clientId);
    process.exit(1);
  }
  console.log("[reseed] displayName  :", tenant.displayName);
  console.log("[reseed] businessType :", tenant.businessType);

  if (tenant.businessType !== "software-factory") {
    console.warn(
      "[reseed] Aviso: este script tiene hardcoded el pack software-factory.",
    );
    console.warn(
      "[reseed] Tu tenant es '" +
        tenant.businessType +
        "'. Continuará pero puede no aplicar todos los datos.",
    );
  }

  // 2. Carga el pack
  const pack = extractPackFromSource("SOFTWARE_FACTORY_PACK");
  console.log(
    "[reseed] pack cargado :",
    pack.key,
    "—",
    (pack.demoData || []).length,
    "módulos con demoData",
  );

  // 3. Para cada módulo del demoData, replicamos la lógica del seeder.
  const now = new Date().toISOString();
  let totalInserted = 0;
  let totalSkipped = 0;
  const summary = [];

  for (const demoModule of pack.demoData || []) {
    const moduleKey = demoModule.moduleKey;
    const records = (demoModule.records || []).map((r) =>
      normalizeRow(moduleKey, r, now),
    );

    if (mode === "replace") {
      await prisma.tenantModuleRecord.deleteMany({
        where: { clientId: tenant.clientId, moduleKey },
      });
      const ops = records.map((r) =>
        prisma.tenantModuleRecord.create({
          data: {
            id: String(r.id || randomUUID()),
            tenantId: tenant.id,
            clientId: tenant.clientId,
            moduleKey,
            payload: r,
          },
        }),
      );
      await prisma.$transaction(ops);
      summary.push({
        moduleKey,
        insertedRows: records.length,
        skippedRows: 0,
      });
      totalInserted += records.length;
      console.log(
        "  [replace] " + moduleKey + ": " + records.length + " filas",
      );
      continue;
    }

    // merge
    const existing = await prisma.tenantModuleRecord.findMany({
      where: { clientId: tenant.clientId, moduleKey },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => String(e.id)));
    const toAppend = records.filter((r) => !existingIds.has(String(r.id)));
    const skipped = records.length - toAppend.length;
    if (toAppend.length > 0) {
      const ops = toAppend.map((r) =>
        prisma.tenantModuleRecord.create({
          data: {
            id: String(r.id || randomUUID()),
            tenantId: tenant.id,
            clientId: tenant.clientId,
            moduleKey,
            payload: r,
          },
        }),
      );
      await prisma.$transaction(ops);
    }
    summary.push({
      moduleKey,
      insertedRows: toAppend.length,
      skippedRows: skipped,
    });
    totalInserted += toAppend.length;
    totalSkipped += skipped;
    console.log(
      "  [merge]   " +
        moduleKey +
        ": +" +
        toAppend.length +
        " (saltadas " +
        skipped +
        ")",
    );
  }

  console.log("");
  console.log("[reseed] Total insertadas :", totalInserted);
  console.log("[reseed] Total saltadas   :", totalSkipped);
  console.log("");
  console.log(
    "[reseed] OK. Refresca https://app.prontara.com/?tenant=" +
      tenant.slug +
      " y deberías ver los datos nuevos.",
  );
}

main()
  .catch((err) => {
    console.error("[reseed] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
