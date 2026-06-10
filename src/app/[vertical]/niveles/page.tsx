"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Niveles (TEST 19, software-factory) — runtime real.
 *
 * El módulo `niveles` se añadió al sector pack en TEST 19, pero NUNCA se
 * creó su página bajo `[vertical]/`. El menú lo mostraba (viene del pack),
 * pero al pulsarlo no había ruta → el usuario acababa en /acceso. Pedro lo
 * reportó como "las opciones nuevas del menú vertical no funcionan".
 */
export default function NivelesPage() {
  const { link } = useCurrentVertical();
  return <GenericModuleRuntimePage moduleKey="niveles" href={link("niveles")} />;
}
