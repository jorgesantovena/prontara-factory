"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import ColegioBoletinLauncher from "@/components/erp/colegio-boletin-launcher";

export default function CalificacionesPage() {
  return (
    <GenericModuleRuntimePage
      moduleKey="calificaciones"
      href="/calificaciones"
      extraActions={<ColegioBoletinLauncher />}
    />
  );
}
