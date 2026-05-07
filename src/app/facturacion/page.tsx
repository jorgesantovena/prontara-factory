"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import EmitMonthlyButton from "@/components/erp/emit-monthly-button";

export default function FacturacionPage() {
  return (
    <GenericModuleRuntimePage
      moduleKey="facturacion"
      href="/facturacion"
      extraActions={
        <EmitMonthlyButton
          onAfterEmit={() => {
            // Refresca la página para que la nueva factura aparezca en la
            // tabla. GenericModuleRuntimePage no expone un reload externo,
            // así que reload completo es lo más simple y robusto.
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      }
    />
  );
}
