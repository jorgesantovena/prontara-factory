"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import EmitMonthlyButton from "@/components/erp/emit-monthly-button";
import VerifactuButton from "@/components/erp/verifactu-button";
import DownloadDocumentButton from "@/components/erp/download-document-button";

/**
 * Página de facturación, común a todos los verticales.
 *
 * Botones por fila:
 *   - "↓ PDF" — plantilla común con datos del tenant (AUDIT-06).
 *   - "Verifactu" — obligación legal española para CUALQUIER empresa que
 *     emita facturas (AUDIT-07). El emisor del XML es el tenant
 *     (no SISPYME), resuelto desde el módulo "ajustes".
 *
 * Botón superior:
 *   - "Emitir mes" — solo SF (cruza módulo "actividades" inexistente en
 *     otros packs). Este componente se autodetecta vía businessType y
 *     no aparece fuera de SF.
 */
export default function FacturacionPage() {
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
          <VerifactuButton factura={row} />
        </>
      )}
    />
  );
}
