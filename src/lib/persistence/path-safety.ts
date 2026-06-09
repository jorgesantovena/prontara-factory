/**
 * Seguridad de rutas en el backend de persistencia JSON (filesystem).
 *
 * Los datos operativos de un tenant se guardan en
 * `.prontara/data/<clientId>/<moduleKey>.json`. Tanto `clientId` como
 * `moduleKey` se concatenan a una ruta de fichero. Si cualquiera de los
 * dos no se valida, un valor con `../` o separadores permite escapar al
 * directorio de otro tenant (o del propio repo) — fuga/escritura
 * cross-tenant.
 *
 * Vector confirmado en la auditoría 2026-06-09:
 *   GET /api/erp/module?module=../<otro-tenant>/clientes
 * devolvía los datos de otro tenant porque `resolveModuleDataFile`
 * concatenaba el moduleKey sin sanear. Este validador cierra el sink.
 *
 * Los clientId y moduleKey legítimos del sistema son slugs:
 * letras, dígitos, guion y guion bajo. Cualquier otra cosa (`.`, `/`,
 * `\`, espacios) se rechaza.
 */

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

export function assertSafePathSegment(value: string, label: string): string {
  const v = String(value || "").trim();
  if (!v) {
    throw new Error(`${label} vacío.`);
  }
  if (!SAFE_SEGMENT.test(v)) {
    throw new Error(
      `${label} no válido (solo se permiten letras, dígitos, guion y guion bajo).`
    );
  }
  return v;
}
