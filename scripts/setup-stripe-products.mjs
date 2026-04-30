#!/usr/bin/env node
/**
 * Crea automáticamente los productos y prices de Prontara en Stripe.
 *
 * Crea:
 *   - "Prontara Básico - Alta"     · one-time 590 EUR
 *   - "Prontara Estándar - Alta"   · one-time 990 EUR
 *   - "Prontara Premium - Alta"    · one-time 1490 EUR
 *   - "Prontara Soporte"           · recurring monthly per-unit 12 EUR
 *
 * Es idempotente: si encuentra un producto con el mismo metadata.prontaraKey
 * lo reutiliza en vez de duplicar. Igual con los prices: si ya existe uno
 * con el mismo amount + interval lo deja como está.
 *
 * Variables de entorno necesarias:
 *   STRIPE_SECRET_KEY   sk_test_... o sk_live_... (de Stripe Dashboard)
 *
 * Uso:
 *   $env:STRIPE_SECRET_KEY = "sk_test_..."
 *   node scripts/setup-stripe-products.mjs
 *
 * O para modo dry-run (no crea nada, solo muestra qué haría):
 *   node scripts/setup-stripe-products.mjs --dry-run
 *
 * Al final imprime las líneas que tienes que pegar en .env.
 */

const STRIPE_API = "https://api.stripe.com/v1";

const PRODUCTS = [
  {
    prontaraKey: "setup-basico",
    name: "Prontara Básico - Alta",
    description: "Pago único de alta del plan Básico de Prontara.",
    envVar: "STRIPE_SETUP_PRICE_BASICO",
    price: { unit_amount: 59000, currency: "eur", type: "one_time" },
  },
  {
    prontaraKey: "setup-estandar",
    name: "Prontara Estándar - Alta",
    description: "Pago único de alta del plan Estándar de Prontara.",
    envVar: "STRIPE_SETUP_PRICE_ESTANDAR",
    price: { unit_amount: 99000, currency: "eur", type: "one_time" },
  },
  {
    prontaraKey: "setup-premium",
    name: "Prontara Premium - Alta",
    description: "Pago único de alta del plan Premium de Prontara.",
    envVar: "STRIPE_SETUP_PRICE_PREMIUM",
    price: { unit_amount: 149000, currency: "eur", type: "one_time" },
  },
  {
    prontaraKey: "support-monthly",
    name: "Prontara Soporte",
    description: "Soporte mensual: 12 € por usuario concurrente.",
    envVar: "STRIPE_SUPPORT_PRICE",
    price: {
      unit_amount: 1200,
      currency: "eur",
      type: "recurring",
      recurring: { interval: "month", usage_type: "licensed" },
    },
  },
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SECRET = process.env.STRIPE_SECRET_KEY;

if (!SECRET) {
  console.error("ERROR: Falta STRIPE_SECRET_KEY en el entorno.");
  console.error("PowerShell: $env:STRIPE_SECRET_KEY = \"sk_test_...\"");
  process.exit(1);
}

function fmt(obj) {
  const params = new URLSearchParams();
  function append(key, value) {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => append(key + "[" + i + "]", v));
    } else if (typeof value === "object") {
      for (const k of Object.keys(value)) append(key + "[" + k + "]", value[k]);
    } else {
      params.append(key, String(value));
    }
  }
  for (const k of Object.keys(obj)) append(k, obj[k]);
  return params.toString();
}

async function stripeRequest(method, path, body) {
  const url = STRIPE_API + path;
  const init = {
    method,
    headers: {
      Authorization: "Bearer " + SECRET,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = fmt(body);

  const res = await fetch(url, init);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Stripe " + res.status + " en " + path + ": " + txt);
  }
  return res.json();
}

async function findProductByMetadataKey(prontaraKey) {
  // Stripe no permite filtrar productos por metadata directamente; usamos
  // el listado paginado. Para una cuenta de Prontara siempre serán pocos.
  const data = await stripeRequest("GET", "/products?limit=100&active=true");
  return (data.data || []).find(
    (p) => p.metadata && p.metadata.prontaraKey === prontaraKey,
  );
}

async function findPriceForProduct(productId, expected) {
  const data = await stripeRequest("GET", "/prices?product=" + encodeURIComponent(productId) + "&active=true&limit=20");
  return (data.data || []).find((p) => {
    if (p.unit_amount !== expected.unit_amount) return false;
    if (p.currency !== expected.currency) return false;
    if (expected.type === "recurring") {
      return p.type === "recurring" && p.recurring?.interval === expected.recurring.interval;
    }
    return p.type === "one_time";
  });
}

async function ensureProductAndPrice(spec) {
  console.log("\n[" + spec.prontaraKey + "] " + spec.name);

  let product = await findProductByMetadataKey(spec.prontaraKey);
  if (product) {
    console.log("  ↪ Producto ya existe: " + product.id);
  } else if (DRY_RUN) {
    console.log("  ↪ (dry-run) crearía producto");
    return { envVar: spec.envVar, priceId: "price_DRY_RUN_" + spec.prontaraKey };
  } else {
    product = await stripeRequest("POST", "/products", {
      name: spec.name,
      description: spec.description,
      metadata: { prontaraKey: spec.prontaraKey },
    });
    console.log("  ✓ Producto creado: " + product.id);
  }

  const existingPrice = await findPriceForProduct(product.id, spec.price);
  if (existingPrice) {
    console.log("  ↪ Price ya existe: " + existingPrice.id);
    return { envVar: spec.envVar, priceId: existingPrice.id };
  }
  if (DRY_RUN) {
    console.log("  ↪ (dry-run) crearía price " + spec.price.unit_amount / 100 + " " + spec.price.currency);
    return { envVar: spec.envVar, priceId: "price_DRY_RUN_" + spec.prontaraKey };
  }
  const priceBody = {
    product: product.id,
    unit_amount: spec.price.unit_amount,
    currency: spec.price.currency,
  };
  if (spec.price.type === "recurring") {
    priceBody.recurring = spec.price.recurring;
  }
  const price = await stripeRequest("POST", "/prices", priceBody);
  console.log("  ✓ Price creado: " + price.id);
  return { envVar: spec.envVar, priceId: price.id };
}

async function main() {
  console.log(DRY_RUN ? "Modo dry-run — no se crea nada en Stripe" : "Creando/actualizando productos en Stripe…");
  const results = [];
  for (const spec of PRODUCTS) {
    try {
      results.push(await ensureProductAndPrice(spec));
    } catch (err) {
      console.error("  ✗ Error: " + (err instanceof Error ? err.message : "desconocido"));
      process.exit(2);
    }
  }

  console.log("\n────────────────────────────────────────────────────────");
  console.log("Pega estas líneas en tu .env (sustituyen las que tengas):");
  console.log("────────────────────────────────────────────────────────");
  for (const r of results) {
    console.log(r.envVar + "=" + r.priceId);
  }
  console.log("────────────────────────────────────────────────────────");
  console.log("\nRecuerda añadir también:");
  console.log("  STRIPE_SECRET_KEY=" + SECRET.slice(0, 8) + "... (la que ya tienes)");
  console.log("  STRIPE_WEBHOOK_SECRET=whsec_... (de https://dashboard.stripe.com/webhooks)");
  console.log("  APP_BASE_URL=https://app.tudominio.com (o http://localhost:3000 en local)");
  console.log("\nLuego reinicia pnpm dev.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
