"use client";

import { useEffect, useState } from "react";
import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import EmitMonthlyButton from "@/components/erp/emit-monthly-button";
import VerifactuButton from "@/components/erp/verifactu-button";

export default function FacturacionPage() {
  // SF-12: el botón Verifactu (igual que "Emitir mes") solo aplica al
  // vertical software-factory porque el flujo está pensado para SISPYME
  // como entidad facturadora con su CIF. Otros verticales no tienen
  // configurado el emisor.
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [businessTypeLoaded, setBusinessTypeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/runtime/tenant-config", {
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;
        const bt = String(data?.config?.businessType || "")
          .trim()
          .toLowerCase();
        setBusinessType(bt || null);
      } catch {
        if (!cancelled) setBusinessType(null);
      } finally {
        if (!cancelled) setBusinessTypeLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSoftwareFactory = businessTypeLoaded && businessType === "software-factory";

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
      extraRowActions={
        isSoftwareFactory
          ? (row) => <VerifactuButton factura={row} />
          : undefined
      }
    />
  );
}
