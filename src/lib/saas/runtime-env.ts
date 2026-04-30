/**
 * Helpers de variables de entorno runtime de Prontara.
 *
 * Punto único para resolver la URL pública de la app, evitando que cada
 * fichero lea `process.env.PRONTARA_APP_BASE_URL || process.env.X || ...`
 * con orden distinto.
 *
 * La variable canónica es `PRONTARA_PUBLIC_BASE_URL`. Para no romper los
 * deploys existentes que ya tienen `PRONTARA_APP_BASE_URL`, `APP_BASE_URL`
 * o `NEXT_PUBLIC_APP_URL`, las leemos como fallback en orden de
 * preferencia. Cuando todas estén vacías, en local se usa
 * `http://localhost:3000`.
 *
 * En código nuevo: usar SIEMPRE getPublicBaseUrl(). Nunca leer las env
 * vars individuales directamente.
 */

const ENV_FALLBACK_ORDER = [
  "PRONTARA_PUBLIC_BASE_URL", // canónica
  "PRONTARA_APP_BASE_URL", // legacy app
  "PRONTARA_PUBLIC_URL", // legacy public
  "APP_BASE_URL", // legacy genérico
  "NEXT_PUBLIC_APP_URL", // legacy con prefix público
] as const;

let warned = false;

/**
 * Devuelve la URL pública de la app sin trailing slash.
 * Ej: "https://app.prontara.com" o "http://localhost:3000".
 */
export function getPublicBaseUrl(): string {
  for (const key of ENV_FALLBACK_ORDER) {
    const v = String(process.env[key] || "").trim();
    if (v) {
      // Avisar UNA SOLA vez si se está usando una variable legacy en lugar
      // de la canónica.
      if (
        key !== "PRONTARA_PUBLIC_BASE_URL" &&
        !warned &&
        process.env.NODE_ENV !== "test"
      ) {
        warned = true;
        console.warn(
          "[runtime-env] Usando variable legacy " +
            key +
            ". Migra a PRONTARA_PUBLIC_BASE_URL en producción para evitar ambigüedad.",
        );
      }
      return v.replace(/\/+$/, "");
    }
  }
  return "http://localhost:3000";
}

/**
 * Variante explícita: si quieres que falle en lugar de caer al localhost
 * (útil en código que solo debe ejecutarse en producción).
 */
export function getPublicBaseUrlOrThrow(): string {
  for (const key of ENV_FALLBACK_ORDER) {
    const v = String(process.env[key] || "").trim();
    if (v) return v.replace(/\/+$/, "");
  }
  throw new Error(
    "Falta PRONTARA_PUBLIC_BASE_URL (o equivalente). Configúrala en .env.local o en Vercel.",
  );
}
