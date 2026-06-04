"use client";

import GenericModuleRuntimePage from "@/components/erp/generic-module-runtime-page";

/**
 * Preguntas 1.con / mail 2 punto 6 — Alta y listado CRUD del módulo
 * CAU usando el runtime genérico (con todos sus campos del pack SF:
 * asunto, cliente, aplicación, severidad, urgencia, asignado, estado,
 * descripción, solución).
 *
 * Existe en paralelo a `/cau`, que es la vista enriquecida con KPIs SLA,
 * MTR, compliance, vistas guardadas (Mis tickets, Sin asignar, Vencidos
 * SLA, Esperando cliente) y SLA bullet por fila. Mientras esa vista no
 * incorpore alta, esta ruta sirve para crear y editar tickets vía el
 * editor estándar (que sí soporta `?action=new`).
 */
export default function CauTicketNuevoPage() {
  return <GenericModuleRuntimePage moduleKey="cau" href="/cau-ticket-nuevo" />;
}
