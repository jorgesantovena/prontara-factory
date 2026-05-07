import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { checkTenantSubscriptionAsync } from "@/lib/saas/subscription-guard";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { getPersistenceBackend, withPrisma } from "@/lib/persistence/db";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";
import {
  buildVerifactuPayload,
  extractImporteFromFactura,
  type ReceptorData,
} from "@/lib/verticals/software-factory/verifactu-payload";

/**
 * POST /api/erp/verifactu-emit (SF-12 / AUDIT-07, stub)
 *
 * Body: { facturaId: string }
 *
 * Lee la factura del módulo `facturacion`, prepara el XML de Verifactu
 * (sin firmar) y lo guarda en la tabla VerifactuSubmission con
 * status="prepared". El envío real a AEAT (firma XML-DSig + POST al web
 * service) queda como TODO documentado en docs/verifactu-pendientes.md.
 *
 * AUDIT-07: el emisor del XML es el TENANT (la empresa que emite la
 * factura — clínica dental, taller, gimnasio, software factory, etc.),
 * NO SISPYME. SISPYME solo es el emisor del SaaS Prontara, no de las
 * facturas que cada tenant emite a sus propios clientes. Por eso los
 * datos fiscales se resuelven con resolveTenantEmisorAsync desde el
 * módulo "ajustes" del tenant. Si el tenant no tiene CIF configurado,
 * devolvemos error claro indicándolo.
 *
 * Idempotente: si ya existe un VerifactuSubmission para esta factura
 * con status != "error", se devuelve el existente sin crear uno nuevo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    // 3. Resolver emisor — el TENANT, no SISPYME. AUDIT-07.
    const runtime = await resolveRequestTenantRuntimeAsync(request);
    const tenantEmisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });

    if (!tenantEmisor.cif || tenantEmisor.cif === "—") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el CIF/NIF del emisor en el módulo Ajustes. Verifactu necesita la identidad fiscal del tenant. Crea un registro en /ajustes con clave 'cif' y valor tu CIF antes de enviar.",
          code: "EMISOR_SIN_CIF",
        },
        { status: 400 },
      );
    }

    // 4. Resolver datos del receptor desde clientes (módulo "clientes")
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

    // 5. Construir payload XML usando el emisor del tenant
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
      {
        razonSocial: tenantEmisor.razonSocial,
        nif: tenantEmisor.cif,
      },
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
