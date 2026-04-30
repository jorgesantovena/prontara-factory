import { NextResponse, type NextRequest } from "next/server";
import {
  listNotificationsAsync,
  countUnreadNotificationsAsync,
  markNotificationReadAsync,
  markAllNotificationsReadAsync,
} from "@/lib/persistence/factory-notifications-store-async";

/**
 * GET /api/factory/notifications
 *   ?unread=1 → devuelve solo las no leídas
 *   ?limit=50 (1-500) → tamaño de la lista (por defecto 100)
 *
 * Devuelve { notifications, unreadCount } para que la UI pueda renderizar
 * tanto el feed como el badge de la campanita en una sola llamada.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limitRaw = Number(url.searchParams.get("limit") || "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsAsync({ unreadOnly, limit }),
      countUnreadNotificationsAsync(),
    ]);
    return NextResponse.json({ ok: true, notifications, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "Error listando notificaciones." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/factory/notifications
 *   Body: { action: "mark-read", id: "ntf-..." }
 *         { action: "mark-all-read" }
 *
 * Cambia el estado de leído. La creación de notificaciones es server-side
 * desde los puntos de evento (alta, webhook Stripe, lifecycle), no expuesta
 * por API pública para que el feed solo refleje eventos reales.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON inválido." }, { status: 400 });
  }

  const action = String(body.action || "");
  try {
    if (action === "mark-read") {
      const id = String(body.id || "");
      if (!id) {
        return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
      }
      const updated = await markNotificationReadAsync(id);
      return NextResponse.json({ ok: true, notification: updated });
    }

    if (action === "mark-all-read") {
      const count = await markAllNotificationsReadAsync();
      return NextResponse.json({ ok: true, marked: count });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no soportada. Usa 'mark-read' o 'mark-all-read'." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "Error procesando acción." },
      { status: 500 },
    );
  }
}
