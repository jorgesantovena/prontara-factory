"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";
// TEST-17 — Iconos compartidos con TabBar. Ver src/lib/ui/module-icons.ts.
import { MODULE_ICON } from "@/lib/ui/module-icons";

/**
 * Sidebar lateral fija del runtime del tenant.
 *
 * Muestra los módulos del vertical contratado, con los labels que vengan del
 * sector pack (p. ej. "Oportunidades" en Software Factory, "Socios" en
 * Gimnasio, "Familias" en Colegio). Lee /api/runtime/tenant-config para
 * resolverlo. Si la API falla o todavía no ha respondido, muestra labels
 * neutros como fallback.
 *
 * En desktop ocupa una columna de 240px; en mobile se colapsa a un botón
 * hamburguesa que despliega un drawer.
 */

type RuntimeConfig = {
  modules: Array<{ moduleKey: string; enabled: boolean }>;
  navigationLabelMap: Record<string, string>;
  labels?: Record<string, string>;
  branding?: { displayName?: string; accentColor?: string };
};

// Orden lógico de los módulos en la sidebar. Los keys que no estén en este
// array salen al final, ordenados por config.modules. "produccion" no es
// un módulo del pack (no tiene schema propio), es un hub que orquesta los
// sub-módulos tareas/incidencias/etc., por eso lo añadimos como item
// "virtual" en la sidebar después de Proyectos.
const MODULE_ORDER = [
  "clientes",
  "crm",
  // Preguntas 1.con / mail 2 punto 3 — Propuestas entre Oportunidades
  // (crm) y Proyectos. Antes salía detrás de pre-facturación porque
  // pertenecía a Administración; ahora va aquí en el pipeline comercial.
  "presupuestos",
  "proyectos",
  "produccion",
  "pre-facturacion",
  "facturacion",
  "documentos",
  // TEST-5.S — Reportes en el sidebar (grupo Analítica).
  "reportes",
  "catalogo-servicios",
  // SCHOOL-03 — módulos extendidos del ERP escolar (orden académico)
  "docentes",
  "horarios",
  "planeaciones",
  "calificaciones",
  "asistencia",
  "disciplina",
  "orientacion",
  "enfermeria",
  // Servicios
  "transporte",
  "comedor",
  "biblioteca",
  "actividades",
  "salidas",
  "becas",
  // Comunicación / institucional
  "comunicaciones",
  "eventos",
  "visitantes",
  "tramites",
  // Operación
  "inventario",
  "mantenimiento",
  "personal",
  "egresados",
  // Sistema
  "asistente",
  "equipo",
  "ajustes",
  // CORE-03 — módulos transversales universales del ERP. Insertamos al
  // final para que NO compitan con el orden semántico del vertical.
  "tareas",
  "tickets",
  "compras",
  "productos",
  "reservas",
  "encuestas",
  "etiquetas",
  "plantillas",
];

// Items "fijos" no asociados a un módulo del pack: van siempre arriba o abajo.
const FIXED_TOP = [
  { href: "/", label: "Inicio", moduleKey: "_home", icon: "🏠" },
  { href: "/buscar", label: "Buscar", moduleKey: "_search", icon: "🔍" },
];

