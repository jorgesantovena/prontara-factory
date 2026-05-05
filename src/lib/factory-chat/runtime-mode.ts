/**
 * Detección del modo de ejecución para las tools del chat.
 *
 * El chat tiene dos clases de tools:
 *   - "operate" — leen/escriben estado de la SaaS en Postgres (tenants,
 *     trial, audit, demo seed). Funcionan en ambos entornos.
 *   - "code" — leen y escriben en el repo local (src/, scripts/, prisma/).
 *     Requieren un filesystem writable y `node_modules/.bin/{tsc,eslint}`.
 *     Solo funcionan cuando el chat corre en local con `pnpm dev`.
 *
 * En Vercel serverless el filesystem es read-only y los binarios de
 * desarrollo (tsc, eslint) no están en el bundle desplegado. Las tools
 * de código fallarían con errores crípticos de permisos / "binary not
 * found". Es mejor abortar con un mensaje claro que permita al operador
 * entender que esa operación va contra el repo y debe hacerse en local.
 *
 * Heurística:
 *   - Si está la env var VERCEL=1 → producción serverless, code mode OFF.
 *   - Si está PRONTARA_FACTORY_CODE_MODE=off → forzar OFF aunque esté en local.
 *   - Si está PRONTARA_FACTORY_CODE_MODE=on → forzar ON aunque esté en Vercel
 *     (por si en algún momento corremos en un entorno con fs writable que
 *     no es local; por defecto NO está activo).
 *   - Si no, default ON (asumimos local dev).
 */

export type RuntimeMode = "local-dev" | "serverless";

export function getRuntimeMode(): RuntimeMode {
  const override = String(process.env.PRONTARA_FACTORY_CODE_MODE || "").toLowerCase();
  if (override === "off") return "serverless";
  if (override === "on") return "local-dev";
  if (process.env.VERCEL === "1") return "serverless";
  return "local-dev";
}

export function isCodeModeAvailable(): boolean {
  return getRuntimeMode() === "local-dev";
}

/**
 * Lanza un error con mensaje útil cuando se invoca una tool de código en
 * un entorno donde no está disponible. Llamar al inicio del handler de
 * cada tool de código.
 */
export function assertCodeModeAvailable(toolName: string): void {
  if (isCodeModeAvailable()) return;
  throw new Error(
    `La tool "${toolName}" solo está disponible cuando el chat corre en local con acceso al repo (pnpm dev). ` +
      `En producción serverless (Vercel) el filesystem es read-only y los binarios de desarrollo no están en el bundle. ` +
      `Para editar código, lanza el chat en local; para operar la SaaS (tenants, trial, demo seed, audit), ` +
      `usa las tools de "operate" que sí funcionan en producción.`,
  );
}
