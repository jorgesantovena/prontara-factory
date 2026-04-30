import { NextRequest, NextResponse } from "next/server";
import { buildFactoryRuntimeBridge } from "@/lib/factory/factory-runtime-bridge";
import { listTenantClientsIndex } from "@/lib/saas/tenant-clients-index";

/**
 * POST /api/factory/client-action
 *
 * Acciones disponibles sobre un cliente desde el panel Factory. Todas las
 * acciones son deliberadamente NO DESTRUCTIVAS: localizan al target en el
 * índice de tenants y devuelven confirmación. La aplicación real del cambio
 * (cancelar suscripción, relanzar pipeline de provisioning, etc.) se hace
 * desde los endpoints específicos de billing/provisioning cuando el
 * operador confirma.
 *
 * Esto permite que la ficha Factory muestre botones visibles sin riesgo de
 * tocar producción por error, y concentra en un solo endpoint el patrón de
 * "confirmar intención" antes de ejecutar.
 */

type KnownAction =
  | "open"
  | "use"
  | "regenerate"
  | "download"
  | "suspend"
  | "reactivate"
  | "contact";

const ACTION_MESSAGES: Record<KnownAction, string> = {
  open: "Cliente localizado para abrir en contexto tenant.",
  use: "Cliente localizado para usar en contexto tenant.",
  regenerate:
    "Solicitud de regeneración registrada. Ejecuta /api/factory/provisioning/run para aplicar.",
  download: "Cliente localizado para descarga controlada.",
  suspend:
    "Solicitud de suspensión registrada. Ejecuta /api/runtime/billing-cancel para aplicar.",
  reactivate:
    "Solicitud de reactivación registrada. Ejecuta /api/runtime/billing-change-plan para aplicar.",
  contact: "Contacto preparado con los datos de compra del cliente.",
};

function isKnownAction(value: string): value is KnownAction {
  return (Object.keys(ACTION_MESSAGES) as string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actionRaw = String(body?.action || "").trim();
    const targetClientId = String(body?.clientId || "").trim();
    const bridge = buildFactoryRuntimeBridge(request);
    const clients = listTenantClientsIndex();

    if (!actionRaw) {
      return NextResponse.json(
        { ok: false, error: "Falta action." },
        { status: 400 }
      );
    }

    if (!isKnownAction(actionRaw)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Acción no soportada. Usa una de: " +
            Object.keys(ACTION_MESSAGES).join(", "),
        },
        { status: 400 }
      );
    }

    const target =
      clients.find((item) => item.clientId === targetClientId) || null;

    if (targetClientId && !target) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se ha encontrado el cliente " + targetClientId + " en el índice.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: actionRaw,
      target,
      current: bridge.tenant,
      message: ACTION_MESSAGES[actionRaw],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno en /api/factory/client-action",
      },
      { status: 500 }
    );
  }
}
