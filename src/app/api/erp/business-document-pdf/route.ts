import { NextResponse, type NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/saas/auth-session";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
import { resolveTenantEmisorAsync } from "@/lib/saas/tenant-emisor-resolver";
import {
  generateBusinessDocumentPdf,
  type BusinessDocumentType,
} from "@/lib/saas/business-document-generator";
import { resolveRequestTenantRuntimeAsync } from "@/lib/saas/request-tenant-runtime-async";

/**
 * GET /api/erp/business-document-pdf?modulo=facturacion&id=XXX[&tipo=factura][&titulo=Recibo]
 *
 * Genera un PDF para un registro de presupuesto / factura / pedido /
 * albarán / recibo / ticket / bono usando una plantilla común (AUDIT-06).
 *
 * Resolución:
 *   1. Sesión válida del tenant.
 *   2. Carga el registro del módulo indicado (facturacion / presupuestos /
 *      pedidos / etc.) por id.
 *   3. Resuelve el emisor desde tenant runtime + módulo "ajustes".
 *   4. Resuelve el cliente buscando en el módulo "clientes" por el campo
 *      `cliente` del registro (match por nombre).
 *   5. Renderiza el PDF y lo devuelve inline para el navegador.
 *
 * Si `tipo` no se pasa, se infiere del módulo:
 *   - facturacion  -> factura
 *   - presupuestos -> presupuesto
 *   - pedidos      -> pedido
 *   - albaranes    -> albaran
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODULE_TO_TYPE: Record<string, BusinessDocumentType> = {
  facturacion: "factura",
  presupuestos: "presupuesto",
  pedidos: "pedido",
  albaranes: "albaran",
};

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Sesión no válida o tenant no autorizado." },
    { status: 401 },
  );
}

function parseImporteEur(raw: string): number {
  if (!raw) return 0;
  const m = String(raw).match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) return unauthorized();

    const params = request.nextUrl.searchParams;
    const modulo = String(params.get("modulo") || "").trim();
    const id = String(params.get("id") || "").trim();
    const tipoQuery = String(params.get("tipo") || "").trim().toLowerCase();
    const tituloOverride = String(params.get("titulo") || "").trim() || undefined;

    if (!modulo || !id) {
      return NextResponse.json(
        { ok: false, error: "Faltan parámetros obligatorios: modulo, id." },
        { status: 400 },
      );
    }

    const tipo: BusinessDocumentType =
      (tipoQuery as BusinessDocumentType) ||
      MODULE_TO_TYPE[modulo] ||
      "factura";

    // 1. Cargar el registro
    const records = await listModuleRecordsAsync(modulo, session.clientId);
    const record = records.find((r) => String(r.id) === id);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: "Registro " + id + " no encontrado en " + modulo + "." },
        { status: 404 },
      );
    }

    // 2. Resolver emisor (tenant)
    const runtime = await resolveRequestTenantRuntimeAsync(request);
    const emisor = await resolveTenantEmisorAsync({
      clientId: session.clientId,
      brandingDisplayName: runtime?.config?.branding?.displayName,
      brandingAccentColor: runtime?.config?.branding?.accentColor,
    });

    // 3. Resolver cliente — match por nombre del campo `cliente` con el
    //    módulo `clientes`. Si no encontramos coincidencia, usamos solo
    //    el string suelto.
    const clientesRecords = await listModuleRecordsAsync(
      "clientes",
      session.clientId,
    ).catch(() => [] as Array<Record<string, string>>);
    const clienteNombre = String(record.cliente || "").trim();
    const clienteMatch = clientesRecords.find(
      (c) => String(c.nombre || "").trim().toLowerCase() === clienteNombre.toLowerCase(),
    );

    // 4. Construir input para el generador
    const importe = parseImporteEur(
      String(record.importe || record.precio_mensual || "0"),
    );

    // Etiqueta de fecha secundaria según tipo
    let fechaSecundariaLabel: string | undefined;
    let fechaSecundaria: string | undefined;
    if (tipo === "factura") {
      fechaSecundariaLabel = "Vencimiento";
      fechaSecundaria = String(record.fechaVencimiento || "").trim() || undefined;
    } else if (tipo === "presupuesto") {
      fechaSecundariaLabel = "Validez";
      fechaSecundaria = String(record.fechaValidez || record.fechaEnvio || "").trim() || undefined;
    } else if (tipo === "pedido") {
      fechaSecundariaLabel = "Entrega prevista";
      fechaSecundaria = String(record.fechaEntrega || "").trim() || undefined;
    }

    const pdf = await generateBusinessDocumentPdf({
      tipo,
      tituloOverride,
      numero: String(record.numero || record.id || "—").trim(),
      estado: String(record.estado || "borrador").trim(),
      fechaEmision:
        String(record.fechaEmision || record.fecha || "").trim() ||
        new Date().toISOString().slice(0, 10),
      fechaSecundaria,
      fechaSecundariaLabel,
      concepto: String(record.concepto || record.descripcion || "—").trim(),
      importeTotal: importe,
      tipoIva: 21,
      notas: String(record.notas || "").trim() || undefined,
      emisor,
      cliente: {
        razonSocial: clienteNombre || "—",
        cif: String(clienteMatch?.cif || clienteMatch?.nif || "").trim() || undefined,
        direccion: String(clienteMatch?.direccion || "").trim() || undefined,
        email: String(clienteMatch?.email || "").trim() || undefined,
        telefono: String(clienteMatch?.telefono || "").trim() || undefined,
      },
    });

    const filename =
      tipo.charAt(0).toUpperCase() +
      tipo.slice(1) +
      "-" +
      String(record.numero || record.id || "").replace(/[^a-zA-Z0-9_-]+/g, "_") +
      ".pdf";

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="' + filename + '"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error generando PDF.",
      },
      { status: 500 },
    );
  }
}