// H12-B + H12-E — Categorías agrupadoras del sidebar.
//   Operación → el día a día (clientes, ventas, agenda, tareas, comunicación).
//   Administración → finanzas, compras, inventario activos.
//   Analítica → reportes, indicadores, estadísticas.
//   Configuración → ajustes y módulos del sistema (asistente, equipo, integraciones).
//   Maestros → tablas maestras de configuración avanzada (tipos *, tarifas,
//     formas de pago, cuentas bancarias...). Colapsada por defecto para no
//     saturar la sidebar — el usuario las toca una vez al mes.
type SidebarCategory = "operacion" | "administracion" | "analitica" | "configuracion" | "maestros";
const CATEGORY_ORDER: SidebarCategory[] = ["operacion", "administracion", "analitica", "configuracion", "maestros"];
const CATEGORY_LABEL: Record<SidebarCategory, string> = {
  operacion: "Operación",
  administracion: "Administración",
  analitica: "Analítica",
  configuracion: "Configuración",
  maestros: "Maestros",
};
// Las categorías en este set arrancan colapsadas (solo se ve el header,
// click expande). El usuario puede expandirlas — la elección persiste en
// localStorage por categoría.
const COLLAPSED_BY_DEFAULT: Set<SidebarCategory> = new Set(["maestros"]);
const MODULE_CATEGORY: Record<string, SidebarCategory> = {
  // Operación — el día a día
  clientes: "operacion",
  crm: "operacion",
  proyectos: "operacion",
  produccion: "operacion",
  tareas: "operacion",
  actividades: "operacion",
  reservas: "operacion",
  caja: "operacion",
  "puntos-venta": "operacion",
  "vista-kanban": "operacion",
  "vista-gantt": "operacion",
  calendario: "operacion",
  eventos: "operacion",
  // Comunicación (fusionada en Operación)
  comunicaciones: "operacion",
  mensajes: "operacion",
  "avisos-programados": "operacion",
  // Académico (colegio)
  docentes: "operacion",
  horarios: "operacion",
  planeaciones: "operacion",
  calificaciones: "operacion",
  asistencia: "operacion",
  disciplina: "operacion",
  orientacion: "operacion",
  enfermeria: "operacion",
  transporte: "operacion",
  comedor: "operacion",
  biblioteca: "operacion",
  salidas: "operacion",
  becas: "operacion",
  visitantes: "operacion",
  tramites: "operacion",
  egresados: "operacion",
  // Administración — finanzas y stock (cosas que se tocan a diario/semana)
  // Preguntas 1.con C — Pedro confirma: Propuestas pasa a Operación,
  // entre Oportunidades y Proyectos. Conceptualmente forma parte del
  // pipeline comercial (Oportunidad → Propuesta → Proyecto), no del
  // cierre administrativo.
  presupuestos: "operacion",
  "pre-facturacion": "administracion",
  facturacion: "administracion",
  albaranes: "administracion",
  "vencimientos-factura": "administracion",
  compras: "administracion",
  productos: "administracion",
  bodegas: "administracion",
  kardex: "administracion",
  documentos: "administracion",
  gastos: "administracion",
  desplazamientos: "administracion",
  inventario: "administracion",
  mantenimiento: "administracion",
  cau: "administracion",
  kb: "administracion",
  tickets: "administracion",
  // Analítica — reportes y métricas
  reportes: "analitica",
  "estadistica-ventas": "analitica",
  encuestas: "analitica",
  // Configuración — accesos del usuario (asistente, ajustes, perfil, equipo)
  equipo: "configuracion",
  ajustes: "configuracion",
  "ajustes-cuenta": "configuracion",
  "ajustes-campos": "configuracion",
  workflows: "configuracion",
  integraciones: "configuracion",
  asistente: "configuracion",
  empleados: "configuracion",
  personal: "configuracion",
  // Maestros — tablas de catálogo y configuración avanzada (uso esporádico)
  "catalogo-servicios": "maestros",
  aplicaciones: "maestros",
  etiquetas: "maestros",
  plantillas: "maestros",
  "tarifas-generales": "maestros",
  "tarifas-especiales": "maestros",
  "clases-condicion": "maestros",
  "formas-pago": "maestros",
  "cuentas-bancarias": "maestros",
  "tipos-cliente": "maestros",
  // TEST-12 #2 — `tipos-servicio` retirado del menú (módulo enabled:false).
  // Se deja la entrada por compatibilidad si algún tenant lo reactiva.
  "tipos-servicio": "maestros",
  "tipos-urgencia": "maestros",
  "actividades-catalogo": "maestros",
  "zonas-comerciales": "maestros",
  "grupos-empresa": "maestros",
};
function categoriaDe(moduleKey: string): SidebarCategory {
  return MODULE_CATEGORY[moduleKey] || "operacion";
}

