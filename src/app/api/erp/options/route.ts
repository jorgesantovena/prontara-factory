import { NextRequest, NextResponse } from "next/server";
import { listModuleRecords } from "@/lib/erp/active-client-data-store";
import { requireTenantSession } from "@/lib/saas/auth-session";

export async function GET(request: NextRequest) {
  try {
    const session = requireTenantSession(request);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida o tenant no autorizado." },
        { status: 401 }
      );
    }

    const moduleKey = String(request.nextUrl.searchParams.get("module") || "").trim();

    if (!moduleKey) {
      return NextResponse.json(
        { ok: false, error: "Falta el parámetro module." },
        { status: 400 }
      );
    }

    const rows = listModuleRecords(moduleKey, session.clientId);

    const options = rows
      .map((item) => {
        if (moduleKey === "clientes") {
          return {
            value: String(item.nombre || ""),
            label: String(item.nombre || ""),
          };
        }

        if (moduleKey === "presupuestos") {
          return {
            value: String(item.numero || ""),
            label: String(item.numero || "") + " · " + String(item.cliente || ""),
          };
        }

        if (moduleKey === "proyectos") {
          return {
            value: String(item.nombre || ""),
            label: String(item.nombre || "") + " · " + String(item.cliente || ""),
          };
        }

        return {
          value: String(item.id || ""),
          label: String(item.nombre || item.numero || item.contacto || item.id || ""),
        };
      })
      .filter((item) => item.value.trim().length > 0);

    return NextResponse.json({
      ok: true,
      module: moduleKey,
      options,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error cargando opciones.",
      },
      { status: 500 }
    );
  }
}