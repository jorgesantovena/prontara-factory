import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import {
  buildVerifactuPayload,
  extractImporteFromFactura,
  type EmisorData,
  type ReceptorData,
} from "@/lib/verticals/software-factory/verifactu-payload";

/**
 * POST /api/erp/verifactu-emit (SF-12, stub)
 *
 * Body: { facturaId: string }
 *
 * Lee la factura del módulo `facturacion`, prepara el XML de Verifactu
 * (sin firmar) y lo guarda en la tabla VerifactuSubmission con
 * status="prepared". El envío real a AEAT (firma XML-DSig + POST al web
 * service) queda como TODO documentado en docs/verifactu-pendientes.md.
 *
 * Idempotente: si ya existe un VerifactuSubmission para esta factura
 * con status != "error", se devuelve el existente sin crear uno nuevo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Datos del emisor — SISPYME S.L. (entidad legal facturadora de Prontara).
// En el futuro vendrá de un registro Tenant.emisorVerifactu o de una env
// configurable por tenant si distintos clientes usan distintas sociedades.
const EMISOR_DEFAULT: EmisorData = {
  razonSocial: "SISPYME, S.L.",
  nif: "B33047580",
};

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const subscription = await checkTenantSubscriptionAsync(session);
    if (!subscription.allowed) {
      return NextResponse.json(
        { ok: false, error: subscription.reason, code: subscription.code },
        { status: 403 },
      );
    }

    if (getPersistenceBackend() !== "postgres") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Verifactu solo opera en modo Postgres (la tabla VerifactuSubmission no existe en filesystem).",
        },
        { status: 400 },
      );
    }

    let body: { facturaId?: string } = {};
    try {
      body = (await request.json()) as { facturaId?: string };
    } catch {
      // body opcional
    }

    const facturaId = String(body?.facturaId || "").trim();
    if (!facturaId) {
      return NextResponse.json(
        { ok: false, error: "Falta facturaId en el body." },
        { status: 400 },
      );
    }

    // 1. Lee la factura del módulo facturacion
    const facturas = await listModuleRecordsAsync("facturacion", session.clientId);
    const factura = facturas.find((f) => String(f.id) === facturaId);
    if (!factura) {
      return NextResponse.json(
        { ok: false, error: "Factura " + facturaId + " no encontrada." },
        { status: 404 },
      );
    }

    const facturaNumero = String(factura.numero || "").trim();
    if (!facturaNumero) {
      return NextResponse.json(
        {
          ok: false,
          error: "La factura no tiene número asignado. Asigna uno antes de enviar a Verifactu.",
        },
        { status: 400 },
      );
    }

    // 2. Idempotencia: ¿ya existe un envío preparado/enviado para esta factura?
    const existing = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        verifactuSubmission: {
          findFirst: (a: {
            where: { clientId: string; facturaModuleRecordId: string; status: { in: string[] } };
            orderBy: { createdAt: "desc" };
          }) => Promise<unknown>;
        };
      };
      return await c.verifactuSubmission.findFirst({
        where: {
          clientId: session.clientId,
          facturaModuleRecordId: facturaId,
          status: { in: ["prepared", "sent"] },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        existing: true,
        submission: existing,
        message:
          "Ya existe un envío Verifactu para esta factura. No se creó uno nuevo.",
      });
    }

    // 3. Resolver datos del receptor desde clientes (módulo "clientes")
    const clientes = await listModuleRecordsAsync("clientes", session.clientId);
    const cliente = clientes.find(
      (c) =>
        String(c.nombre || "").trim().toLowerCase() ===
        String(factura.cliente || "").trim().toLowerCase(),
    );
    const receptor: ReceptorData = {
      razonSocial: String(factura.cliente || "Cliente"),
      nif: cliente?.cif || cliente?.nif || undefined,
    };

    // 4. Construir payload XML
    const importeTotal = extractImporteFromFactura(String(factura.importe || "0"));
    const xml = buildVerifactuPayload(
      {
        numero: facturaNumero,
        cliente: receptor.razonSocial,
        concepto: String(factura.concepto || ""),
        importeTotal,
        fechaEmision: String(
          factura.fechaEmision || new Date().toISOString().slice(0, 10),
        ),
      },
      EMISOR_DEFAULT,
      receptor,
    );

    // 5. Persistir como prepared
    const id = randomUUID();
    const created = await withPrisma(async (prisma) => {
      const c = prisma as unknown as {
        verifactuSubmission: {
          create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      };
      return await c.verifactuSubmission.create({
        data: {
          id,
          tenantId: session.tenantId,
          clientId: session.clientId,
          facturaModuleRecordId: facturaId,
          facturaNumero,
          status: "prepared",
          xmlPayload: xml,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      existing: false,
      submission: created,
      message:
        "Payload Verifactu preparado. Falta firma XML-DSig + envío a AEAT (ver docs/verifactu-pendientes.md).",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error preparando Verifactu.",
      },
      { status: 500 },
    );
  }
}