// TEST-17 — MODULE_ICON ahora se importa desde `@/lib/ui/module-icons`.
// Esta posición se reservaba para la definición local (eliminada).

const FALLBACK_LABELS: Record<string, string> = {
  clientes: "Clientes",
  crm: "Oportunidades",
  proyectos: "Proyectos",
  produccion: "Producción",
  presupuestos: "Propuestas",
  "pre-facturacion": "Pre-facturación",
  facturacion: "Facturas",
  documentos: "Documentos",
  reportes: "Reportes",
  "catalogo-servicios": "Catálogo de servicios",
  asistente: "Asistente",
  equipo: "Equipo",
  ajustes: "Ajustes",
  // SCHOOL-03
  docentes: "Docentes",
  horarios: "Horarios",
  planeaciones: "Planeaciones",
  calificaciones: "Calificaciones",
  asistencia: "Asistencia",
  disciplina: "Convivencia",
  orientacion: "Orientación",
  enfermeria: "Enfermería",
  transporte: "Transporte",
  comedor: "Comedor",
  biblioteca: "Biblioteca",
  actividades: "Extracurriculares",
  salidas: "Salidas",
  becas: "Becas",
  comunicaciones: "Comunicaciones",
  eventos: "Calendario",
  visitantes: "Visitantes",
  tramites: "Trámites",
  inventario: "Inventario",
  mantenimiento: "Mantenimiento",
  personal: "Personal",
  egresados: "Egresados",
  // CORE-03 — TEST-14 tareas → "Asignaciones".
  tareas: "Asignaciones",
  tickets: "Tickets",
  compras: "Compras",
  productos: "Productos",
  reservas: "Reservas",
  encuestas: "Encuestas",
  etiquetas: "Etiquetas",
  plantillas: "Plantillas",
};

// Módulos "virtuales" que no vienen del pack (no tienen entrada en
// config.modules) pero sí tienen página propia. Los mostramos siempre.
const VIRTUAL_MODULES = new Set(["produccion"]);

// TEST-5.S — Módulos universales del runtime que están disponibles para
// CUALQUIER vertical aunque el pack no los enumere (ej. Reportes,
// Buscar global, etc.). No requieren entrada en config.modules.
// TEST-6.4.a — Añadida "pre-facturacion" (vive como sub-ruta de /produccion).
const UNIVERSAL_MODULES = new Set(["reportes", "pre-facturacion"]);

// TEST-6.4.a — Algunos items del sidebar no usan la convención
// /<vertical>/<key>. Para esos, se especifica aquí el path final.
const MODULE_HREF_OVERRIDE: Record<string, string> = {
  "pre-facturacion": "/produccion/pre-facturacion",
};

// Módulos que viven SOLO dentro del hub /produccion (tabs internas).
// El pack los marca como enabled para que existan como módulos del ERP
// y se persistan registros, pero NO tienen página propia /<key> — el
// usuario los ve como tabs dentro de /produccion. Los excluimos del
// sidebar para evitar 404 (SF-20).
//
// CORE-03: "tareas" se quitó de aquí porque ahora es módulo universal
// del CORE con su propia página /tareas. Sigue accesible como tab
// dentro de /produccion además, sin conflicto.
const HUB_CHILDREN_MODULES = new Set([
  "incidencias",
  "actividades",
  "versiones",
  "mantenimientos",
  "justificantes",
  "descripciones-proyecto",
]);

// TEST-5.S — Módulos declarados en el pack pero SIN página propia en el
// runtime (la ruta /[vertical]/<key> no existe). Se ocultan del sidebar
// para evitar el 404 al pulsar.
// TEST-5bis — Avisos / Gastos / Vencimientos / Desplazamientos / Empleados
// añadidos con stubs.
// TEST-7.1.h — Los 17 módulos restantes (maestros, administración y analítica)
// también tienen stub "En construcción". El set queda vacío de forma
// intencionada: cada nuevo módulo del pack debe llevar al menos un stub.
const MODULES_WITHOUT_ROUTE = new Set<string>([]);

