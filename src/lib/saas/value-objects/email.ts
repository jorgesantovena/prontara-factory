/**
 * Email · value object.
 *
 * Garantías:
 *   - String no vacío.
 *   - Tiene exactamente un `@` con texto a ambos lados.
 *   - El dominio tiene al menos un `.` con texto a ambos lados.
 *   - Normalizado a lowercase y sin whitespace al borde.
 *
 * NO valida MX records ni hace network. Es una validación sintáctica.
 * Para la validación real (que el email existe), confiamos en el envío
 * de un email de confirmación (token first-access en ARQ-5).
 */
declare const EmailBrand: unique symbol;
export type Email = string & { readonly [EmailBrand]: true };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parsea y normaliza un email crudo. Devuelve null si no es válido.
 */
export function parseEmail(raw: unknown): Email | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!EMAIL_REGEX.test(trimmed)) return null;
  if (trimmed.length > 254) return null; // RFC 5321
  return trimmed as Email;
}

/**
 * Variante que LANZA si no es válido. Útil cuando el input ya pasó por
 * otra capa de validación o cuando un email inválido es bug, no error
 * de usuario.
 */
export function parseEmailOrThrow(raw: unknown): Email {
  const parsed = parseEmail(raw);
  if (!parsed) {
    throw new Error("Email inválido: " + JSON.stringify(raw));
  }
  return parsed;
}

/**
 * Cast sin validación. Usar SOLO con valores ya validados (ej: leídos
 * de la DB que ya los validó al insertar).
 */
export function unsafeEmail(value: string): Email {
  return value as Email;
}
