"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Contratos (TEST 19, software-factory) — runtime real.
 *
 * Antes era un STUB estático generado (datos falsos CT-001/2/3 +
 * `prontara.generated` mono-tenant + enlace a `/` sin prefijo de vertical
 * que tiraba al usuario a /acceso). Pedro reportó "veo contratos pero al
 * pulsar uno me saca a la pantalla de acceso". Ahora usa el shell genérico
 * como el resto de módulos: datos reales del tenant, enlaces vertical-aware.
 */
export default function ContratosPage() {
  const { link } = useCurrentVertical();
  return <GenericModuleRuntimePage moduleKey="contratos" href={link("contratos")} />;
}
