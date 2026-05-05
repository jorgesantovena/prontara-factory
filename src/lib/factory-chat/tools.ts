/**
 * Herramientas del agente del chat Factory.
 *
 * FASE 1 (lectura): list_tenants, read_tenant_detail, list_verticals,
 *   read_vertical, read_factory_health, read_repo_file, list_repo_files.
 * FASE 2 (escritura con auditoría): write_repo_file, patch_repo_file,
 *   run_tsc_check, run_lint_check, read_audit_log, list_backup_snapshots,
 *   restore_backup_snapshot. Cada mutación genera snapshot + entrada en
 *   data/factory/chat/audit/.
 *
 * Cada tool recibe su input validado y devuelve string JSON. Si falla
 * devuelve { error }. Las tools de escritura requieren ToolContext para
 * poder auditarse; si no se pasa se rechazan.
 */

import fs from "node:fs";
import path from "node:path";
import { listTenantClientsIndexAsync } from "@/lib/persistence/tenant-clients-index-async";
import { getTenantSnapshotAsync } from "@/lib/persistence/tenant-snapshot-async";
import { getPersistenceBackend } from "@/lib/persistence/db";
import { getFactoryClientDetail } from "@/lib/factory/factory-client-detail";
import { SECTOR_PACKS, getSectorPackByKey } from "@/lib/factory/sector-pack-registry";
import { getFactoryHealthSnapshot } from "@/lib/factory/factory-health";
import type { ToolContext } from "@/lib/factory-chat/audit";
import { searchCodebase } from "@/lib/factory-chat/codebase-index";
import { isCodeModeAvailable } from "@/lib/factory-chat/runtime-mode";
import {
  writeRepoFileTool,
  patchRepoFileTool,
  runTscCheckTool,
  runLintCheckTool,
  readAuditLogTool,
  listBackupSnapshotsTool,
  restoreBackupSnapshotTool,
  regenerateTenantTool,
  invalidateFactoryCacheTool,
  seedDemoDataTool,
  hardReprovisionTenantTool,
  commitToGitHubPrTool,
} from "@/lib/factory-chat/write-tools";

export type ToolSchema = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * Ruta del repo permitida para lectura. Evita que el agente baje a
 * data/ (donde viven secretos de tenants) o a node_modules.
 */
const READ_WHITELIST = [
  "src/",
  "docs/",
  "scripts/",
  "prisma/",
  "README.md",
  "package.json",
  "tsconfig.json",
];

function isPathSafe(relPath: string): boolean {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/g, "");
  if (normalized.startsWith("/") || normalized.startsWith("..")) return false;
  return READ_WHITELIST.some((allowed) =>
    normalized === allowed.replace(/\/$/, "") || normalized.startsWith(allowed),
  );
}

