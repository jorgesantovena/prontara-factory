import { NextRequest, NextResponse } from "next/server";
import { listModuleRecordsAsync } from "@/lib/persistence/active-client-data-store-async";
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

    const rows = await listModuleRecordsAsync(moduleKey, session.clientId);

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

        // TEST-11 bis-3 — Catálogo de actividades: value = codigo (que es
        // el primary del módulo), label = "codigo · nombre" para que el
        // dropdown del Parte de horas sea legible.
        if (moduleKey === "actividades-catalogo") {
          return {
            value: String(item.codigo || ""),
            label: String(item.codigo || "") + (item.nombre ? " · " + String(item.nombre) : ""),
          };
        }

        // TEST-15 A — Catálogo de servicios (legacy SF): mismo patrón.
        // Antes caía al default (value = UUID) y el campo Código de
        // Servicio del Proyecto guardaba/mostraba UUIDs en vez de los
        // códigos "MANT", "INST", "NUEDES"... causando "basura".
        if (moduleKey === "catalogo-servicios") {
          return {
            value: String(item.codigo || ""),
            label: String(item.codigo || "") + (item.descripcion ? " · " + String(item.descripcion) : ""),
          };
        }

        // Preguntas 1.con / mail 2 puntos 15+17 — Maestros sin case
        // explícito caían al default (value=id, label=algo extraño)
        // y el listado mostraba UUIDs en las columnas relacionadas.
        // Para `tipos-cliente`, `zonas-comerciales` y `grupos-empresa`
        // usamos código + nombre como par legible.
        if (moduleKey === "tipos-cliente" || moduleKey === "zonas-comerciales" || moduleKey === "grupos-empresa") {
          return {
            value: String(item.codigo || item.nombre || ""),
            label: String(item.codigo || "") + (item.nombre ? " · " + String(item.nombre) : String(item.nombre || "")),
          };
        }

        // TEST-11 bis-5 — Empleados: value = nombre (legible) en lugar de
        // id. Coherente con clientes/proyectos para que los filtros y la
        // columna Empleado del listado muestren el nombre, no el UUID.
        if (moduleKey === "empleados") {
          return {
            value: String(item.nombre || ""),
            label: String(item.nombre || ""),
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