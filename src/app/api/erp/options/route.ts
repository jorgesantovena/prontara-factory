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
        // TEST-20 E — Pedro: un Servicio dado de alta no aparecía en el
        // desplegable "Código de servicio" del Proyecto. Causa: en
        // TEST-16 D se eliminó el campo Código del alta de Servicios, así
        // que los nuevos no tienen `codigo`; con value = codigo quedaban
        // con value vacío y el filtro final los descartaba. Fallback: si
        // no hay código, usamos la descripción como value (legible, sin
        // UUIDs, coherente con TEST-15 A) para que el servicio aparezca y
        // sea seleccionable.
        // TEST 22 — Pedro: el desplegable de Código de Servicio salía
        // repetido ("Soporte · Soporte"). Debe mostrar solo el nombre limpio
        // del servicio (la descripción). El `value` sigue siendo el código
        // (clave de la tarifa) con fallback a la descripción.
        if (moduleKey === "catalogo-servicios") {
          const code = String(item.codigo || "").trim();
          const desc = String(item.descripcion || "").trim();
          return {
            value: code || desc,
            label: desc || code,
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

        // Test 18 bis 2 A+B — `actividades` (Tareas / Parte de horas):
        // las sublistas de Gastos y Desplazamientos guardan el id de
        // la tarea como referencia, pero la UI debe enseñar el
        // CONCEPTO (no el UUID). value = id, label = concepto + fecha.
        if (moduleKey === "actividades") {
          const concepto = String(item.concepto || item.descripcion || "(sin concepto)").trim();
          const fecha = String(item.fecha || "").slice(0, 10);
          return {
            value: String(item.id || ""),
            label: concepto + (fecha ? " · " + fecha : ""),
          };
        }

        // Test 18 bis 2 C+D + TEST-20 C — `formas-pago` para el cliente
        // y la factura. Pedro: solo el NOMBRE en el dropdown (no
        // codigo · nombre, que es texto largo y rompía a varias líneas
        // en la columna "Forma de pago" del listado).
        if (moduleKey === "formas-pago") {
          return {
            value: String(item.codigo || item.nombre || ""),
            label: String(item.nombre || item.codigo || ""),
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

        // TEST 19 (Pedro) — Niveles tienen clave compuesta
        // (tipoNivel, subtipo, modelo). Como el value tiene que ser
        // string único, usamos "tipo-subtipo-modelo". El label es
        // legible para el usuario. Esta key se usa raramente como
        // referencia directa: lo normal es que el Contrato guarde
        // tipoNivel y subtipo por separado y el engine resuelva el
        // Nivel completo en runtime.
        if (moduleKey === "niveles") {
          const t = String(item.tipoNivel || "");
          const s = String(item.subtipo || "");
          const m = String(item.modelo || "");
          return {
            value: t + "-" + s + "-" + m,
            label: t + " · " + s + " · " + m + (item.descripcion ? " — " + String(item.descripcion).slice(0, 40) : ""),
          };
        }

        // TEST 19 (Pedro) — Contratos: value=codigo (libre, otorgado al
        // alta). Label legible con cliente y nivel.
        if (moduleKey === "contratos") {
          const partes: string[] = [];
          if (item.cliente) partes.push(String(item.cliente));
          if (item.tipoNivel || item.subtipo) partes.push(String(item.tipoNivel || "") + (item.subtipo ? " " + String(item.subtipo) : ""));
          return {
            value: String(item.codigo || item.numero || item.id || ""),
            label: String(item.codigo || item.numero || "") + (partes.length > 0 ? " · " + partes.join(" · ") : ""),
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