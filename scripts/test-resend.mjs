/**
 * Smoke test de Resend.
 *
 * Lee RESEND_API_KEY y PRONTARA_FROM_EMAIL del .env y manda un email
 * de prueba a la dirección que pases por argumento (o jorge.santovena@gmail.com
 * por defecto).
 *
 * Uso:
 *   node scripts/test-resend.mjs                          # default destinatario
 *   node scripts/test-resend.mjs otro@email.com           # destinatario custom
 *
 * Si Resend acepta el envío imprime el ID del email. Si rechaza, imprime
 * el motivo (lo más típico: dominio no verificado, API key revocada,
 * from address con dominio no permitido).
 */
import fs from "node:fs";
import path from "node:path";

// Mini parser de .env (sin depender de dotenv).
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
    // Quita comillas envolventes si las hay
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

const apiKey = String(process.env.RESEND_API_KEY || "").trim();
const fromEmail = String(process.env.PRONTARA_FROM_EMAIL || "").trim();
const to = process.argv[2] || "jorge.santovena@gmail.com";

if (!apiKey) {
  console.error("❌ Falta RESEND_API_KEY en .env");
  process.exit(1);
}
if (!fromEmail) {
  console.error("❌ Falta PRONTARA_FROM_EMAIL en .env");
  process.exit(1);
}

console.log("→ Enviando email de prueba…");
console.log("  From:", fromEmail);
console.log("  To:  ", to);

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: fromEmail,
    to: [to],
    subject: "Prueba Prontara · Resend funciona ✅",
    text:
      "Si recibes este mensaje en tu bandeja, la integración Resend + DNS + dominio prontara.com está operativa.\n\n" +
      "Próximo paso: configurar Stripe live, deploy en Vercel y dominio app.prontara.com.\n\n" +
      "Enviado desde el smoke test de scripts/test-resend.mjs.",
  }),
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error("❌ Resend rechazó el envío:");
  console.error("   status:", response.status);
  console.error("   body:  ", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("✅ Email aceptado por Resend.");
console.log("   id:", data.id);
console.log("\nMira tu bandeja en", to, "(puede tardar 30s en llegar).");
console.log("Si no aparece, revisa también la carpeta de spam.");
