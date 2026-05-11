"use client";

import { useEffect, useState } from "react";
import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";
import RenovarProyectoButton from "@/components/erp/renovar-proyecto-button";

export default function ProyectosPage() {
  // SF-05: solo el vertical software-factory expone "Renovar" en cada
  // fila. Otros verticales (dental, gimnasio, taller...) no tienen el
  // mismo modelo de proyecto-con-caducidad, así que omitimos el botón.
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
      moduleKey="proyectos"
      href="/proyectos"
      extraRowActions={
        isSoftwareFactory
          ? (row) => <RenovarProyectoButton proyecto={row} />
          : undefined
      }
    />
  );
}
