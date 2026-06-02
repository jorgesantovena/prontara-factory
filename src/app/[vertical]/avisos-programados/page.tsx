"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";

/**
 * TEST-17 bis 2 D — Pedro reporta "Avisos" del MP no funciona.
 * Antes era un SectionPlaceholder estático ("Estamos terminando..."),
 * pero el moduleKey `avisos-programados` ya está modelado en
 * CORE_FIELDS y CORE_TABLE_COLUMNS, así que basta con montar el
 * runtime genérico (mismo patrón que Tareas, Tickets, Compras, etc.).
 */
export default function AvisosProgramadosPage() {
  return <GenericModuleRuntimePage moduleKey="avisos-programados" href="/avisos-programados" />;
}
