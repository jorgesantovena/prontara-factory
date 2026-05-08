/**
 * Política de contraseñas (H2-PWD).
 *
 * Validador único usado en todos los flujos de creación / cambio de
 * contraseña. Configuración por env vars con defaults razonables para
 * un SaaS B2B.
 */

export type PasswordPolicy = {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
};

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 10,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false, // por defecto false — los símbolos en passwords causan más fricción que valor
};

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function readEnvBool(name: string, fallback: boolean): boolean {
  const raw = (process.env[name] || "").toLowerCase().trim();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

export function getPasswordPolicy(): PasswordPolicy {
  return {
    minLength: readEnvNumber("PRONTARA_PWD_MIN", DEFAULT_POLICY.minLength),
    maxLength: readEnvNumber("PRONTARA_PWD_MAX", DEFAULT_POLICY.maxLength),
    requireUppercase: readEnvBool("PRONTARA_PWD_UPPER", DEFAULT_POLICY.requireUppercase),
    requireLowercase: readEnvBool("PRONTARA_PWD_LOWER", DEFAULT_POLICY.requireLowercase),
    requireNumber: readEnvBool("PRONTARA_PWD_NUMBER", DEFAULT_POLICY.requireNumber),
    requireSymbol: readEnvBool("PRONTARA_PWD_SYMBOL", DEFAULT_POLICY.requireSymbol),
  };
}

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validatePassword(
  password: string,
  policy: PasswordPolicy = getPasswordPolicy(),
): PasswordValidationResult {
  const errors: string[] = [];
  const len = String(password || "").length;

  if (len < policy.minLength) {
    errors.push("Debe tener al menos " + policy.minLength + " caracteres.");
  }
  if (len > policy.maxLength) {
    errors.push("No puede tener más de " + policy.maxLength + " caracteres.");
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Debe incluir al menos una letra mayúscula.");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Debe incluir al menos una letra minúscula.");
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push("Debe incluir al menos un número.");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Debe incluir al menos un símbolo (ej. !, @, #, $).");
  }

  // Lista negra básica de contraseñas obvias
  const lowerPwd = String(password || "").toLowerCase();
  const blacklist = ["password", "12345678", "qwerty", "prontara", "admin", "letmein"];
  if (blacklist.some((b) => lowerPwd.includes(b))) {
    errors.push("Contraseña demasiado obvia. Usa algo más difícil de adivinar.");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Resumen humano de los requisitos para mostrar en formularios.
 */
export function describePolicy(policy: PasswordPolicy = getPasswordPolicy()): string[] {
  const out: string[] = [];
  out.push("Mínimo " + policy.minLength + " caracteres.");
  if (policy.requireUppercase) out.push("Una mayúscula.");
  if (policy.requireLowercase) out.push("Una minúscula.");
  if (policy.requireNumber) out.push("Un número.");
  if (policy.requireSymbol) out.push("Un símbolo.");
  return out;
}
