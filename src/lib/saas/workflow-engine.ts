/**
 * Workflow rules engine MVP (DEV-WF).
 *
 * Modelo simple: reglas que se disparan cuando un registro de un módulo
 * se crea o cambia a un estado concreto. Cada regla ejecuta UNA acción:
 *   - notify: añade un FactoryNotification para el operador
 *   - createTask: crea un registro en el módulo "tareas"
 *   - setEstado: cambia el estado del registro disparador a otro
 *
 * Esto NO es un workflow engine completo (sin paralelismo, ramas
 * condicionales ni aprobaciones multinivel) — es el MVP suficiente
 * para que el operador automatice el 80% de casos comunes:
 *   "Cuando una factura cambie a vencida, créame una tarea para llamar al cliente"
 *   "Cuando un proyecto pase a por_renovar, notifícame"
 *   "Cuando una tarea cambie a urgente, sube su prioridad" (vía setEstado)
 *
 * Para flujos complejos (aprobaciones), construir un engine de pasos
 * es trabajo siguiente — documentado en STATUS.md.
 */
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

export type WorkflowAction =
  | { type: "notify"; title: string; message: string; severity?: "info" | "success" | "warning" | "error" }
  | { type: "createTask"; titulo: string; asignado?: string; prioridad?: string }
  | { type: "setEstado"; estado: string };

export type WorkflowRule = {
  id: string;
  tenantId: string;
  clientId: string;
  name: string;
  triggerModule: string;
  triggerEstado: string | null;
  actionType: string;
  actionPayload: WorkflowAction;
  enabled: boolean;
};

/**
 * Lee todas las reglas activas para un cliente + módulo. En modo
 * filesystem devuelve [] (las reglas solo persisten en Postgres).
 */
export async function getRulesForModule(
  clientId: string,
  moduleKey: string,
): Promise<WorkflowRule[]> {
  if (getPersistenceBackend() !== "postgres") return [];
  const rules = await withPrisma(async (prisma) => {
    const c = prisma as unknown as {
      workflowRule: {
        findMany: (a: {
          where: { clientId: string; triggerModule: string; enabled: boolean };
        }) => Promise<Array<Record<string, unknown>>>;
      };
    };
    return await c.workflowRule.findMany({
      where: { clientId, triggerModule: moduleKey, enabled: true },
    });
  });
  return ((rules as unknown as WorkflowRule[]) || []).map((r) => ({
    ...r,
    actionPayload: typeof r.actionPayload === "string"
      ? (JSON.parse(r.actionPayload as unknown as string) as WorkflowAction)
      : (r.actionPayload as WorkflowAction),
  }));
}

/**
 * Procesa el evento de creación/actualización de un registro.
 * Devuelve la lista de acciones ejecutadas (para auditoría) y los
 * cambios al payload que el caller debe persistir antes del save final.
 */
export async function processWorkflowRules(input: {
  clientId: string;
  moduleKey: string;
  /** Estado nuevo del registro tras la operación. */
  estadoNuevo: string;
  /** Estado anterior si es update; null si es create. */
  estadoAnterior: string | null;
  /** Payload del registro disparador. Puede ser mutado por la acción setEstado. */
  payload: Record<string, unknown>;
}): Promise<{
  payloadActualizado: Record<string, unknown>;
  accionesEjecutadas: string[];
}> {
  const accionesEjecutadas: string[] = [];
  let payloadActualizado = { ...input.payload };

  if (getPersistenceBackend() !== "postgres") {
    return { payloadActualizado, accionesEjecutadas };
  }

  let rules: WorkflowRule[] = [];
  try {
    rules = await getRulesForModule(input.clientId, input.moduleKey);
  } catch {
    return { payloadActualizado, accionesEjecutadas };
  }

  for (const rule of rules) {
    // ¿La regla matchea el evento?
    const triggerEstado = rule.triggerEstado || "";
    const isCreate = input.estadoAnterior === null;
    const estadoCambio =
      !isCreate && input.estadoAnterior !== input.estadoNuevo;

    let dispara = false;
    if (!triggerEstado) {
      // sin estado → cualquier creación
      dispara = isCreate;
    } else {
      // con estado → cuando el registro pase A ese estado
      dispara =
        (isCreate && input.estadoNuevo === triggerEstado) ||
        (estadoCambio && input.estadoNuevo === triggerEstado);
    }
    if (!dispara) continue;

    try {
      await executeAction(rule, input.clientId);
      accionesEjecutadas.push(rule.actionType + ":" + rule.id);
      // Si la acción fue setEstado, mutamos el payload para que el
      // caller lo persista con el nuevo estado en el mismo write.
      if (rule.actionType === "setEstado") {
        const a = rule.actionPayload as Extract<WorkflowAction, { type: "setEstado" }>;
        if (a.estado) payloadActualizado.estado = a.estado;
      }
    } catch {
      // No bloqueamos el flujo si falla la acción.
    }
  }

  return { payloadActualizado, accionesEjecutadas };
}

async function executeAction(rule: WorkflowRule, clientId: string): Promise<void> {
  const a = rule.actionPayload;
  if (a.type === "notify") {
    await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        factoryNotification: {
          create: (arg: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      await c.factoryNotification.create({
        data: {
          id: "wf-" + rule.id + "-" + Date.now(),
          type: "manual",
          severity: a.severity || "info",
          title: "[" + rule.name + "] " + a.title,
          message: a.message,
          metadata: { ruleId: rule.id, clientId },
        },
      });
    });
  } else if (a.type === "createTask") {
    // Importamos lazy para evitar dependencia circular.
    const { createModuleRecordAsync } = await import(
      "@/lib/persistence/active-client-data-store-async"
    );
    await createModuleRecordAsync(
      "tareas",
      {
        titulo: a.titulo,
        asignado: a.asignado || "",
        prioridad: a.prioridad || "media",
        estado: "pendiente",
        descripcion: "Generada automáticamente por workflow '" + rule.name + "'",
      },
      clientId,
    );
  }
  // setEstado se ejecuta como mutación de payload en processWorkflowRules.
}
