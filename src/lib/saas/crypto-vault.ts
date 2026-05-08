/**
 * Cifrado simétrico AES-256-GCM para secretos sensibles en BD (H1-SEC-01).
 *
 * Casos de uso:
 *   - TenantAccountMfa.secret (Base32 TOTP — descifrarlo da acceso a 2FA)
 *   - VerifactuSubmission.xmlPayload + csvHuella (datos fiscales)
 *
 * Diseño:
 *   - Algoritmo: AES-256-GCM (autenticado, IV de 96 bits, tag de 128 bits).
 *   - Clave maestra: derivada de `PRONTARA_SESSION_SECRET` con scrypt y salt
 *     fijo `"prontara-vault-v1"`. Si rotamos el secret, los blobs viejos
 *     dejan de descifrarse — eso es lo correcto, no queremos descifrar
 *     datos firmados con una clave revocada.
 *   - Formato del blob: `"v1:" + ivBase64 + ":" + ciphertextBase64 + ":" + tagBase64`
 *   - Compatibilidad legacy: si pasamos un string que NO empieza por `"v1:"`,
 *     `decryptString` lo devuelve tal cual. Eso permite migrar datos en BD
 *     poco a poco — los registros viejos siguen leyéndose en plaintext
 *     hasta que el siguiente save los recifre.
 *
 * NO usar para datos donde la pérdida del secret deba ser tolerable
 * (passwords de usuario van con scrypt, no aquí). Esto es para secretos
 * que SÍ debemos poder leer en runtime.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits — recomendado para GCM
const KEY_BYTES = 32; // 256 bits
const VAULT_SALT = "prontara-vault-v1";
const PREFIX = "v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.PRONTARA_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "crypto-vault: PRONTARA_SESSION_SECRET no está definido o es demasiado corto (>=16 chars).",
    );
  }
  cachedKey = scryptSync(secret, VAULT_SALT, KEY_BYTES);
  return cachedKey;
}

/**
 * Cifra un string. Devuelve un blob serializable. Si `plaintext` está
 * vacío, devuelve el string vacío (no tiene sentido cifrar algo vacío).
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString("base64") + ":" + enc.toString("base64") + ":" + tag.toString("base64");
}

/**
 * Descifra un blob producido por `encryptString`. Si `blob` no empieza
 * por el prefijo `"v1:"`, lo devuelve tal cual — soporta lectura de
 * datos legacy en plaintext durante la migración.
 *
 * Lanza si el blob está malformado o el authTag no valida (significa
 * que la clave no coincide o los datos fueron alterados).
 */
export function decryptString(blob: string): string {
  if (!blob) return "";
  if (!blob.startsWith(PREFIX)) return blob; // legacy plaintext
  const parts = blob.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("crypto-vault: blob malformado.");
  }
  const [ivB64, encB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * Helper: cifra solo si el valor parece ya plaintext (sin prefijo).
 * Idempotente — útil en migraciones que se ejecutan varias veces.
 */
export function ensureEncrypted(value: string): string {
  if (!value) return "";
  if (value.startsWith(PREFIX)) return value;
  return encryptString(value);
}

/**
 * ¿El blob ya está cifrado?
 */
export function isEncrypted(value: string): boolean {
  return !!value && value.startsWith(PREFIX);
}