/** Esquema de tools que se envía a Claude en el request. */
export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "list_tenants",
    description:
      "Devuelve la lista resumida de todos los tenants provisionados en esta Factory, con clientId, slug, displayName y metadatos básicos. Úsalo para explorar qué clientes hay o para localizar uno por nombre antes de abrir su ficha.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_tenant_detail",
    description:
      "Devuelve la ficha detallada de un tenant: datos de compra, tenant/slug, suscripción, branding, acceso, estado de provisioning, historial de evolución, wrapper, validación comercial y KPIs operativos. Requiere el clientId (se obtiene de list_tenants).",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "clientId del tenant" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "list_verticals",
    description:
      "Devuelve el catálogo de verticales (sector packs) definidos en el registry, con su key, label, sector, businessType y cuántos módulos y entidades tiene cada uno.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_vertical",
    description:
      "Devuelve la SectorPackDefinition completa de un vertical, incluyendo branding, labels, renameMap, modules, entities, fields, tableColumns, dashboardPriorities, demoData, landing y assistantCopy. Requiere la key del vertical.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "key del vertical (ej. 'software-factory', 'gimnasio')" },
      },
      required: ["key"],
    },
  },
  {
    name: "read_factory_health",
    description:
      "Devuelve el estado de salud técnica de la Factory: tenants sanos / parciales / corruptos, fallos de runtime, estado de evolution/billing/delivery.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_repo_file",
    description:
      "Lee un archivo del repositorio por ruta relativa desde la raíz del proyecto. Limitado a src/, docs/, scripts/, prisma/ y archivos sueltos en raíz. Por defecto devuelve solo los primeros 8000 bytes — para ficheros más grandes usa byteOffset para paginar. Máximo absoluto 80000 bytes por llamada. Si necesitas explorar un directorio, prefiere list_repo_files primero.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "ruta relativa al archivo" },
        byteOffset: { type: "number", description: "offset en bytes (opcional)" },
        byteLimit: { type: "number", description: "máximo de bytes a devolver (default 8000, máx 80000)" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_repo_files",
    description:
      "Lista archivos de un directorio del repositorio (no recursivo). Usa patrones de paths permitidos (src/, docs/, scripts/, prisma/). Devuelve nombres y tamaños.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "ruta relativa al directorio" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_codebase",
    description:
      "Búsqueda en el codebase por relevancia (BM25 sobre chunks de 120 líneas). Devuelve los fragmentos más relevantes con path, rango de líneas, score y snippet. Úsala ANTES de read_repo_file cuando no sabes dónde está la lógica: consume mucho menos contexto y te lleva directo al fichero. No es búsqueda semántica real (sin embeddings) pero rinde bien con queries que contienen nombres de funciones, keys o términos concretos del dominio.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "texto a buscar (palabras clave, nombres de funciones, términos del dominio)",
        },
        limit: {
          type: "number",
          description: "número máximo de resultados (default 10, máx 50)",
        },
        pathFilter: {
          type: "string",
          description: "opcional: subcadena que el path debe contener (p.ej. 'factory-chat' o 'verticals/')",
        },
      },
      required: ["query"],
    },
  },
  // ---- FASE 2: write tools ----
  {
    name: "write_repo_file",
    description:
      "Crea o sobreescribe un fichero dentro del repo. Solo se permite dentro de src/, docs/, scripts/ y prisma/schema.prisma. Antes de escribir se hace un snapshot automático del fichero anterior en .prontara/backups/chat-writes/ y se registra la operación en el log de auditoría. Usa esta tool para ficheros nuevos o para rewrites completos; para cambios parciales es mejor patch_repo_file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "ruta relativa al fichero" },
        content: { type: "string", description: "contenido completo del fichero" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "patch_repo_file",
    description:
      "Aplica un cambio puntual a un fichero existente reemplazando una cadena por otra. oldString debe aparecer exactamente una vez en el fichero (si no, pasa replaceAll:true o añade contexto para hacerlo único). Snapshot + auditoría automáticos. Úsala para ediciones quirúrgicas sin reescribir el fichero entero.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "ruta relativa al fichero" },
        oldString: { type: "string", description: "texto exacto a reemplazar" },
        newString: { type: "string", description: "texto nuevo" },
        replaceAll: {
          type: "boolean",
          description: "si true, reemplaza todas las apariciones (por defecto exige que sea única)",
        },
      },
      required: ["path", "oldString", "newString"],
    },
  },
  {
    name: "run_tsc_check",
    description:
      "Corre el TypeScript compiler en modo --noEmit sobre todo el repo y devuelve los errores reales (filtra automáticamente ruido del entorno como tipos de node/react/next no instalados). Úsala después de cada write_repo_file/patch_repo_file para confirmar que no rompiste nada. Tarda 30-90 segundos.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "run_lint_check",
    description:
      "Corre ESLint sobre una lista de paths (dentro de src/, docs/, scripts/). Si no pasas paths, corre sobre todo src/. Úsala como segunda validación después de tsc.",
    input_schema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "paths relativos a lintar (opcional)",
        },
      },
    },
  },
  {
    name: "read_audit_log",
    description:
      "Lee entradas recientes del log de auditoría del chat. Útil para contestar '¿qué has cambiado en el repo en las últimas horas?' o verificar cambios previos.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "número máximo de entradas (default 20, máx 500)" },
        tool: {
          type: "string",
          description: "filtrar por nombre de tool (ej. 'write_repo_file')",
        },
        conversationId: {
          type: "string",
          description: "filtrar por id de conversación",
        },
      },
    },
  },
  {
    name: "list_backup_snapshots",
    description:
      "Lista snapshots de backup creados por write_repo_file/patch_repo_file, con su backupRef y los ficheros incluidos. Necesario antes de restaurar uno.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "número máximo de snapshots (default 50)" },
      },
    },
  },
  {
    name: "restore_backup_snapshot",
    description:
      "Restaura un snapshot sobreescribiendo los ficheros actuales con los del snapshot. Hace primero un snapshot nuevo de la versión actual para permitir deshacer el rollback. Úsala si un cambio salió mal.",
    input_schema: {
      type: "object",
      properties: {
        backupRef: {
          type: "string",
          description: "id del snapshot (lo devuelve list_backup_snapshots)",
        },
      },
      required: ["backupRef"],
    },
  },
  {
    name: "regenerate_tenant",
    description:
      "Regeneración idempotente de un tenant por clientId: verifica que existe, inicializa trial y onboarding si faltan, e invalida la caché del dashboard de Factory para que la próxima carga vea los cambios más recientes. Úsala DESPUÉS de haber modificado un vertical (con write_repo_file/patch_repo_file) para cerrar el loop y que los cambios lleguen al ERP del cliente. No crea cuentas nuevas ni borra overrides manuales. El clientId lo obtienes con list_tenants.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "clientId del tenant a regenerar" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "invalidate_factory_cache",
    description:
      "Invalida la caché en memoria del dashboard de Factory. Útil cuando acabas de modificar datos persistidos (estado de cuentas, trial, etc.) y quieres forzar un recalculo inmediato sin pasar por regenerate_tenant. Sin parámetros.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "seed_demo_data",
    description:
      "Materializa la demoData del vertical del tenant en sus ficheros de datos reales (data/saas/<clientId>/<module>.json). Úsala cuando un tenant recién provisionado está vacío y quieres que el cliente vea datos coherentes al entrar. Mode 'merge' (default) añade solo los registros que aún no existen usando un id estable por contenido; mode 'replace' sobreescribe por completo. Si pasas `modules`, se limita a esos moduleKeys; si no, siembra todos los que la demoData defina.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "clientId del tenant" },
        mode: {
          type: "string",
          enum: ["merge", "replace"],
          description: "merge (default) añade solo nuevos; replace sobrescribe",
        },
        modules: {
          type: "array",
          items: { type: "string" },
          description: "opcional: limitar a estos moduleKeys",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "hard_reprovision_tenant",
    description:
      "Provisioning end-to-end de un tenant por clientId. Crea la cuenta admin si falta, asegura trial + onboarding, (opcional) siembra demoData y registra transición access_ready en la state machine. Complementario a regenerate_tenant: la reprovisión dura hace creación, la blanda solo refresca caché. Por defecto preserva el password del admin existente; pasa resetAdminPassword:true SOLO si necesitas emitir nuevas credenciales (destructivo). Pasa seedDemo:'merge' o 'replace' para materializar datos de ejemplo. El temporaryPassword generado en creación o reset se devuelve en la respuesta de la API pero NO se escribe en el audit log (por seguridad) — si hasTemporaryPassword=true avisa al operador de que hay nuevas credenciales y que revise la respuesta HTTP.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "clientId del tenant" },
        resetAdminPassword: {
          type: "boolean",
          description:
            "DESTRUCTIVO: si true y existe admin, regenera su password temporal y le fuerza mustChangePassword",
        },
        seedDemo: {
          type: "string",
          enum: ["merge", "replace"],
          description: "opcional: sembrar demoData del vertical tras el provisioning",
        },
        adminEmail: {
          type: "string",
          description: "opcional: email para el admin creado de cero",
        },
        adminFullName: {
          type: "string",
          description: "opcional: nombre completo para el admin creado de cero",
        },
        reason: {
          type: "string",
          description: "motivo que se grabará en la historia del state machine",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "commit_to_github_pr",
    description:
      "Crea una rama nueva en el repo de GitHub, comitea uno o varios ficheros (whitelist: src/, docs/, scripts/, prisma/schema.prisma) en un único commit, y abre un Pull Request contra `main`. Pensada para flujo serverless (producción Vercel): el chat sí puede modificar el código vía esta tool aunque write_repo_file esté gateada porque el filesystem es read-only. Tras crear el PR Jorge lo revisa y mergea desde GitHub web/móvil; Vercel auto-despliega tras el merge. Siempre devuelve la URL del PR para que el operador lo abra. Cada fichero es un objeto { path, content }. Usa esta tool por defecto en producción para cambios de código; en local prefiere write_repo_file (más rápido, sin PR review). Tamaño máximo: 500 KB por fichero, 2 MB por commit.",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description:
            "Mensaje del commit y título del PR. Debe ser descriptivo y conciso (ej: 'feat(software-factory): añadir módulo incidencias')",
        },
        files: {
          type: "array",
          description:
            "Array de ficheros a crear/sobrescribir. Cada elemento es { path, content }. La operación es 'sobrescribir' (no patch incremental) — para edits parciales pasa el contenido entero del fichero modificado.",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Ruta relativa al repo. Whitelist: src/, docs/, scripts/, prisma/schema.prisma. Sin '..' ni rutas absolutas.",
              },
              content: {
                type: "string",
                description: "Contenido completo del fichero como UTF-8.",
              },
              mode: {
                type: "string",
                enum: ["100644", "100755"],
                description:
                  "Modo Git del fichero. 100644 (default) para regular, 100755 para shell scripts ejecutables.",
              },
            },
            required: ["path", "content"],
          },
        },
        branch: {
          type: "string",
          description:
            "Opcional: nombre de la rama a crear. Default: 'chat/<timestamp>-<random>'. Si la rama existe, el commit se añade encima de su HEAD actual.",
        },
        baseBranch: {
          type: "string",
          description: "Opcional: rama base contra la que abrir el PR. Default: 'main'.",
        },
        prTitle: {
          type: "string",
          description: "Opcional: título del PR. Default: usa `message`.",
        },
        prBody: {
          type: "string",
          description:
            "Opcional: cuerpo del PR. Default: se genera uno con metadata del chat (operador, conversation, ficheros tocados).",
        },
        skipPr: {
          type: "boolean",
          description:
            "Opcional: si true, solo crea rama+commit sin abrir PR. Útil para acumular varios commits en una rama antes de abrir el PR final.",
        },
        draft: {
          type: "boolean",
          description:
            "Opcional: si true, abre el PR como draft (no listo para merge).",
        },
      },
      required: ["message", "files"],
    },
  },
];

