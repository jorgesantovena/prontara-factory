"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

export default function ProductosPage() {
  const { link } = useCurrentVertical();
  return <GenericModuleRuntimePage moduleKey="productos" href={link("productos")} />;
}
