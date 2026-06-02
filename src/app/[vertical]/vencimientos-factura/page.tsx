"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";

/**
 * TEST-17 bis 2 D — Pedro reporta "Vencimientos" del MP no funciona.
 * Antes era un SectionPlaceholder estático; el moduleKey
 * `vencimientos-factura` está modelado en CORE (factura, fecha,
 * importe, formaPago, estado, fechaCobro), así que basta con montar
 * el runtime genérico.
 */
export default function VencimientosFacturaPage() {
  return <GenericModuleRuntimePage moduleKey="vencimientos-factura" href="/vencimientos-factura" />;
}
