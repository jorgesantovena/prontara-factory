/**
 * Value objects de Prontara (DDD ligero · ARQ-8).
 *
 * Un value object es un tipo que encapsula una invariante de dominio:
 * un Email es siempre un string sintácticamente válido y normalizado;
 * un Slug solo contiene `[a-z0-9-]`; un Money lleva céntimos enteros y
 * una moneda; un BillingPlanKey solo puede ser uno de los 4 valores
 * conocidos.
 *
 * Diseño:
 *   - "Branded types" (técnica TypeScript) para que el compilador NO
 *     deje pasar un string crudo donde se espera un Email/Slug. Esto se
 *     paga sin coste runtime.
 *   - Cada VO tiene una factory `parseX(raw)` que devuelve `null` si no
 *     es válido, y opcionalmente `unsafeX(raw)` para los casos en que
 *     ya sabemos por construcción que el valor es válido (lectura de DB
 *     ya validada, etc).
 *   - Todos los VO son inmutables. No tienen métodos mutantes.
 *
 * Uso recomendado:
 *   - APIs públicas y nuevos endpoints: aceptar string raw, parse al
 *     entrar, propagar VO hacia abajo. Si parse devuelve null → 400.
 *   - Stores async: pueden seguir aceptando strings por compatibilidad
 *     y migrar gradualmente a VO. La migración masiva no aporta valor —
 *     basta con usarlos en los hot paths nuevos.
 *
 * Lo que NO son value objects (deliberadamente):
 *   - Objetos con identidad (Tenant, Account, Subscription) — esos son
 *     entidades / agregados, viven en otro lado.
 */
export * from "./email";
export * from "./slug";
export * from "./money";
export * from "./billing-plan-key";
