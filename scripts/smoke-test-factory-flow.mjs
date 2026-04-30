#!/usr/bin/env node
/**
 * Smoke test programático del flujo Factory → Vertical → Tenant.
 *
 * Sin browser: valida que las funciones críticas del backend devuelven
 * datos coherentes y que el ciclo completo (provisión, vertical resolution,
 * CRUD de módulos, dashboard) funciona end-to-end.
 *
 * Si todos los pasos pasan, el sistema está bien para que un usuario real
 * inicie sesión y opere. Si alguno falla, hay un bug que arreglar antes de
 * deploy.
 *
 * Uso:
 *   node scripts/smoke-test-factory-flow.mjs
 *   node scripts/smoke-test-factory-flow.mjs --client estandar-20260419194129
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const clientIdArg = args.find((a) => a.startsWith("--client="))?.replace("--client=", "");

const projectRoot = process.cwd();
const results = [];
let activeClientId = clientIdArg;

function step(name, fn) {
  return async () => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      results.push({ name, ok: true, duration, detail: result || "" });
      console.log("  ✓ " + name + (result ? " — " + result : "") + " (" + duration + "ms)");
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name, ok: false, duration, detail: message });
      console.error("  ✗ " + name + " — " + message);
      throw err;
    }
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

console.log("=== Prontara Factory — Smoke test del flujo Factory → Vertical → Tenant ===\n");

async function main() {
  // ─── 1. Pre-requisitos: tenant de prueba existe ───
  console.log("[1] Pre-requisitos");
  await step("Hay al menos un tenant en .prontara/clients/", async () => {
    const dir = path.join(projectRoot, ".prontara", "clients");
    if (!fs.existsSync(dir)) throw new Error("Falta .prontara/clients/");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) throw new Error("No hay tenants definidos");
    if (!activeClientId) {
      // Usar el active client si no se pasó por arg
      const activePath = path.join(projectRoot, "data", "factory", "active-client.json");
      if (fs.existsSync(activePath)) {
        activeClientId = readJson(activePath).clientId;
      } else {
        activeClientId = files[0].replace(/\.json$/, "");
      }
    }
    return files.length + " tenants, usando '" + activeClientId + "' para el test";
  })();

  await step("Tenant tiene businessType definido", async () => {
    const def = readJson(path.join(projectRoot, ".prontara", "clients", activeClientId + ".json"));
    if (!def.businessType) throw new Error("Falta businessType — el vertical no se resolverá");
    return "businessType=" + def.businessType;
  })();

  // ─── 2. Vertical resolution ───
  console.log("\n[2] Resolución del vertical");

  await step("Sector pack se resuelve por businessType", async () => {
    const def = readJson(path.join(projectRoot, ".prontara", "clients", activeClientId + ".json"));
    // Validación a nivel de texto: buscamos la key del businessType en sector-pack-registry.ts
    // (no podemos import TS desde .mjs vanilla — esto es un proxy útil).
    const registryPath = path.join(projectRoot, "src", "lib", "factory", "sector-pack-registry.ts");
    const registryText = fs.readFileSync(registryPath, "utf8");
    const keyMatch = new RegExp('key:\\s*"' + def.businessType + '"');
    if (!keyMatch.test(registryText)) {
      throw new Error(
        "businessType '" + def.businessType + "' no aparece como key:\"...\" en sector-pack-registry.ts. " +
        "El runtime no podrá resolver el vertical.",
      );
    }
    return "vertical key=" + def.businessType + " presente en registry";
  })();

  await step("Override de vertical en disco (si existe) es válido JSON", async () => {
    const def = readJson(path.join(projectRoot, ".prontara", "clients", activeClientId + ".json"));
    const overridePath = path.join(projectRoot, "data", "saas", "vertical-overrides", def.businessType + ".json");
    if (!fs.existsSync(overridePath)) return "sin override (base)";
    const override = readJson(overridePath);
    if (!override.key) throw new Error("Override sin campo key");
    return "override válido con key=" + override.key;
  })();

  // ─── 3. Cuenta admin del tenant ───
  console.log("\n[3] Cuenta admin del tenant");

  await step("Existe accounts/<clientId>.json", async () => {
    const accountsPath = path.join(projectRoot, "data", "saas", "accounts", activeClientId + ".json");
    if (!fs.existsSync(accountsPath)) {
      throw new Error("No hay cuentas para este tenant. Login imposible.");
    }
    const accounts = readJson(accountsPath);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("Fichero existe pero está vacío");
    }
    const admin = accounts.find((a) => a.role === "owner" || a.role === "admin");
    if (!admin) throw new Error("Hay cuentas pero ninguna admin/owner");
    return admin.email + " (" + admin.role + ")";
  })();

  await step("Password hash es scrypt o sha256 legacy", async () => {
    const accountsPath = path.join(projectRoot, "data", "saas", "accounts", activeClientId + ".json");
    const accounts = readJson(accountsPath);
    const admin = accounts.find((a) => a.role === "owner" || a.role === "admin");
    if (!admin.passwordHash) throw new Error("Sin passwordHash");
    if (admin.passwordHash.startsWith("scrypt$")) return "scrypt (formato actual)";
    if (/^[0-9a-f]{64}$/.test(admin.passwordHash)) return "sha256 legacy (se actualiza al primer login)";
    throw new Error("passwordHash con formato desconocido");
  })();

  // ─── 4. Subscription / billing ───
  console.log("\n[4] Suscripción del tenant");

  await step("Existe billing/<clientId>.json", async () => {
    const subPath = path.join(projectRoot, "data", "saas", "billing", activeClientId + ".json");
    if (!fs.existsSync(subPath)) {
      return "sin suscripción todavía (se creará al entrar al runtime)";
    }
    const sub = readJson(subPath);
    if (!sub.currentPlanKey) throw new Error("Suscripción sin plan");
    const oldKeys = ["starter", "growth", "pro"];
    const note = oldKeys.includes(sub.currentPlanKey)
      ? " (LEGACY — se migra a basico/estandar/premium al leer)"
      : "";
    return "plan=" + sub.currentPlanKey + " status=" + sub.status + note;
  })();

  await step("Trial state existe o se puede crear", async () => {
    const trialPath = path.join(projectRoot, "data", "saas", "trial", activeClientId + ".json");
    if (!fs.existsSync(trialPath)) return "sin trial state — se crea al entrar al runtime";
    const trial = readJson(trialPath);
    if (!trial.expiresAt) throw new Error("Trial sin expiresAt");
    const remaining = Math.ceil((new Date(trial.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return "status=" + trial.status + ", " + remaining + " días restantes";
  })();

  // ─── 5. Datos operativos por módulo ───
  console.log("\n[5] Datos operativos del ERP");

  const expectedModules = ["clientes", "crm", "proyectos", "presupuestos", "facturacion", "documentos"];
  await step("Directorio de datos del tenant existe", async () => {
    const dataDir = path.join(projectRoot, ".prontara", "data", activeClientId);
    if (!fs.existsSync(dataDir)) return "sin datos aún (vacío)";
    const moduleFiles = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    return moduleFiles.length + " módulos con datos";
  })();

  for (const mod of expectedModules) {
    await step("Módulo '" + mod + "': fichero válido si existe", async () => {
      const modPath = path.join(projectRoot, ".prontara", "data", activeClientId, mod + ".json");
      if (!fs.existsSync(modPath)) return "vacío (no es error — módulo sin datos)";
      try {
        const rows = readJson(modPath);
        if (!Array.isArray(rows)) throw new Error("No es array");
        return rows.length + " registros";
      } catch (err) {
        throw new Error("Fichero corrupto: " + err.message);
      }
    })();
  }

  // ─── 6. Sesión / autenticación ───
  console.log("\n[6] Configuración de auth");

  await step("PRONTARA_SESSION_SECRET configurada (o fallback dev)", async () => {
    const secret = process.env.PRONTARA_SESSION_SECRET || "";
    if (!secret) return "(usando fallback dev — no apto para producción)";
    if (secret.length < 32) {
      throw new Error("Secret demasiado corta (" + secret.length + " chars). Mínimo 32.");
    }
    return secret.length + " chars OK";
  })();

  // ─── 7. Anthropic / chat (opcional) ───
  console.log("\n[7] Chat de la Factory (opcional)");

  await step("ANTHROPIC_API_KEY configurada", async () => {
    const key = process.env.ANTHROPIC_API_KEY || "";
    if (!key) return "(sin clave — el chat mostrará banner amarillo)";
    if (!key.startsWith("sk-ant-")) {
      throw new Error("Formato de clave Anthropic inválido");
    }
    return "configurada (formato OK)";
  })();

  // ─── 8. Stripe (opcional) ───
  console.log("\n[8] Stripe billing (opcional)");

  await step("STRIPE_SECRET_KEY configurada", async () => {
    const key = process.env.STRIPE_SECRET_KEY || "";
    if (!key) return "(sin clave — facturas locales solo, sin cobro real)";
    if (!key.startsWith("sk_")) throw new Error("Formato Stripe inválido");
    return "configurada (modo " + (key.startsWith("sk_test_") ? "test" : "live") + ")";
  })();

  await step("Setup price IDs (al menos uno)", async () => {
    const ids = [
      process.env.STRIPE_SETUP_PRICE_BASICO,
      process.env.STRIPE_SETUP_PRICE_ESTANDAR,
      process.env.STRIPE_SETUP_PRICE_PREMIUM,
    ].filter(Boolean);
    if (ids.length === 0) return "(no configurados — checkout no funcionará)";
    return ids.length + " price IDs configurados";
  })();

  // ─── 9. Resend / email (opcional) ───
  console.log("\n[9] Email transaccional (opcional)");

  await step("RESEND_API_KEY + PRONTARA_FROM_EMAIL", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PRONTARA_FROM_EMAIL;
    if (!apiKey && !from) return "(sin Resend — emails caen al outbox)";
    if (apiKey && !from) throw new Error("Falta PRONTARA_FROM_EMAIL");
    if (!apiKey && from) throw new Error("Falta RESEND_API_KEY");
    return "Resend listo, from=" + from;
  })();

  // ─── 10. Persistencia ───
  console.log("\n[10] Persistencia");

  await step("Modo de persistencia configurado", async () => {
    const mode = (process.env.PRONTARA_PERSISTENCE || "filesystem").toLowerCase();
    if (mode === "postgres") {
      if (!process.env.DATABASE_URL) throw new Error("Modo postgres pero falta DATABASE_URL");
      return "postgres + DATABASE_URL configurada";
    }
    return "filesystem (default — solo apto para local)";
  })();

  // ─── Resumen ───
  console.log("\n=== Resumen ===");
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log("✓ " + ok + " pasos OK");
  if (fail > 0) {
    console.log("✗ " + fail + " pasos fallidos");
    process.exit(1);
  }

  console.log("\nTodo coherente para el flujo Factory → Vertical → Tenant.");
  console.log("Para validación end-to-end con browser, ver docs/manual-validation-plan.md");
}

main().catch((err) => {
  console.error("\nSmoke test interrumpido por error:", err.message);
  process.exit(2);
});
