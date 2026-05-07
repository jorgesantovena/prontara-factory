"use client";

import { useEffect, useState } from "react";
import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import EmitMonthlyButton from "@/components/erp/emit-monthly-button";
import VerifactuButton from "@/components/erp/verifactu-button";
import DownloadDocumentButton from "@/components/erp/download-document-button";

export default function FacturacionPage() {
  // SF-12 / AUDIT-06: el botón Verifactu y Emitir mes solo aplican al
  // vertical software-factory. El botón Descargar PDF aplica a TODOS los
  // verticales — la plantilla del PDF es común y se adapta al tenant
  // automáticamente.
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
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      }
      extraRowActions={(row) => (
        <>
          <DownloadDocumentButton modulo="facturacion" row={row} />
          {isSoftwareFactory ? <VerifactuButton factura={row} /> : null}
        </>
      )}
    />
  );
}
