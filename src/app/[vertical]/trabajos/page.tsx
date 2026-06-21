"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";

/**
 * Trabajos — TEST 26 (Pedro).
 *
 * Mismo dato que "Tareas" (módulo `actividades`), pero como item de menú
 * independiente orientado a la CAPTURA DIARIA rápida: al entrar abre
 * directamente el alta (quickEntry), asume Empleado/Fecha y encadena la Hora
 * desde de la tarea anterior, y lista lo imputado con lo más reciente arriba
 * y la jornada en orden de hora. "Tareas" queda para la explotación/lista.
 */
export default function TrabajosPage() {
  return (
    <GenericModuleRuntimePage
      moduleKey="actividades"
      href="/trabajos"
      labelOverride="Trabajos"
      quickEntry
    />
  );
}
