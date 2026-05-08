import { type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { withPrisma, getPersistenceBackend } from "@/lib/persistence/db";

/**
 * GET /api/runtime/messages/stream (H3-FUNC-04)
 *
 * Server-Sent Events (SSE). El cliente abre `EventSource` y recibe
 * mensajes nuevos a medida que llegan.
 *
 * IMPORTANTE: en Vercel serverless las funciones tienen un timeout
 * máximo (10s en hobby, 60s en pro, 300s en pro+). El cliente debe
 * reconectar al cerrar — `EventSource` lo hace automáticamente.
 *
 * Estrategia: poll a la BD cada 3s, mandar SSE si hay novedades.
 * No es WebSocket "puro" pero es transparente para el cliente y
 * funciona en serverless.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const POLL_INTERVAL_MS = 3000;

export async function GET(request: NextRequest) {
  const session = requireTenantSession(request);
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (getPersistenceBackend() !== "postgres") {
    return new Response("Postgres only", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const payload = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // Saludo inicial
      send("hello", { at: new Date().toISOString() });

      let lastCheck = new Date();
      const start = Date.now();

      while (!closed && Date.now() - start < 55_000) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (closed) break;
        try {
          const messages = await withPrisma(async (prisma) => {
            const c = prisma as unknown as {
              internalMessage: {
                findMany: (a: { where: Record<string, unknown>; orderBy: { createdAt: "asc" } }) => Promise<Array<Record<string, unknown>>>;
              };
            };
            return await c.internalMessage.findMany({
              where: {
                clientId: session.clientId,
                createdAt: { gt: lastCheck },
                OR: [
                  { toEmail: null },
                  { toEmail: session.email },
                  { fromEmail: session.email },
                ],
              },
              orderBy: { createdAt: "asc" },
            });
          });
          lastCheck = new Date();
          for (const m of (messages || [])) {
            send("message", m);
          }
          // Heartbeat para que el proxy no cierre conexión
          send("ping", { at: new Date().toISOString() });
        } catch (err) {
          send("error", { error: err instanceof Error ? err.message : "stream error" });
        }
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      // Cliente cerró la conexión
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
