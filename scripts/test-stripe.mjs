/**
 * Smoke test de Stripe.
 *
 * Verifica que las 4 env vars de Stripe están correctas:
 *   - STRIPE_SECRET_KEY (sk_live_... o sk_test_...)
 *   - STRIPE_SETUP_PRICE_BASICO (price_...)
 *   - STRIPE_SETUP_PRICE_ESTANDAR (price_...)
 *   - STRIPE_SETUP_PRICE_PREMIUM (price_...)
 *
 * NO cobra nada. Solo hace lecturas (GET /v1/balance, GET /v1/prices/{id}).
 *
 * Uso:
 *   node scripts/test-stripe.mjs
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const sk = String(process.env.STRIPE_SECRET_KEY || "").trim();
const priceBasico = String(process.env.STRIPE_SETUP_PRICE_BASICO || "").trim();
const priceEstandar = String(process.env.STRIPE_SETUP_PRICE_ESTANDAR || "").trim();
const pricePremium = String(process.env.STRIPE_SETUP_PRICE_PREMIUM || "").trim();

let failures = 0;

function fail(msg) {
  console.error("❌ " + msg);
  failures += 1;
}

function ok(msg) {
  console.log("✅ " + msg);
}

if (!sk) fail("Falta STRIPE_SECRET_KEY en .env");
if (!priceBasico) fail("Falta STRIPE_SETUP_PRICE_BASICO en .env");
if (!priceEstandar) fail("Falta STRIPE_SETUP_PRICE_ESTANDAR en .env");
if (!pricePremium) fail("Falta STRIPE_SETUP_PRICE_PREMIUM en .env");

if (failures > 0) process.exit(1);

const isLive = sk.startsWith("sk_live_");
const isTest = sk.startsWith("sk_test_");
console.log("→ Modo:", isLive ? "LIVE 🟢" : isTest ? "TEST 🟡" : "DESCONOCIDO ⚠️");
console.log("→ Verificando 4 vars contra Stripe API...\n");

async function stripeGet(path) {
  const response = await fetch("https://api.stripe.com" + path, {
    method: "GET",
    headers: { Authorization: "Bearer " + sk },
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

// 1. Balance — valida la clave secreta
{
  const r = await stripeGet("/v1/balance");
  if (!r.ok) {
    fail(
      "STRIPE_SECRET_KEY rechazada. Status " +
        r.status +
        ": " +
        (r.data?.error?.message || "sin mensaje"),
    );
  } else {
    const available = (r.data.available || []).map((b) => (b.amount / 100).toFixed(2) + " " + b.currency.toUpperCase()).join(", ") || "0,00 EUR";
    ok("STRIPE_SECRET_KEY válida. Saldo disponible: " + available);
  }
}

// 2. Cada price ID
async function checkPrice(name, priceId) {
  const r = await stripeGet("/v1/prices/" + encodeURIComponent(priceId));
  if (!r.ok) {
    fail(
      name + " (" + priceId + ") rechazado. Status " + r.status + ": " +
        (r.data?.error?.message || "sin mensaje"),
    );
    return;
  }
  const amount = ((r.data.unit_amount || 0) / 100).toFixed(2);
  const currency = String(r.data.currency || "").toUpperCase();
  const productId = String(r.data.product || "");
  ok(name + ": " + amount + " " + currency + " (product " + productId + ")");
}

await checkPrice("STRIPE_SETUP_PRICE_BASICO", priceBasico);
await checkPrice("STRIPE_SETUP_PRICE_ESTANDAR", priceEstandar);
await checkPrice("STRIPE_SETUP_PRICE_PREMIUM", pricePremium);

console.log("");
if (failures > 0) {
  console.log("⚠️  " + failures + " checks fallaron. Revisa el .env.");
  process.exit(1);
}

console.log("🎉 Stripe configurado correctamente.");
console.log("   Próximo paso: configurar STRIPE_WEBHOOK_SECRET tras crear el endpoint en Vercel.");