/** Conjunto de tools que mutan el repo o el entorno — requieren ToolContext. */
const WRITE_TOOL_NAMES = new Set<string>([
  "write_repo_file",
  "patch_repo_file",
  "run_tsc_check",
  "run_lint_check",
  "restore_backup_snapshot",
  "regenerate_tenant",
  "invalidate_factory_cache",
  "seed_demo_data",
  "hard_reprovision_tenant",
  "commit_to_github_pr",
]);

/** Dispatcher: ejecuta una tool por nombre y devuelve su resultado como string. */
export async function executeTool(
  name: string,
  input: unknown,
  context?: ToolContext,
): Promise<string> {
  try {
    if (WRITE_TOOL_NAMES.has(name) && !context) {
      return errorJson(
        "La tool '" +
          name +
          "' requiere contexto de actor (accountId, email, conversationId). No se ejecuta sin auditoría.",
      );
    }

    switch (name) {
      case "list_tenants": {
        const list = await listTenantClientsIndexAsync();
        return JSON.stringify(
          list.map((t) => ({
            clientId: t.clientId,
            tenantId: t.tenantId,
            slug: t.slug,
            displayName: t.displayName,
          })),
          null,
          2,
        );
      }
      case "read_tenant_detail": {
        const p = input as { clientId?: string };
        if (!p.clientId) return errorJson("Falta clientId.");
        // En modo Postgres usamos un snapshot ligero específico para
        // serverless. En filesystem caemos al detalle completo legacy.
        if (getPersistenceBackend() === "postgres") {
          const snapshot = await getTenantSnapshotAsync(p.clientId);
          return JSON.stringify(snapshot, null, 2);
        }
        const snapshot = getFactoryClientDetail(p.clientId);
        return JSON.stringify(snapshot, null, 2);
      }
      case "list_verticals": {
        const summary = SECTOR_PACKS.map((pack) => ({
          key: pack.key,
          label: pack.label,
          sector: pack.sector,
          businessType: pack.businessType,
          description: pack.description,
          moduleCount: pack.modules.length,
          entityCount: pack.entities.length,
          fieldCount: pack.fields.length,
          demoDataModules: pack.demoData.length,
        }));
        return JSON.stringify(summary, null, 2);
      }
      case "read_vertical": {
        const p = input as { key?: string };
        if (!p.key) return errorJson("Falta key.");
        const pack = getSectorPackByKey(p.key);
        if (!pack) return errorJson("No existe el vertical con key '" + p.key + "'.");
        return JSON.stringify(pack, null, 2);
      }
      case "read_factory_health": {
        // factory-health usa lectura intensiva de filesystem (.prontara/clients/,
        // data/saas/) que no está disponible en serverless. En modo Postgres
        // devolvemos un health derivado de la tabla Tenant.
        if (getPersistenceBackend() === "postgres") {
          const list = await listTenantClientsIndexAsync();
          return JSON.stringify(
            {
              source: "postgres",
              summary: {
                totalTenants: list.length,
                healthyTenants: list.length, // En Postgres no tenemos noción de "tenant corrupto"; todo lo que está en la tabla cuenta como healthy.
                partialTenants: 0,
                corruptTenants: 0,
              },
              tenants: list.map((t) => ({
                clientId: t.clientId,
                slug: t.slug,
                displayName: t.displayName,
                lastUpdatedAt: t.lastUpdatedAt,
              })),
              notes: [
                "read_factory_health en producción serverless lee solo de Postgres. Las métricas de filesystem (artifacts, evolution-state) no están disponibles.",
              ],
            },
            null,
            2,
          );
        }
        const health = getFactoryHealthSnapshot();
        return JSON.stringify(health, null, 2);
      }
      case "read_repo_file": {
        if (!isCodeModeAvailable()) {
          return errorJson(
            "read_repo_file solo está disponible cuando el chat corre en local con acceso al repo (pnpm dev). En producción serverless no hay fuente del repo accesible.",
          );
        }
        const p = input as { path?: string; byteOffset?: number; byteLimit?: number };
        if (!p.path) return errorJson("Falta path.");
        if (!isPathSafe(p.path)) {
          return errorJson(
            "Ruta no permitida. Solo se pueden leer archivos dentro de: " +
              READ_WHITELIST.join(", "),
          );
        }
        const abs = path.join(process.cwd(), p.path);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          return errorJson("El archivo no existe o no es un archivo.");
        }
        const offset = Math.max(0, p.byteOffset || 0);
        const limit = Math.max(1, Math.min(p.byteLimit || 8_000, 80_000));
        const buffer = fs.readFileSync(abs);
        const slice = buffer.slice(offset, offset + limit);
        return JSON.stringify(
          {
            path: p.path,
            totalSize: buffer.byteLength,
            offset,
            returnedBytes: slice.byteLength,
            content: slice.toString("utf8"),
          },
          null,
          2,
        );
      }
      case "search_codebase": {
        if (!isCodeModeAvailable()) {
          return errorJson(
            "search_codebase solo está disponible en local con acceso al repo. En producción serverless el código fuente no está en el bundle desplegado.",
          );
        }
        const p = input as { query?: string; limit?: number; pathFilter?: string };
        const result = searchCodebase({
          query: p.query || "",
          limit: p.limit,
          pathFilter: p.pathFilter,
        });
        return JSON.stringify(result, null, 2);
      }
      case "list_repo_files": {
        if (!isCodeModeAvailable()) {
          return errorJson(
            "list_repo_files solo está disponible en local con acceso al repo. En producción serverless no hay fuente del repo accesible.",
          );
        }
        const p = input as { path?: string };
        const rel = p.path || ".";
        if (!isPathSafe(rel === "." ? "src/" : rel)) {
          return errorJson(
            "Ruta no permitida. Solo se pueden listar directorios dentro de: " +
              READ_WHITELIST.join(", "),
          );
        }
        const abs = path.join(process.cwd(), rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
          return errorJson("El directorio no existe.");
        }
        const entries = fs.readdirSync(abs, { withFileTypes: true });
        const list = entries.map((e) => {
          const sub = path.join(abs, e.name);
          const isFile = e.isFile();
          return {
            name: e.name,
            type: e.isDirectory() ? "dir" : isFile ? "file" : "other",
            size: isFile ? fs.statSync(sub).size : null,
          };
        });
        return JSON.stringify({ path: rel, entries: list }, null, 2);
      }
      // ---- FASE 2: write tools ----
      case "write_repo_file": {
        const result = await writeRepoFileTool(
          input as { path?: string; content?: string },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      case "patch_repo_file": {
        const result = await patchRepoFileTool(
          input as {
            path?: string;
            oldString?: string;
            newString?: string;
            replaceAll?: boolean;
          },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      case "run_tsc_check": {
        const result = await runTscCheckTool({}, context!);
        return JSON.stringify(result, null, 2);
      }
      case "run_lint_check": {
        const result = await runLintCheckTool(input as { paths?: string[] }, context!);
        return JSON.stringify(result, null, 2);
      }
      case "read_audit_log": {
        const result = await readAuditLogTool(
          input as { limit?: number; tool?: string; conversationId?: string },
        );
        return JSON.stringify(result, null, 2);
      }
      case "list_backup_snapshots": {
        const result = listBackupSnapshotsTool(input as { limit?: number });
        return JSON.stringify(result, null, 2);
      }
      case "restore_backup_snapshot": {
        const result = await restoreBackupSnapshotTool(
          input as { backupRef?: string },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      case "regenerate_tenant": {
        const result = await regenerateTenantTool(input as { clientId?: string }, context!);
        return JSON.stringify(result, null, 2);
      }
      case "invalidate_factory_cache": {
        const result = await invalidateFactoryCacheTool({}, context!);
        return JSON.stringify(result, null, 2);
      }
      case "seed_demo_data": {
        const result = await seedDemoDataTool(
          input as { clientId?: string; mode?: "merge" | "replace"; modules?: string[] },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      case "hard_reprovision_tenant": {
        const result = await hardReprovisionTenantTool(
          input as {
            clientId?: string;
            resetAdminPassword?: boolean;
            seedDemo?: "merge" | "replace";
            adminEmail?: string;
            adminFullName?: string;
            reason?: string;
          },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      case "commit_to_github_pr": {
        const result = await commitToGitHubPrTool(
          input as {
            branch?: string;
            baseBranch?: string;
            files?: Array<{
              path?: string;
              content?: string;
              mode?: "100644" | "100755";
            }>;
            message?: string;
            prTitle?: string;
            prBody?: string;
            skipPr?: boolean;
            draft?: boolean;
          },
          context!,
        );
        return JSON.stringify(result, null, 2);
      }
      default:
        return errorJson("Tool desconocida: " + name);
    }
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : "Error ejecutando tool.");
  }
}

function errorJson(message: string): string {
  return JSON.stringify({ error: message }, null, 2);
}
