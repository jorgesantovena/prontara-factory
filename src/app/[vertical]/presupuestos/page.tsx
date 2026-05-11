"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import DownloadDocumentButton from "@/components/erp/download-document-button";

export default function PresupuestosPage() {
  return (
    <GenericModuleRuntimePage
      moduleKey="presupuestos"
      href="/presupuestos"
      extraRowActions={(row) => (
        <DownloadDocumentButton modulo="presupuestos" row={row} />
      )}
    />
  );
}