function readQueryParams() {
  if (typeof window === "undefined") return { tenant: "", sectorPack: "" };
  const sp = new URLSearchParams(window.location.search);
  return {
    tenant: String(sp.get("tenant") || "").trim(),
    sectorPack: String(sp.get("sectorPack") || "").trim(),
  };
}

function buildHref(base: string, params: { tenant: string; sectorPack: string; vertical: string | null }) {
  // H13-A: si hay vertical, prefijamos las rutas tenant-runtime con
  // /{vertical}/. La home del tenant (/) se convierte en /{vertical}.
  // Las rutas que ya empiezan por /factory/ o /api/ NO se prefijan.
  let path = base;
  if (params.vertical) {
    if (path === "/") {
      path = "/" + params.vertical;
    } else if (path.startsWith("/") && !path.startsWith("/factory") && !path.startsWith("/api") && !path.startsWith("/" + params.vertical)) {
      path = "/" + params.vertical + path;
    }
  }
  const qs: string[] = [];
  if (params.tenant) qs.push("tenant=" + encodeURIComponent(params.tenant));
  if (params.sectorPack) qs.push("sectorPack=" + encodeURIComponent(params.sectorPack));
  return qs.length === 0 ? path : path + "?" + qs.join("&");
}

export default function TenantSidebar() {
  const pathname = usePathname() || "/";
  const { vertical } = useCurrentVertical();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paramsBase, setParamsBase] = useState({ tenant: "", sectorPack: "" });
  const params = { ...paramsBase, vertical };
  // H12-E: expansion por categoría (Maestros arranca colapsada).
  const [expandedCats, setExpandedCats] = useState<Record<SidebarCategory, boolean>>(() => {
    const init: Record<SidebarCategory, boolean> = {
      operacion: true,
      administracion: true,
      analitica: true,
      configuracion: true,
      maestros: false,
    };
    return init;
  });

  useEffect(() => {
    setParamsBase(readQueryParams());
    if (typeof window !== "undefined") {
      try {
        setCollapsed(window.localStorage.getItem("prontara-sidebar-collapsed") === "1");
      } catch { /* ignore */ }
      // Restaurar expanded por categoría
      try {
        const raw = window.localStorage.getItem("prontara-sidebar-cats");
        if (raw) {
          const stored = JSON.parse(raw) as Partial<Record<SidebarCategory, boolean>>;
          setExpandedCats((prev) => ({ ...prev, ...stored }));
        }
      } catch { /* ignore */ }
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("prontara-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      // Notifica al shell para que ajuste el margin del main
      window.dispatchEvent(new CustomEvent("prontara-sidebar-toggle", { detail: { collapsed: next } }));
    }
  }

  function toggleCategory(cat: SidebarCategory) {
    setExpandedCats((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      if (typeof window !== "undefined") {
        try { window.localStorage.setItem("prontara-sidebar-cats", JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const qs: string[] = [];
    if (paramsBase.tenant) qs.push("tenant=" + encodeURIComponent(paramsBase.tenant));
    if (paramsBase.sectorPack) qs.push("sectorPack=" + encodeURIComponent(paramsBase.sectorPack));
    const url = "/api/runtime/tenant-config" + (qs.length ? "?" + qs.join("&") : "");

    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.config) {
          setConfig(data.config as RuntimeConfig);
        }
      })
      .catch(() => {
        // Silencioso: dejamos los fallbacks.
      });

    return () => {
      cancelled = true;
    };
  }, [paramsBase.tenant, paramsBase.sectorPack]);

  // Construir la lista de módulos a partir de config (orden por MODULE_ORDER + extras al final).
  const moduleItems: Array<{ href: string; label: string; moduleKey: string; icon: string }> = [];
  const labelFor = (key: string): string =>
    config?.navigationLabelMap?.[key] ||
    config?.labels?.[key] ||
    FALLBACK_LABELS[key] ||
    key.charAt(0).toUpperCase() + key.slice(1);

  // Orden canónico
  const seen = new Set<string>();
  for (const key of MODULE_ORDER) {
    if (seen.has(key)) continue;
    // TEST-5.S — Saltar módulos sin ruta para evitar 404.
    if (MODULES_WITHOUT_ROUTE.has(key)) continue;
    if (VIRTUAL_MODULES.has(key)) {
      // Solo mostramos producción si el vertical lo soporta. Lo deducimos:
      // si "tareas" o "incidencias" están activas en el pack, hay
      // producción. En caso contrario lo ocultamos.
      if (config) {
        const tareas = config.modules.find((mm) => mm.moduleKey === "tareas");
        const incidencias = config.modules.find((mm) => mm.moduleKey === "incidencias");
        const enabled =
          (tareas && tareas.enabled !== false) ||
          (incidencias && incidencias.enabled !== false);
        if (!enabled) continue;
      }
    } else if (UNIVERSAL_MODULES.has(key)) {
      // TEST-5.S — Módulos universales siempre visibles, independiente del pack.
    } else if (config) {
      // FIX-SIDEBAR: solo mostramos módulos que el pack del tenant
      // habilita explícitamente. Si el módulo NO está en config.modules
      // (porque pertenece a otro vertical) o está deshabilitado, lo
      // saltamos. Antes el bug permitía ver módulos de COLEGIO en SF
      // porque MODULE_ORDER los listaba y la condición previa
      // (m && m.enabled === false) los dejaba pasar al ser m undefined.
      const m = config.modules.find((mm) => mm.moduleKey === key);
      if (!m || m.enabled === false) continue;
    } else {
      // Sin config (cargando): no mostramos nada del catálogo de módulos
      // para evitar el flash de "todos los módulos del mundo". El usuario
      // verá brevemente solo Inicio + Buscar mientras llega la respuesta.
      continue;
    }
    moduleItems.push({
      href: buildHref(MODULE_HREF_OVERRIDE[key] || ("/" + key), params),
      label: labelFor(key),
      moduleKey: key,
      icon: MODULE_ICON[key] || "📌",
    });
    seen.add(key);
  }

  // Fallback: módulos del pack que NO están en MODULE_ORDER ni son
  // virtuales — los añadimos al final para no perder módulos custom
  // de futuros verticales sin tener que tocar este array. Por ejemplo,
  // si un pack añade "stock", "rutas" o "consultas", aparecerán aquí.
  // Excluimos los hijos del hub /produccion porque no tienen página
  // propia (SF-20).
  if (config) {
    for (const m of config.modules) {
      if (!m || m.enabled === false) continue;
      const k = m.moduleKey;
      if (!k || seen.has(k)) continue;
      if (VIRTUAL_MODULES.has(k)) continue;
      if (HUB_CHILDREN_MODULES.has(k)) continue;
      // TEST-5.S — saltar módulos sin ruta real.
      if (MODULES_WITHOUT_ROUTE.has(k)) continue;
      moduleItems.push({
        href: buildHref("/" + k, params),
        label: labelFor(k),
        moduleKey: k,
        icon: MODULE_ICON[k] || "📌",
      });
      seen.add(k);
    }
  }

  const accent = config?.branding?.accentColor || "#1d4ed8";
  const displayName = config?.branding?.displayName || "Prontara";

  function isActive(href: string): boolean {
    // href puede llevar query string; comparamos solo el pathname.
    const path = href.split("?")[0];
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  // H12-B — Bloque visual común. Si collapsed, oculta labels y categorías.
  const navContent = (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: collapsed ? "16px 8px 12px" : "20px 12px 16px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Logo con icono hexagonal */}
      <Link
        href={buildHref("/", params)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "0 0 14px" : "0 8px 16px",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: 14,
          textDecoration: "none",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
        title={displayName}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: accent,
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {(displayName || "P").charAt(0).toUpperCase()}
        </span>
        {!collapsed ? (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              color: "#0f172a",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: -0.2,
              lineHeight: 1.15,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>
              Panel del cliente
            </div>
          </div>
        ) : null}
      </Link>

      {FIXED_TOP.map((item) => {
        const href = buildHref(item.href, params);
        const active = isActive(href);
        return (
          <Link
            key={item.moduleKey}
            href={href}
            title={collapsed ? item.label : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: collapsed ? "10px 0" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? "#ffffff" : "#374151",
              background: active ? accent : "transparent",
              fontWeight: active ? 700 : 500,
              fontSize: 14,
            }}
            onClick={() => setOpen(false)}
          >
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            {!collapsed ? <span>{item.label}</span> : null}
          </Link>
        );
      })}

      {/* H12-B + H12-E — Módulos agrupados por categoría (5 categorías; Maestros colapsable) */}
      {CATEGORY_ORDER.map((cat) => {
        const items = moduleItems.filter((m) => categoriaDe(m.moduleKey) === cat);
        if (items.length === 0) return null;
        const hasActiveItem = items.some((it) => isActive(it.href));
        // Si sidebar colapsada → siempre visible (solo iconos, da igual).
        // Si hay item activo dentro → expandida (no esconder al usuario donde está).
        // Si no, respetar elección del usuario (Maestros arranca false).
        const isExpanded = collapsed ? true : expandedCats[cat] !== false;
        return (
          <div key={cat} style={{ marginTop: 10 }}>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 12px 6px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 700,
                  color: hasActiveItem ? "#475569" : "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                  textAlign: "left",
                }}
                aria-expanded={isExpanded}
              >
                <span>{CATEGORY_LABEL[cat]}</span>
                <span style={{ fontSize: 9, transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 120ms ease" }}>▾</span>
              </button>
            ) : (
              <div style={{ borderTop: "1px solid #f1f5f9", margin: "8px 4px" }} />
            )}
            {isExpanded ? items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.moduleKey}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: collapsed ? "8px 0" : "7px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: active ? "#ffffff" : "#374151",
                    background: active ? accent : "transparent",
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                  }}
                  onClick={() => setOpen(false)}
                >
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed ? (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              );
            }) : null}
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Botón Colapsar al fondo */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "10px 0" : "9px 12px",
          marginTop: 8,
          borderTop: "1px solid #e5e7eb",
          paddingTop: 12,
          background: "transparent",
          border: "none",
          borderTopColor: "#e5e7eb",
          borderTopWidth: 1,
          borderTopStyle: "solid",
          color: "#6b7280",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{collapsed ? "›" : "‹"}</span>
        {!collapsed ? <span>Colapsar</span> : null}
      </button>
    </nav>
  );

  return (
    <>
      {/* Botón hamburguesa solo en mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="prontara-sidebar-toggle"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 60,
          width: 40,
          height: 40,
          border: "1px solid #d1d5db",
          background: "#ffffff",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 18,
          display: "none", // se hace visible vía media query al final
        }}
      >
        ☰
      </button>

      {/* Sidebar fija en desktop */}
      <aside
        className="prontara-sidebar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: collapsed ? 64 : 240,
          height: "100vh",
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          overflowX: "hidden",
          zIndex: 40,
          transition: "width 180ms ease",
        }}
      >
        {navContent}
      </aside>

      {/* Drawer en mobile */}
      {open ? (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              zIndex: 70,
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 280,
              height: "100vh",
              background: "#ffffff",
              borderRight: "1px solid #e5e7eb",
              overflowY: "auto",
              zIndex: 80,
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ×
            </button>
            {navContent}
          </aside>
        </>
      ) : null}

      {/* Media query para mostrar el botón en pantallas pequeñas y ocultar la sidebar fija */}
      <style>{`
        @media (max-width: 900px) {
          .prontara-sidebar { display: none !important; }
          .prontara-sidebar-toggle { display: inline-flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
    </>
  );
}
