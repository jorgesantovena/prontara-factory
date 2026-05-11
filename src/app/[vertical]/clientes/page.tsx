"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Clientes — usa el shell genérico rediseñado (H12-F).
 *
 * El antiguo /clientes/page.tsx tenía un panel "Resumen 360" propio que
 * mostraba actividad cruzada (oportunidades + proyectos + presupuestos
 * + facturas + documentos del cliente). Esa funcionalidad se moverá al
 * drawer detalle del genérico como una mejora del componente común
 * (TODO H13-X), de forma que TODOS los módulos puedan tener una vista
 * 360 — no solo clientes.
 */
export default function ClientesPage() {
  const { link } = useCurrentVertical();
  return <GenericModuleRuntimePage moduleKey="clientes" href={link("clientes")} />;
}
