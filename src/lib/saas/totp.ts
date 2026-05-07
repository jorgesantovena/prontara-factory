/**
 * TOTP (RFC 6238) puro Node — sin dependencias externas (DEV-MFA).
 *
 * Implementación mínima de Time-based One-Time Password compatible con
 * Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.
 *
 *   - Algoritmo: HMAC-SHA1 (estándar de facto, todas las apps lo soportan)
 *   - Período: 30 segundos
 *   - Dígitos: 6
 *   - Tolerancia: ventana ±1 (acepta código del periodo anterior y siguiente)
 */

import { createHmac, randomBytes } from "node:crypto";

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // acepta código actual + previo + siguiente

/**
 * Genera un secret aleatorio de 20 bytes (160 bits) y lo codifica en
 * Base32 — formato esperado por las apps autenticadoras.
 */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Construye la URL otpauth:// que se mete en el QR para que el usuario
 * la escanee con su app autenticadora.
 */
export function buildOtpAuthUrl(
  secretBase32: string,
  accountLabel: string,
  issuer: string,
): string {
  const enc = (s: string) => encodeURIComponent(s);
  return (
    "otpauth://totp/" +
    enc(issuer + ":" + accountLabel) +
    "?secret=" +
    secretBase32 +
    "&issuer=" +
    enc(issuer) +
    "&algorithm=SHA1&digits=" +
    DIGITS +
    "&period=" +
    PERIOD_SECONDS
  );
}

/**
 * Verifica un código TOTP de 6 dígitos contra el secret. Acepta ventana
 * de ±1 periodo para tolerar drift de reloj. Devuelve true si coincide.
 */
export function verifyTotpCode(secretBase32: string, codeInput: string): boolean {
  const code = String(codeInput || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  if (secret.length === 0) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const expected = computeTotp(secret, counter + offset);
    if (expected === code) return true;
  }
  return false;
}

/**
 * Calcula el TOTP para un counter dado (HOTP truncado a 6 dígitos).
 */
function computeTotp(secret: Buffer, counter: number): string {
  // Counter como Buffer big-endian de 8 bytes
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  // Truncamiento dinámico (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binCode % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, "0");
}

// =====================================================================
// Base32 codec mínimo (RFC 4648)
// =====================================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/\s/g, "").replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) return Buffer.alloc(0);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Genera 8 códigos de respaldo (16 chars cada uno) para usar si el
 * usuario pierde acceso a su app autenticadora. Cada código es de un
 * solo uso — el endpoint de login los marca consumed.
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let code = "";
    for (let j = 0; j < bytes.length; j++) {
      code += bytes[j].toString(16).padStart(2, "0");
    }
    // Format XXXX-XXXX-XXXX-XXXX
    codes.push(
      code.toUpperCase().match(/.{4}/g)?.join("-") || code.toUpperCase(),
    );
  }
  return codes;
}
