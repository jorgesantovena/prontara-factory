"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";
// TEST-16 — singular() centralizado en src/lib/text/singular.ts. Antes
// había una copia duplicada en este fichero y otra en
// generic-module-runtime-page.tsx que se desincronizaban al añadir
// overrides (Pedro: "Asignacione" en vez de "Asignación").
import { singular } from "@/lib/text/singular";

/**
 * Editor full-page para crear/editar un registro de cualquier módulo.
 * Reemplaza al modal slideover (H12-G — diseño mockup).
 *
 * Layout:
 *   1. Breadcrumb "{Módulo} / {Módulo} / Nuevo {singular}"
 *   2. Header: título + estrella favorito + pill "No guardado" si dirty
 *      + botones [Cancelar] [Guardar y nuevo] [Guardar]
 *   3. Tabs (Datos generales / Contactos / Comercial / Financiero / Notas / Documentos)
 *      — agrupados auto por heurística sobre fieldKey para no tocar los packs.
 *   4. Layout 2 columnas:
 *        - Izquierda: grid 2-cols con los campos del tab activo
 *        - Derecha: cards de info rápida + estadísticas (solo en edición)
 *
 * Mantiene la misma firma que ErpRecordModal para que el componente
 * que lo usa (generic-module-runtime-page) pueda swap directo.
 */

// TEST-11 — añadido "time" (hh:mm) y flags readOnly / inheritFrom /
// computed / visibleWhen para el rediseño del Parte de horas.
type FieldKind = "text" | "email" | "tel" | "textarea" | "date" | "time" | "number" | "money" | "status" | "relation";

type UiFieldDefinition = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  relationModuleKey?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  // TEST-11 — Marca el campo como solo-salida (heredado, calculado o
  // actualizado por proceso): se renderiza deshabilitado.
  readOnly?: boolean;
  // TEST-11 — Cuando el usuario elige el valor del campo `from` (debe ser
  // una relación), el editor lee el registro destino y copia `field` en
  // este campo. Ej.: cliente ← proyecto.cliente, km ← cliente.kilometrosBase.
  inheritFrom?: { from: string; field: string };
  // TEST-11/13 — Cálculo automático. Soportados:
  //   - { type: "duration", from, to }: produce "hh:mm" / decimal entre dos horas.
  //   - { type: "derived", from, map, default }: copia el valor del campo
  //     `from` mapeado por `map`; si no hay match usa `default`.
  computed?:
    | { type: "duration"; from: string; to: string }
    | { type: "derived"; from: string; map?: Record<string, string>; default?: string };
  // TEST-11 — Visibilidad condicional: el campo solo se muestra si otro
  // campo del registro tiene uno de los valores indicados.
  visibleWhen?: { field: string; equals: string | string[] };
  // TEST-13 E — Required condicional y default al crear.
  requiredWhen?: { field: string; equals: string | string[] };
  defaultValue?: string;
};

type OptionItem = { value: string; label: string };

// TEST-3.8 — "proyectos" añadido como tab virtual (no agrupa fields, igual
// que "documentos"). Solo visible cuando moduleKey === "clientes" y el
// cliente ya tiene id (mode === "edit").
// TEST-15 E.2 — "propuestas" añadida como tab virtual (no agrupa fields).
// Solo visible cuando moduleKey === "crm" && mode === "edit" — lista las
// propuestas vinculadas a la oportunidad y permite añadir desde el mismo
// editor (mismo patrón que la sublista Contactos y Proyectos).
// Preguntas 1.con / mail 2 puntos 7+8 — Gastos y Desplazamientos como
// pestañas dentro de la ficha de Tarea (heredan fecha/empleado/cliente/
// proyecto al añadir, y la opción del MP sigue activa para los casos sin
// tarea). Las tabs se renderizan solo cuando moduleKey === "actividades".
type TabKey = "general" | "contacto" | "comercial" | "financiero" | "notas" | "proyectos" | "propuestas" | "gastos" | "desplazamientos" | "vencimientos" | "zonas" | "documentos";

const TAB_LABELS: Record<TabKey, string> = {
  general: "Datos generales",
  contacto: "Contactos",
  comercial: "Comercial",
  financiero: "Financiero",
  notas: "Notas",
  proyectos: "Proyectos",
  propuestas: "Propuestas",
  gastos: "Gastos",
  desplazamientos: "Desplazamientos",
  // Preguntas 1.con / mail 2 punto 9 — Pestaña Vencimientos en la
  // ficha de Factura (sublista filtrada por número de factura, con
  // cobro manual; el trigger del backend marca la Factura como cobrada
  // cuando se cobra el último).
  vencimientos: "Vencimientos",
  // Test 18 bis 2 E — Pestaña Zonas en la ficha de Empleado (solo
  // cuando el Rol contenga "comercial"). Lista las zonas-comerciales
  // cuyo agenteResponsable es este empleado.
  zonas: "Zonas",
  documentos: "Documentos",
};

// TEST-11 — Calcula duración entre dos horas "hh:mm" o "hh:mm:ss" y la
// devuelve formateada en DECIMAL con coma (1,50) — TEST-12 #1: Pedro
// quiere que el Tiempo sea operable aritméticamente en base 10. Si
// alguna falta o el rango es negativo, devuelve "" para no enseñar
// basura al usuario. Helper a nivel de módulo para que pueda usarse
// tanto en el reset useEffect como en setField.
function computeDurationStatic(desde: string, hasta: string): string {
  if (!desde || !hasta) return "";
  const toMin = (s: string): number => {
    const [hh = "0", mm = "0"] = String(s).split(":");
    return parseInt(hh, 10) * 60 + parseInt(mm, 10);
  };
  const diff = toMin(hasta) - toMin(desde);
  if (!Number.isFinite(diff) || diff <= 0) return "";
  // Convertir minutos a horas decimal con 2 decimales (90 min → 1.50)
  // y representar con coma como separador (formato español).
  const horas = diff / 60;
  return horas.toFixed(2).replace(".", ",");
}

function classifyField(key: string): TabKey {
  const k = String(key ?? "").toLowerCase();
  // TEST-2.5 — dirección, población, CP, provincia, país NO van en
  // "contacto" sino en "general" (son datos de la empresa/cliente, no
  // del interlocutor humano que es un contacto independiente).
  if (k.includes("telefono") || k.includes("tel") || k.includes("email") ||
      k.includes("contacto") || k.includes("web") || k.includes("sitio")) {
    return "contacto";
  }
  if (k.includes("importe") || k.includes("saldo") || k.includes("credito") ||
      k.includes("iban") || k.includes("forma") || k.includes("tarifa") ||
      k.includes("cuenta") || k.includes("vencimiento") || k.includes("descuento") ||
      k.includes("recargo") || k.includes("precio") || k.includes("moneda") ||
      k === "iva" || k === "irpf") {
    return "financiero";
  }
  if (k.includes("vendedor") || k.includes("comercial") || k.includes("zona") ||
      k.includes("grupo") || k.includes("origen") || k === "tipo" ||
      k.includes("segmento") || k.includes("responsable") || k.includes("ejecutivo")) {
    return "comercial";
  }
  if (k.includes("nota") || k.includes("observ") || k.includes("comment") ||
      k.includes("descripcion")) {
    return "notas";
  }
  return "general";
}

export default function ErpRecordEditor({
  mode,
  moduleKey,
  moduleLabel,
  fields,
  initialValue,
  tenant,
  accent = "#1d4ed8",
  onCancel,
  onSubmit,
  initialTab,
  autoStartContact,
}: {
  mode: "create" | "edit";
  moduleKey: string;
  moduleLabel: string;
  fields: UiFieldDefinition[];
  initialValue?: Record<string, string> | null;
  tenant?: string;
  accent?: string;
  onCancel: () => void;
  onSubmit: (payload: Record<string, string>, options?: { andNew?: boolean }) => Promise<void> | void;
  // TEST-8bis.1.b — Permite al padre forzar tab y autostart de la sublista
  // de contactos al montar (usado en el encadenado de oportunidades).
  initialTab?: string;
  autoStartContact?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionItem[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<TabKey>("general");
  const [favorite, setFavorite] = useState(false);
  // TEST-6.1.d — link helper para "Convertir en proyecto" desde presupuestos.
  const { link: vlink } = useCurrentVertical();

  // Agrupa fields por tab. "proyectos" y "documentos" son tabs virtuales
  // (no agrupan fields del registro — tienen contenido propio).
  // TEST-6.1.a — Si un tab no-general acaba con un solo field (caso típico
  // de "Financiero" con solo "Importe" en propuestas), promovemos ese field
  // a "general" para no mostrar un tab semi-vacío. Excepción: "contacto" en
  // clientes, que aunque no tenga fields del pack siempre muestra la sublista.
  const grouped = useMemo(() => {
    const acc: Record<TabKey, UiFieldDefinition[]> = {
      // Preguntas 1.con / mail 2 puntos 7+8 — gastos y desplazamientos
      // añadidos al record. Si moduleKey !== "actividades" no se ven
      // (el filtro `tabsConFields` solo incluye tabs con fields, y los
      // bloques de render por tab incluyen también la condición moduleKey).
      general: [], contacto: [], comercial: [], financiero: [], notas: [], proyectos: [], propuestas: [], gastos: [], desplazamientos: [], vencimientos: [], zonas: [], documentos: [],
    };
    // TEST-11 — En el Parte de horas (actividades) el orden EXACTO de
    // campos que define el sector pack importa (Empleado → Fecha → Hora
    // desde → Hora hasta → Tiempo → Lugar → Proyecto → Cliente → ...).
    // Si dejamos que `classifyField` reparta por tabs, "tarifa" y similares
    // se irían a Financiero y se rompería el orden. Forzamos todo a
    // "general" para respetar el orden del pack.
    const forceSingleTab = moduleKey === "actividades";
    for (const f of fields) {
      const tab = forceSingleTab ? "general" : classifyField(f.key);
      acc[tab].push(f);
    }
    // Collapse de tabs con 1 solo field a "general" (no aplica al propio general,
    // ni a tabs virtuales, ni a "contacto" cuando es módulo clientes — la
    // sublista de contactos puede coexistir con el grid de fields).
    const collapsibles: TabKey[] = ["comercial", "financiero", "notas"];
    if (!(moduleKey === "clientes")) collapsibles.unshift("contacto");
    for (const t of collapsibles) {
      if (acc[t].length === 1) {
        acc.general.push(acc[t][0]);
        acc[t] = [];
      }
    }
    return acc;
  }, [fields, moduleKey]);

  // TEST-1.5 — Tabs visibles. "Documentos" solo se muestra si hay otras
  // tabs con fields (no como única tab — antes salía sola si fields=[]).
  // TEST-3.8 — "Proyectos" se añade entre las otras tabs y Documentos
  // cuando moduleKey === "clientes" y el cliente ya tiene id.
  const tabsConFields = (Object.keys(TAB_LABELS) as TabKey[]).filter((t) => grouped[t].length > 0);
  const showProyectosTab = moduleKey === "clientes" && mode === "edit" && Boolean(initialValue?.id);
  // TEST-15 E.2 — Tab "Propuestas" en la ficha de Oportunidad (crm).
  const showPropuestasTab = moduleKey === "crm" && mode === "edit" && Boolean(initialValue?.id);
  // Preguntas 1.con / mail 2 puntos 7+8 — Tabs Gastos y Desplazamientos
  // SOLO en la ficha de Tarea (actividades) y solo en EDIT (necesitamos
  // el id de la tarea para filtrar). En CREATE no se muestran porque la
  // tarea aún no existe; el usuario primero guarda y luego añade gastos.
  const showGastosTab = moduleKey === "actividades" && mode === "edit" && Boolean(initialValue?.id);
  const showDesplazTab = moduleKey === "actividades" && mode === "edit" && Boolean(initialValue?.id);
  // Preguntas 1.con / mail 2 punto 9 — Pestaña Vencimientos en Factura
  // (mode === "edit": necesitamos el número/id para filtrar).
  const showVencimientosTab = moduleKey === "facturacion" && mode === "edit" && Boolean(initialValue?.id);
  // Test 18 bis 2 E — Pestaña Zonas en Empleado SOLO si rol contiene
  // "comercial". El filtro busca zonas-comerciales cuyo agenteResponsable
  // coincida con el nombre del empleado.
  const showZonasTab = moduleKey === "empleados" && mode === "edit" && Boolean(initialValue?.id) &&
    String(values.rol || initialValue?.rol || "").toLowerCase().includes("comercial");
  const visibleTabs: TabKey[] = tabsConFields.length > 0
    ? [
        ...tabsConFields,
        ...(showProyectosTab ? ["proyectos" as TabKey] : []),
        ...(showPropuestasTab ? ["propuestas" as TabKey] : []),
        ...(showGastosTab ? ["gastos" as TabKey] : []),
        ...(showDesplazTab ? ["desplazamientos" as TabKey] : []),
        ...(showVencimientosTab ? ["vencimientos" as TabKey] : []),
        ...(showZonasTab ? ["zonas" as TabKey] : []),
        "documentos" as TabKey,
      ]
    : []; // sin fields → no mostramos tabs, mostramos mensaje (ver render)

  // Reset valores al cambiar mode/initialValue/fields
  useEffect(() => {
    const next: Record<string, string> = {};
    // TEST-6.1.b + 6.2.a — En modo "create", precargar con la fecha de hoy
    // los campos de fecha "de alta/envío/emisión/inicio" (los que tienen
    // sentido tomar el día actual por defecto). NO se aplica a
    // fechaCaducidad / fechaLimite / fechaVencimiento / fechaEntrega etc.,
    // que se rellenan a futuro.
    const TODAY_DEFAULT_DATE_FIELDS = new Set([
      "fechaEnvio", "fechaEmision", "fechaInicio", "fechaAlta", "fechaCreacion",
      "fecha_alta", "fechaApertura",
      // TEST-11 — Parte de horas: "fecha" del registro asume HOY por defecto.
      "fecha",
    ]);
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const f of fields) {
      const initVal = initialValue?.[f.key];
      if (initVal != null && String(initVal) !== "") {
        next[f.key] = String(initVal);
      } else if (mode === "create" && f.kind === "date" && TODAY_DEFAULT_DATE_FIELDS.has(f.key)) {
        next[f.key] = todayIso;
      } else if (mode === "create" && f.defaultValue) {
        // TEST-13 E — Valor por defecto al crear (Estado=activo,
        // fechaCaducidad=9999-12-31, etc.).
        next[f.key] = f.defaultValue;
      } else {
        next[f.key] = String(initVal ?? "");
      }
    }
    // TEST-11 fix #9 — Recalcular campos computed.duration en la carga
    // inicial. Si un registro viene de BD/import con horaDesde/horaHasta
    // pero tiempoHoras vacío, queremos verlo lleno desde el primer render
    // sin esperar a que el usuario teclee algo.
    // TEST-13 E — También aplicar computed.derived al cargar
    // (Facturable=f(tipoFacturacion) etc.).
    for (const f of fields) {
      if (f.computed?.type === "duration") {
        const current = String(next[f.key] || "").trim();
        if (!current) {
          const desde = String(next[f.computed.from] || "");
          const hasta = String(next[f.computed.to] || "");
          const computed = computeDurationStatic(desde, hasta);
          if (computed) next[f.key] = computed;
        }
      } else if (f.computed?.type === "derived") {
        const fromVal = String(next[f.computed.from] || "");
        const mapped = f.computed.map?.[fromVal];
        const value = mapped ?? f.computed.default ?? "";
        if (value) next[f.key] = value;
      }
    }
    // TEST-12 #3 — Si hay un borrador guardado en sessionStorage para
    // este editor concreto (módulo + modo + id), restaurarlo encima de
    // los valores recién calculados. Esto permite saltar entre tabs
    // (Parte de horas → Catálogo de actividades → volver) sin perder
    // lo que el usuario tenía a medio escribir.
    if (typeof window !== "undefined") {
      try {
        const draftKey = "prontara-draft:" + moduleKey + ":" + (mode === "edit" ? String(initialValue?.id || "edit") : "new");
        const raw = window.sessionStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as Record<string, string>;
          if (draft && typeof draft === "object") {
            for (const k of Object.keys(draft)) {
              next[k] = String(draft[k] ?? "");
            }
          }
        }
      } catch { /* draft corrupto o sessionStorage no disponible: ignorar */ }
    }
    setValues(next);
    setDirty(false);
    setError("");
    // Tab inicial: primera tab con fields, NUNCA "documentos" como default.
    // TEST-8bis.1.b — si el padre fuerza `initialTab`, se respeta.
    const valid = initialTab && (Object.keys(TAB_LABELS) as TabKey[]).includes(initialTab as TabKey)
      ? (initialTab as TabKey)
      : null;
    setTab(valid || tabsConFields[0] || "general");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fields, initialValue, initialTab]);

  // Test 18 bis 4 — Cascada transitiva tarea → cliente → kilometrosBase
  // al CARGAR el editor (no solo al teclear). Pedro vio "Km no se hereda
  // en Desplazamientos" porque el field `tarea` es readOnly: viene por
  // prefill (no por edición), así que el handler de cascada del setField
  // nunca se disparaba. Aquí ejecutamos el lookup justo después de que
  // values queda asignado, si hay tarea preasignada. Idem en Gastos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!values.tarea) return;
    if (moduleKey !== "desplazamientos" && moduleKey !== "gastos") return;
    const fieldsFromTarea = fields.filter((f) => f.inheritFrom?.from === "tarea");
    const fieldsFromCliente = fields.filter((f) => f.inheritFrom?.from === "cliente");
    if (fieldsFromTarea.length === 0 && fieldsFromCliente.length === 0) return;
    let cancelled = false;
    (async () => {
      const tareaRec = await loadRelatedRecord("actividades", String(values.tarea));
      if (cancelled || !tareaRec) return;
      // Aplica los campos heredados directos de la tarea (facturable, etc.).
      if (fieldsFromTarea.length > 0) {
        setValues((v) => {
          const nx: Record<string, string> = { ...v };
          for (const f of fieldsFromTarea) {
            const incoming = String(tareaRec[f.inheritFrom!.field] || "");
            if (incoming) nx[f.key] = incoming;
          }
          return nx;
        });
      }
      // Segundo salto: tarea.cliente → cliente.kilometrosBase, etc.
      if (fieldsFromCliente.length > 0) {
        const clienteRef = String(tareaRec.cliente || "");
        if (!clienteRef) return;
        const clienteRec = await loadRelatedRecord("clientes", clienteRef);
        if (cancelled || !clienteRec) return;
        setValues((v) => {
          const nx: Record<string, string> = { ...v };
          for (const f of fieldsFromCliente) {
            const incoming = String(clienteRec[f.inheritFrom!.field] || "");
            if (incoming) nx[f.key] = incoming;
          }
          return nx;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [values.tarea, moduleKey, fields]);

  // Cargar opciones de relación
  useEffect(() => {
    let cancelled = false;
    async function loadRelations() {
      const relationFields = fields.filter((f) => f.kind === "relation" && f.relationModuleKey);
      for (const f of relationFields) {
        try {
          const r = await fetch(
            "/api/erp/options?module=" + encodeURIComponent(String(f.relationModuleKey || "")) +
            (tenant ? "&tenant=" + encodeURIComponent(tenant) : ""),
            { cache: "no-store" },
          );
          const d = await r.json();
          if (!cancelled && r.ok && d.ok) {
            setOptionsMap((cur) => ({ ...cur, [f.key]: Array.isArray(d.options) ? d.options : [] }));
          }
        } catch { /* ignore */ }
      }
    }
    loadRelations();
    return () => { cancelled = true; };
  }, [fields, tenant]);

  // TEST-12 #3 — Autosave del draft a sessionStorage cada vez que
  // cambian los `values`. Permite que al saltar a otra tab y volver, el
  // formulario aparezca con lo que el usuario tenía escrito. El draft
  // se limpia al guardar o cancelar (ver doSubmit y onCancel).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dirty) return; // no guardar el draft inicial (no aporta y crea ruido)
    try {
      const draftKey = "prontara-draft:" + moduleKey + ":" + (mode === "edit" ? String(initialValue?.id || "edit") : "new");
      window.sessionStorage.setItem(draftKey, JSON.stringify(values));
    } catch { /* sessionStorage no disponible */ }
  }, [values, dirty, moduleKey, mode, initialValue]);

  function clearDraft() {
    if (typeof window === "undefined") return;
    try {
      const draftKey = "prontara-draft:" + moduleKey + ":" + (mode === "edit" ? String(initialValue?.id || "edit") : "new");
      window.sessionStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  }

  // TEST-11 — Caché de records relacionados que ya hemos pedido para
  // resolver herencia (proyecto → cliente / facturable / tipoFacturacion /
  // tarifaHora; cliente → kilometrosBase). Evita re-fetch en cada cambio.
  const [relatedRecordsCache, setRelatedRecordsCache] = useState<
    Record<string, Record<string, Record<string, string>>>
  >({});

  async function loadRelatedRecord(modKey: string, recordRef: string): Promise<Record<string, string> | null> {
    if (!modKey || !recordRef) return null;
    const cached = relatedRecordsCache[modKey]?.[recordRef];
    if (cached) return cached;
    try {
      const url = "/api/erp/module?module=" + encodeURIComponent(modKey) +
        (tenant ? "&tenant=" + encodeURIComponent(tenant) : "");
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok || !Array.isArray(d.rows)) return null;
      // TEST-11 fix #1 — `/api/erp/options` devuelve como `value` el campo
      // principal del registro: `nombre` para clientes/proyectos, `numero`
      // para presupuestos, `id` para el resto. Cuando aquí recibimos el
      // valor que el dropdown guardó, hay que buscar por TODOS esos campos,
      // no solo por id. Si no, la herencia (cliente, facturable, tarifa,
      // km) nunca se activa porque el find devolvía siempre undefined.
      const ref = String(recordRef);
      const rows = d.rows as Array<Record<string, string>>;
      const record = rows.find((row) => String(row.id || "") === ref)
        || rows.find((row) => String(row.nombre || "") === ref)
        || rows.find((row) => String(row.codigo || "") === ref)
        || rows.find((row) => String(row.numero || "") === ref)
        || rows.find((row) => String(row.titulo || "") === ref);
      if (!record) return null;
      setRelatedRecordsCache((c) => ({
        ...c,
        [modKey]: { ...(c[modKey] || {}), [recordRef]: record },
      }));
      return record;
    } catch {
      return null;
    }
  }

  // TEST-11 — Alias local que apunta a la helper de módulo (declarada al
  // final del fichero como function expression no hoisted). Mantengo el
  // nombre `computeDuration` para no cambiar todos los call-sites.
  const computeDuration = computeDurationStatic;

  function setField(key: string, value: string) {
    setValues((v) => {
      const next: Record<string, string> = { ...v, [key]: value };
      // TEST-11 — Recalcular campos computed.duration cuya from/to es `key`.
      // TEST-13 E — También recalcular computed.derived cuyo `from` es `key`
      // (p.ej. Facturable = f(tipoFacturacion)).
      for (const f of fields) {
        if (f.computed?.type === "duration" && (f.computed.from === key || f.computed.to === key)) {
          const desde = f.computed.from === key ? value : (next[f.computed.from] || "");
          const hasta = f.computed.to === key ? value : (next[f.computed.to] || "");
          next[f.key] = computeDuration(desde, hasta);
        } else if (f.computed?.type === "derived" && f.computed.from === key) {
          const mapped = f.computed.map?.[value];
          next[f.key] = mapped ?? f.computed.default ?? "";
        }
      }
      return next;
    });
    setDirty(true);

    // TEST-11 — Herencia: si el campo modificado es una relación y otros
    // campos tienen inheritFrom.from = key, cargar el record destino y
    // copiar los campos heredados al state.
    const sourceField = fields.find((f) => f.key === key);
    if (sourceField?.kind === "relation" && sourceField.relationModuleKey && value) {
      const heredables = fields.filter((f) => f.inheritFrom?.from === key);
      if (heredables.length > 0) {
        loadRelatedRecord(sourceField.relationModuleKey, value).then((record) => {
          if (!record) return;
          setValues((v) => {
            const next: Record<string, string> = { ...v };
            for (const f of heredables) {
              const incoming = String(record[f.inheritFrom!.field] || "");
              next[f.key] = incoming;
              // Cascada: si lo heredado dispara otro inheritFrom (p.ej.
              // cliente → km), recalcular en una segunda pasada simple.
              for (const child of fields) {
                if (child.inheritFrom?.from === f.key && incoming) {
                  // Se delega a la siguiente carga; cargamos su record si es
                  // relación, si no, omitimos (km es number no relación).
                }
              }
            }
            return next;
          });
          // Encadenado cliente → km (kilometrosBase). Tras heredar cliente
          // desde proyecto, intentar cargar el record del cliente y aplicar
          // los inheritFrom que dependan de `cliente`.
          (async () => {
            for (const f of heredables) {
              if (f.kind !== "relation" || !f.relationModuleKey) continue;
              const childHeredables = fields.filter((c) => c.inheritFrom?.from === f.key);
              if (childHeredables.length === 0) continue;
              const incoming = String(record[f.inheritFrom!.field] || "");
              if (!incoming) continue;
              const childRecord = await loadRelatedRecord(f.relationModuleKey, incoming);
              if (!childRecord) continue;
              setValues((v) => {
                const nx: Record<string, string> = { ...v };
                for (const c of childHeredables) {
                  nx[c.key] = String(childRecord[c.inheritFrom!.field] || "");
                }
                return nx;
              });
            }
          })();
        });
      }
    }

    // Test 18 bis 3 — Herencia transitiva tarea → cliente → kilometrosBase
    // para Desplazamientos y Gastos. La tarea (actividades) lleva `cliente`,
    // y el cliente lleva `kilometrosBase`. Como el módulo Desplazamiento
    // NO declara field `cliente` (Pedro lo eliminó), el bloque genérico
    // anterior no resuelve el km. Aquí hacemos el segundo salto a mano:
    // al elegir `tarea`, leer la tarea, obtener su cliente, leer el
    // cliente, aplicar km del cliente.
    if (key === "tarea" && value && (moduleKey === "desplazamientos" || moduleKey === "gastos")) {
      const fieldsFromCliente = fields.filter((f) => f.inheritFrom?.from === "cliente");
      if (fieldsFromCliente.length > 0) {
        (async () => {
          const tareaRec = await loadRelatedRecord("actividades", value);
          const clienteRef = String(tareaRec?.cliente || "");
          if (!clienteRef) return;
          const clienteRec = await loadRelatedRecord("clientes", clienteRef);
          if (!clienteRec) return;
          setValues((v) => {
            const next: Record<string, string> = { ...v };
            for (const f of fieldsFromCliente) {
              const incoming = String(clienteRec[f.inheritFrom!.field] || "");
              if (incoming !== "") next[f.key] = incoming;
            }
            return next;
          });
        })();
      }
    }

    // TEST-15 D — Lookup de Tarifa €/h del Proyecto en función del
    // Cliente y del Servicio (codigoTipo). Reglas:
    //   - cliente.tipoTarifa = "normal" → tarifas-generales por
    //     (servicio=codigoTipo, nivel=cliente.nivel) → valor.
    //   - cliente.tipoTarifa = "especial" → tarifas-especiales por
    //     (servicio=codigoTipo, cliente=cliente) → valor.
    // Se ejecuta solo en proyectos y solo si el campo modificado es
    // `cliente` o `codigoTipo`; el resultado va a `tarifaHoraOverride`,
    // que en SF está marcado readOnly.
    if (moduleKey === "proyectos" && (key === "cliente" || key === "codigoTipo")) {
      const hasTarifa = fields.some((f) => f.key === "tarifaHoraOverride");
      if (hasTarifa) {
        (async () => {
          // Construimos el state proyectado tras el cambio.
          const projectedCliente = key === "cliente" ? value : String(values.cliente || "");
          const projectedServicio = key === "codigoTipo" ? value : String(values.codigoTipo || "");
          if (!projectedCliente || !projectedServicio) return;
          // 1) Cargamos el record del cliente (por nombre — el value de
          //    /api/erp/options para clientes es `nombre`).
          const clienteRec = await loadRelatedRecord("clientes", projectedCliente);
          if (!clienteRec) return;
          const tipoTarifa = String(clienteRec.tipoTarifa || "normal").toLowerCase();
          const nivelCliente = String(clienteRec.nivel || "0");
          // 2) Decidimos la tabla y buscamos.
          const tablaTarifas = tipoTarifa === "especial" ? "tarifas-especiales" : "tarifas-generales";
          try {
            const t = readTenant();
            const url = "/api/erp/module?module=" + encodeURIComponent(tablaTarifas) + (t ? "&tenant=" + encodeURIComponent(t) : "");
            const r = await fetch(url, { cache: "no-store" });
            const d = await r.json();
            if (!r.ok || !d.ok || !Array.isArray(d.rows)) return;
            const rows = d.rows as Array<Record<string, string>>;
            const found = tipoTarifa === "especial"
              ? rows.find((row) =>
                  String(row.servicio || "") === projectedServicio &&
                  String(row.cliente || "") === projectedCliente,
                )
              : rows.find((row) =>
                  String(row.servicio || "") === projectedServicio &&
                  String(row.nivel || "") === nivelCliente,
                );
            if (!found) {
              // Sin coincidencia: dejamos los campos derivados vacíos.
              // No sobrescribimos lo que el usuario hubiera puesto.
              setValues((v) => ({ ...v, tarifaHoraOverride: "", unidadTarifa: "", nivelCliente }));
              return;
            }
            // TEST-16 E — Además de la Tarifa, rellenamos Unidad (de la
            // tarifa) y Nivel del Cliente para que el listado los pinte.
            const tarifa = String(found.valor || "").trim();
            const unidad = String(found.unidad || "").trim();
            setValues((v) => ({ ...v, tarifaHoraOverride: tarifa, unidadTarifa: unidad, nivelCliente }));
          } catch { /* tolerar fallo de red */ }
        })();
      }
    }
  }

  // Helper para leer el tenant de la URL desde dentro del editor (igual
  // que en generic-module-runtime-page). Lo usa el lookup TEST-15 D.
  function readTenant(): string {
    if (typeof window === "undefined") return "";
    try {
      return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
    } catch { return ""; }
  }

  async function doSubmit(andNew: boolean = false) {
    setBusy(true);
    setError("");
    try {
      // TEST-1.5 — Bloquear guardado si no hay fields configurados.
      // Antes el tester podía pulsar Guardar 4 veces y crear 4 registros vacíos.
      if (fields.length === 0) {
        throw new Error("Este módulo no tiene campos configurados. Configúralos en Ajustes → Campos personalizados antes de crear registros.");
      }
      // Validación mínima: required no vacíos. TEST-13 E — también
      // requiredWhen: un campo opcional pasa a obligatorio si otro campo
      // del registro tiene el valor pedido (p.ej. Horas bolsa obligatoria
      // cuando Método facturación = "contra-bolsa"). Si visibleWhen no
      // se cumple, el campo NO es required aunque lo diga requiredWhen.
      function isVisible(f: UiFieldDefinition): boolean {
        if (!f.visibleWhen) return true;
        const watch = String(values[f.visibleWhen.field] || "");
        const eq = f.visibleWhen.equals;
        return Array.isArray(eq) ? eq.includes(watch) : watch === eq;
      }
      function isRequired(f: UiFieldDefinition): boolean {
        if (f.required) return true;
        if (f.requiredWhen) {
          const watch = String(values[f.requiredWhen.field] || "");
          const eq = f.requiredWhen.equals;
          const hit = Array.isArray(eq) ? eq.includes(watch) : watch === eq;
          if (hit) return isVisible(f);
        }
        return false;
      }
      const missing = fields.filter((f) => isRequired(f) && !String(values[f.key] || "").trim());
      if (missing.length > 0) {
        // Saltar al primer tab que tenga el campo faltante
        const firstMissingTab = classifyField(missing[0].key);
        setTab(firstMissingTab);
        throw new Error("Faltan campos obligatorios: " + missing.map((m) => m.label).join(", "));
      }
      // TEST-4.1.a.iii — Sincronizar contacto/email/telefono del record con
      // el contacto preferido de contactosJson, para que el listado siempre
      // muestre los datos correctos sin importar de dónde vengan.
      const payload: Record<string, string> = { ...values };
      // TEST-5bis — Defensa: si el usuario abre un cliente que YA TIENE
      // contactos en BD y no los toca, `values.contactosJson` puede ser
      // undefined porque no está en `fields`. Forzamos a incluirlo en el
      // payload desde initialValue para que el guardado del cliente no
      // se traduzca en "perder" los contactos al sobreescribir el record.
      if ((moduleKey === "clientes" || moduleKey === "crm") && payload.contactosJson == null && initialValue?.contactosJson != null) {
        const raw = initialValue.contactosJson;
        payload.contactosJson = typeof raw === "string" ? raw : JSON.stringify(raw);
      }
      if ((moduleKey === "clientes" || moduleKey === "crm") && payload.contactosJson) {
        try {
          const raw = typeof payload.contactosJson === "string"
            ? JSON.parse(payload.contactosJson)
            : payload.contactosJson;
          if (Array.isArray(raw) && raw.length > 0) {
            const pref = raw.find((c) => c?.preferido) || raw[0];
            if (pref) {
              const prefNombre = String(pref.nombre || "").trim();
              const prefEmail = String(pref.email || "").trim();
              const prefTel = String(pref.telefono || "").trim();
              if (prefNombre) payload.contacto = prefNombre;
              if (prefEmail) payload.email = prefEmail;
              if (prefTel) payload.telefono = prefTel;
            }
          }
        } catch { /* ignorar JSON malformado */ }
      }
      await onSubmit(payload, { andNew });
      setDirty(false);
      // TEST-12 #3 — Guardado OK: limpiar el draft de sessionStorage
      // para que al volver a "Nuevo" se empiece en blanco.
      clearDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando.");
    } finally {
      setBusy(false);
    }
  }

  const titulo = mode === "edit"
    ? String(initialValue?.nombre || initialValue?.titulo || initialValue?.numero || initialValue?.referencia || initialValue?.asunto || "Editar " + singular(moduleLabel))
    : "Alta de " + singular(moduleLabel).toLowerCase();

  // Sidebar info: solo en edit, calculada de los datos del propio registro
  const showSidebar = mode === "edit" && initialValue;

  return (
    <div style={{ color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 1280, margin: "0 auto" }}>
      {/* TEST-16 bis A — Cabecera del editor: Pedro contó que "Proyectos"
          aparecía 4 veces (breadcrumbs de TenantShell, TabBar activa,
          breadcrumb interno del editor, fallback del H1). Eliminamos el
          BREADCRUMB INTERNO (era duplicado del que pinta TenantShell)
          y dejamos solo el H1 con el título del registro + acciones en
          una sola fila. Resultado: "Proyectos" pasa a aparecer 2 veces
          (breadcrumb global + tab activa), tal como pide el diseño. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{titulo}</h1>
          <button
            type="button"
            onClick={() => setFavorite((f) => !f)}
            title={favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: favorite ? "#eab308" : "#cbd5e1" }}
          >
            {favorite ? "★" : "☆"}
          </button>
          {dirty ? (
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#ffedd5", color: "#c2410c", fontSize: 11, fontWeight: 700 }}>
              No guardado
            </span>
          ) : mode === "edit" ? (
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700 }}>
              Guardado
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* TEST-8bis2 — Navegación bidireccional Oportunidad ↔ Propuesta.
              En crm: si hay referenciaPropuesta, link "Ver propuesta NNN".
              En presupuestos: si hay codigoOportunidad, link "Ver oportunidad NNN".
              El destino abre el listado filtrado por ese código para que el
              usuario pulse y entre a la ficha. */}
          {moduleKey === "crm" && mode === "edit" && (values.referenciaPropuesta || initialValue?.referenciaPropuesta) ? (
            <a
              href={vlink("presupuestos") + "?ver=" + encodeURIComponent(String(values.referenciaPropuesta || initialValue?.referenciaPropuesta || ""))}
              style={crossLinkBtn}
              title="Abrir la propuesta asociada a esta oportunidad"
            >
              → Ver propuesta {String(values.referenciaPropuesta || initialValue?.referenciaPropuesta || "")}
            </a>
          ) : null}
          {moduleKey === "presupuestos" && mode === "edit" && (values.codigoOportunidad || initialValue?.codigoOportunidad) ? (
            <a
              href={vlink("crm") + "?ver=" + encodeURIComponent(String(values.codigoOportunidad || initialValue?.codigoOportunidad || ""))}
              style={crossLinkBtn}
              title="Abrir la oportunidad de origen de esta propuesta"
            >
              → Ver oportunidad {String(values.codigoOportunidad || initialValue?.codigoOportunidad || "")}
            </a>
          ) : null}
          {moduleKey === "proyectos" && mode === "edit" && (values.referenciaPropuesta || initialValue?.referenciaPropuesta) ? (
            <a
              href={vlink("presupuestos") + "?ver=" + encodeURIComponent(String(values.referenciaPropuesta || initialValue?.referenciaPropuesta || ""))}
              style={crossLinkBtn}
              title="Abrir la propuesta que dio origen a este proyecto"
            >
              → Ver propuesta {String(values.referenciaPropuesta || initialValue?.referenciaPropuesta || "")}
            </a>
          ) : null}
          {/* TEST-6.1.d — Convertir en Proyecto: aparece en el editor de
              presupuestos cuando ya está guardado. Precarga cliente, nombre
              (concepto/descripción) e importe en el editor de proyectos. */}
          {moduleKey === "presupuestos" && mode === "edit" ? (
            <a
              href={(() => {
                const qs: string[] = [];
                const cliente = String(values.cliente || initialValue?.cliente || "").trim();
                const concepto = String(values.concepto || values.descripcion || values.nombre || initialValue?.concepto || initialValue?.descripcion || "").trim();
                const importe = String(values.importe || initialValue?.importe || "").trim();
                if (cliente) qs.push("prefill_cliente=" + encodeURIComponent(cliente));
                if (concepto) qs.push("prefill_nombre=" + encodeURIComponent(concepto));
                if (importe) qs.push("prefill_importe=" + encodeURIComponent(importe));
                return vlink("proyectos") + (qs.length ? "?" + qs.join("&") : "");
              })()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#16a34a", color: "#ffffff", border: "none",
                borderRadius: 8, padding: "8px 14px", fontWeight: 700,
                fontSize: 13, textDecoration: "none",
              }}
              title="Crear un proyecto a partir de esta propuesta (cliente e importe precargados)"
            >
              ✨ Convertir en proyecto
            </a>
          ) : null}
          <button type="button" onClick={() => { clearDraft(); onCancel(); }} disabled={busy} className="boton boton-secundario" style={btnSecondary}>Cancelar</button>
          {mode === "create" ? (
            <button type="button" onClick={() => doSubmit(true)} disabled={busy} className="boton boton-secundario" style={btnSecondaryAccent(accent)}>
              Guardar y nuevo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => doSubmit(false)}
            disabled={busy || fields.length === 0}
            className="boton boton-primario"
            style={{ ...btnPrimary(accent), opacity: fields.length === 0 ? 0.5 : 1, cursor: fields.length === 0 ? "not-allowed" : "pointer" }}
            title={fields.length === 0 ? "No hay campos configurados en este módulo" : undefined}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 ? (
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 20, overflowX: "auto" }}>
          {visibleTabs.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: "12px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? accent : "#64748b",
                  borderBottom: active ? "2px solid " + accent : "2px solid transparent",
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >
                {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      ) : null}

      {/* Contenido principal: 2 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: showSidebar ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", gap: 18, alignItems: "flex-start" }} className="prontara-editor-cols">
        {/* Form izquierda */}
        <form
          onSubmit={(e) => { e.preventDefault(); doSubmit(false); }}
          style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}
        >
          {fields.length === 0 ? (
            <NoFieldsConfigured moduleLabel={moduleLabel} />
          ) : tab === "documentos" ? (
            <DocumentosTab moduleKey={moduleKey} recordId={String(initialValue?.id || "")} mode={mode} />
          ) : tab === "proyectos" ? (
            <ProyectosSublist
              clienteId={String(initialValue?.id || "")}
              clienteName={String(initialValue?.nombre || "")}
              accent={accent}
            />
          ) : tab === "propuestas" ? (
            <PropuestasSublist
              oportunidadId={String(initialValue?.id || "")}
              oportunidadNumero={String(initialValue?.numero || "")}
              empresaCliente={String(values.empresa || initialValue?.empresa || "")}
              accent={accent}
            />
          ) : tab === "gastos" ? (
            <SublistaTareaModule
              moduleKey="gastos"
              label="Gastos"
              singular="gasto"
              tareaId={String(initialValue?.id || "")}
              tareaValues={values}
              accent={accent}
            />
          ) : tab === "desplazamientos" ? (
            <SublistaTareaModule
              moduleKey="desplazamientos"
              label="Desplazamientos"
              singular="desplazamiento"
              tareaId={String(initialValue?.id || "")}
              tareaValues={values}
              accent={accent}
            />
          ) : tab === "vencimientos" ? (
            <VencimientosSublist
              facturaNumero={String(initialValue?.numero || initialValue?.id || "")}
              accent={accent}
            />
          ) : tab === "zonas" ? (
            <ZonasEmpleadoSublist
              empleadoNombre={String(initialValue?.nombre || "")}
              accent={accent}
            />
          ) : tab === "contacto" && (moduleKey === "clientes" || moduleKey === "crm") ? (
            // TEST-4.1.a.i — En el tab Contactos del cliente solo se muestra
            // la sublista en rejilla. Los antiguos inputs sueltos
            // (Persona de contacto / Email / Teléfono del record) se ocultan
            // para evitar duplicar la entrada de datos; quedan como espejo
            // del contacto preferido y se sincronizan en doSubmit().
            // TEST-8.1.c — También aplica a CRM (oportunidades): el contacto
            // del record es opcional y la sublista permite gestionar varios
            // contactos por prospecto.
            <ContactosSublist
              initialJson={(() => {
                const raw = values.contactosJson ?? initialValue?.contactosJson;
                if (raw == null) return "[]";
                if (typeof raw === "string") return raw;
                try { return JSON.stringify(raw); } catch { return "[]"; }
              })()}
              onChange={(json) => setField("contactosJson", json)}
              accent={accent}
              autoStartIfEmpty={autoStartContact === true}
            />
          ) : (
            <FieldGrid fields={grouped[tab]} values={values} setField={setField} optionsMap={optionsMap} accent={accent} />
          )}
        </form>

        {/* Sidebar derecha (solo edit) */}
        {showSidebar ? (
          <div style={{ display: "grid", gap: 14 }}>
            <InfoRapidaCard record={initialValue || {}} />
            <EstadisticasCard record={initialValue || {}} />
          </div>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 980px) {
          .prontara-editor-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// === Field grid ===
function FieldGrid({ fields, values, setField, optionsMap, accent }: {
  fields: UiFieldDefinition[];
  values: Record<string, string>;
  setField: (k: string, v: string) => void;
  optionsMap: Record<string, OptionItem[]>;
  accent: string;
}) {
  if (fields.length === 0) {
    return <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No hay campos en esta sección.</div>;
  }
  // TEST-11 — Filtrar campos cuya condición visibleWhen no se cumpla
  // (p. ej. Km solo aparece si Lugar = "casa_cliente").
  const visibleFields = fields.filter((f) => {
    if (!f.visibleWhen) return true;
    const actual = String(values[f.visibleWhen.field] || "");
    const esperado = f.visibleWhen.equals;
    if (Array.isArray(esperado)) return esperado.includes(actual);
    return esperado === actual;
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="prontara-field-grid">
      {visibleFields.map((f) => {
        const isWide = f.kind === "textarea";
        return (
          // Hoja Pedro: cada campo es un `.grupo-formulario` con su
          // label arriba (`label { display:block; ... }` del global)
          // y su input estilizado por defecto (input[type=text], etc.).
          <div key={f.key} className="grupo-formulario" style={{ gridColumn: isWide ? "1 / -1" : undefined, marginBottom: 0 }}>
            <FieldInput field={f} value={values[f.key] || ""} onChange={(v) => setField(f.key, v)} options={optionsMap[f.key]} accent={accent} />
          </div>
        );
      })}
      <style>{`
        @media (max-width: 720px) {
          .prontara-field-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function FieldInput({ field, value, onChange, options, accent }: {
  field: UiFieldDefinition;
  value: string;
  onChange: (v: string) => void;
  options?: OptionItem[];
  accent: string;
}) {
  // TEST-11 — Pista visual de campos solo-lectura (heredados / calculados /
  // actualizados por un proceso): fondo gris claro y candado en la etiqueta.
  const isReadOnly = !!field.readOnly;
  const labelEl = (
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
      {field.label}
      {field.required ? <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span> : null}
      {isReadOnly ? <span style={{ color: "#94a3b8", marginLeft: 6, fontWeight: 400 }} title="Campo de solo lectura (heredado, calculado o de proceso)">🔒</span> : null}
    </label>
  );
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: isReadOnly ? "#f1f5f9" : "#ffffff",
    color: isReadOnly ? "#475569" : "#0f172a",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
    cursor: isReadOnly ? "not-allowed" : undefined,
  };

  let inputEl: React.ReactNode;

  if (field.kind === "textarea") {
    inputEl = (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        readOnly={isReadOnly}
        disabled={isReadOnly}
        style={{ ...baseStyle, resize: "vertical", minHeight: 80 }}
      />
    );
  } else if (field.kind === "status" && (field.options?.length || options?.length)) {
    const opts = field.options || options || [];
    // TEST-11 bis-7 — Si el status es readOnly (Facturado, Facturable
    // heredado, Método facturación heredado…), no tiene sentido mostrar
    // un <select> con "— Selecciona" y el candado al lado: es
    // contradictorio. Renderizar como input text deshabilitado con el
    // label de la opción seleccionada (o el placeholder si vacío,
    // explicando cuándo se rellena).
    if (isReadOnly) {
      const matched = opts.find((o) => o.value === value);
      const display = matched?.label || (value ? value : "");
      inputEl = (
        <input
          type="text"
          value={display}
          placeholder={field.placeholder || "—"}
          readOnly
          disabled
          style={baseStyle}
        />
      );
    } else {
      inputEl = (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...baseStyle, appearance: "none", paddingRight: 28, backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "10px" }}>
          <option value="">— Selecciona —</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
  } else if (field.kind === "relation") {
    const opts = options || [];
    // TEST-11 bis-2 — Si el campo es readOnly (heredado), el <select disabled>
    // mostraba "— Selecciona —" cuando el value heredado no estaba todavía en
    // las options cargadas async (o no se cargan). Renderizar como input text
    // del valor heredado tal cual: el dropdown no aporta nada en readOnly.
    if (isReadOnly) {
      // Intentamos resolver el label si el value coincide con una option;
      // si no, mostramos el value crudo (que ya suele ser el nombre legible
      // como "Acme Labs" por el contrato de /api/erp/options).
      const matched = opts.find((o) => o.value === value);
      const display = matched?.label || value || "";
      inputEl = (
        <input type="text" value={display} readOnly disabled style={baseStyle} />
      );
    } else {
      inputEl = (
        <RelationCombobox
          value={value}
          options={opts}
          onChange={onChange}
          placeholder={field.placeholder || "Buscar y seleccionar..."}
          baseStyle={baseStyle}
        />
      );
    }
  } else if (field.kind === "money") {
    inputEl = (
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13, pointerEvents: "none" }}>€</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "0,00"}
          readOnly={isReadOnly}
          disabled={isReadOnly}
          style={{ ...baseStyle, paddingLeft: 28 }}
        />
      </div>
    );
  } else if (field.kind === "date") {
    inputEl = (
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} style={baseStyle} />
    );
  } else if (field.kind === "time") {
    // TEST-11 — Input nativo hh:mm para Hora desde / Hora hasta.
    inputEl = (
      <input type="time" step={60} value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} placeholder={field.placeholder || "hh:mm"} style={baseStyle} />
    );
  } else if (field.kind === "tel") {
    inputEl = (
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", fontSize: 13, color: "#475569" }}>🇪🇸</span>
        <input type="tel" value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} placeholder={field.placeholder || "+34 600 000 000"} style={baseStyle} />
      </div>
    );
  } else if (field.kind === "email") {
    inputEl = <input type="email" value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} placeholder={field.placeholder} style={baseStyle} />;
  } else if (field.kind === "number") {
    inputEl = <input type="number" value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} placeholder={field.placeholder} style={baseStyle} />;
  } else {
    inputEl = <input type="text" value={value} onChange={(e) => onChange(e.target.value)} readOnly={isReadOnly} disabled={isReadOnly} placeholder={field.placeholder} style={baseStyle} />;
  }

  void accent;

  return (
    <div>
      {labelEl}
      {inputEl}
    </div>
  );
}

const chevronBg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E\")";

// TEST-11 bis-1 — Combobox con búsqueda para campos de relación. Reemplaza
// al <select> nativo cuando hay muchas opciones (proyectos, clientes,
// empleados...) y filtrar tecleando es más útil que scrollear. Muestra el
// label asociado al value actual, abre lista al hacer foco, filtra mientras
// se teclea y permite limpiar con × o Esc.
function RelationCombobox({
  value, options, onChange, placeholder, baseStyle,
}: {
  value: string;
  options: OptionItem[];
  onChange: (v: string) => void;
  placeholder: string;
  baseStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cuando cambia el value externo (p.ej. herencia, prefill), reflejar
  // el label en el input. Si el valor no coincide con ninguna opción
  // (todavía no cargadas), mostrar el value crudo.
  useEffect(() => {
    const matched = options.find((o) => o.value === value);
    setQuery(matched?.label || value || "");
  }, [value, options]);

  // Cerrar al click fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Si el query no coincide con ninguna opción, restaurar al label del value.
        const matched = options.find((o) => o.value === value);
        setQuery(matched?.label || value || "");
      }
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === (options.find((o) => o.value === value)?.label || value || "").toLowerCase()) {
      return options.slice(0, 50);
    }
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)).slice(0, 50);
  }, [query, options, value]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setOpen(false); (e.currentTarget as HTMLInputElement).blur(); }
        }}
        style={{ ...baseStyle, paddingRight: 56 }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
          title="Limpiar"
          style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 0 }}
        >
          ×
        </button>
      ) : null}
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 10, pointerEvents: "none" }}>▾</span>
      {open ? (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 240, overflowY: "auto", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 10px 30px rgba(15,23,42,0.12)", zIndex: 60 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>Sin resultados.</div>
          ) : (
            filtered.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setQuery(o.label); setOpen(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 13, color: "#0f172a", background: isSel ? "#eff6ff" : "transparent", border: "none", cursor: "pointer", fontWeight: isSel ? 600 : 400 }}
                >
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

// TEST-6.1.c — Formatea una fecha (ISO o lo que llegue) a DD/MM/AAAA en
// español. Si no es parseable, devuelve la cadena original.
function fmtDateEs(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // Soporta "YYYY-MM-DD" tal cual sin pasar por Date (evita problemas TZ).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// TEST-2.3 + TEST-2.4 — Sublista de Contactos con CRUD.
// TEST-3.2a — Migrada a modo rejilla (tabla) con acciones por fila:
// Editar / Copiar / Eliminar / marcar Preferido. Edición en panel inline.
// TEST-3.2b-i — Normalizador asegura que contactos legacy salgan con shape
// canónico y, si ninguno está marcado preferido, fuerza el primero.
// Persiste como JSON en el field `contactosJson` del cliente.
type Contacto = {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  preferido: boolean;
};

function normalizeContactos(raw: unknown): Contacto[] {
  if (!Array.isArray(raw)) return [];
  let list: Contacto[] = raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id || Math.random().toString(36).slice(2, 10)),
      nombre: String(c.nombre || ""),
      cargo: String(c.cargo || ""),
      email: String(c.email || ""),
      telefono: String(c.telefono || ""),
      preferido: Boolean(c.preferido),
    }));
  // TEST-3.2b-i: si hay contactos pero ninguno preferido (legacy), marcar el primero.
  if (list.length > 0 && !list.some((c) => c.preferido)) {
    list = list.map((c, i) => ({ ...c, preferido: i === 0 }));
  }
  return list;
}

function ContactosSublist({ initialJson, onChange, accent, autoStartIfEmpty }: {
  initialJson: string;
  onChange: (json: string) => void;
  accent: string;
  // TEST-8bis.1.b — Si true y la lista arranca vacía, abrir un draft de
  // contacto automáticamente al montar. Útil en el encadenado de oportunidades.
  autoStartIfEmpty?: boolean;
}) {
  const [contactos, setContactos] = useState<Contacto[]>(() => {
    try { return normalizeContactos(JSON.parse(initialJson || "[]")); }
    catch { return []; }
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Contacto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // TEST-8bis.1.b — Autostart de un draft si la lista arranca vacía.
  useEffect(() => {
    if (autoStartIfEmpty && contactos.length === 0 && editingId === null) {
      const newC: Contacto = {
        id: Math.random().toString(36).slice(2, 10),
        nombre: "", cargo: "", email: "", telefono: "",
        preferido: true,
      };
      setContactos([newC]);
      setEditingId(newC.id);
      setDraft(newC);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartIfEmpty]);

  // TEST-4.1.a.ii — Resincronizar el state local con initialJson cuando éste
  // cambia (por ejemplo, al recargar el editor con datos frescos del servidor).
  // El useState inicial solo se evalúa una vez al montar, así que sin este
  // useEffect los datos persistidos no aparecían tras salir y volver.
  useEffect(() => {
    if (editingId !== null) return; // no pisar edición en curso
    try {
      const next = normalizeContactos(JSON.parse(initialJson || "[]"));
      setContactos((prev) => {
        // Evitar bucle: solo actualizar si difiere realmente.
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    } catch { /* ignorar */ }
  }, [initialJson, editingId]);

  function persist(next: Contacto[]) {
    setContactos(next);
    onChange(JSON.stringify(next));
  }

  function buildEmptyDraft(currentList: Contacto[]): Contacto {
    return {
      id: Math.random().toString(36).slice(2, 10),
      nombre: "", cargo: "", email: "", telefono: "",
      preferido: currentList.length === 0,
    };
  }

  function startAdd() {
    const newC = buildEmptyDraft(contactos);
    persist([...contactos, newC]);
    setEditingId(newC.id);
    setDraft(newC);
  }

  function startEdit(c: Contacto) {
    setEditingId(c.id);
    setDraft({ ...c });
  }

  function saveDraft() {
    if (!draft || editingId === null) return;
    // Si el draft está totalmente vacío, cancelar sin más.
    const empty = !draft.nombre && !draft.email && !draft.telefono && !draft.cargo;
    if (empty) { cancelEdit(); return; }
    const updatedList = contactos.map((c) => c.id === editingId ? draft : c);
    persist(updatedList);
    // TEST-4.1.a.i — flujo encadenado: tras Guardar abrimos automáticamente
    // un nuevo formulario vacío para añadir el siguiente contacto. El usuario
    // pulsa "Cancelar" cuando ya no quiere añadir más.
    const newC = buildEmptyDraft(updatedList);
    setContactos([...updatedList, newC]);
    // Nota: no llamamos onChange aquí porque el draft vacío no se persiste
    // hasta que se rellene y se guarde. Si el usuario sale del editor sin
    // guardar el draft vacío, cancelEdit lo limpiará.
    setEditingId(newC.id);
    setDraft(newC);
  }

  function cancelEdit() {
    // Si era una fila recién añadida y está vacía, eliminarla
    if (draft && !draft.nombre && !draft.email && !draft.telefono && !draft.cargo) {
      const filtered = contactos.filter((c) => c.id !== editingId);
      // Mantener invariante de preferido si quitamos el preferido
      const fixed = filtered.length > 0 && !filtered.some((c) => c.preferido)
        ? filtered.map((c, i) => ({ ...c, preferido: i === 0 }))
        : filtered;
      persist(fixed);
    }
    setEditingId(null);
    setDraft(null);
  }

  function duplicate(c: Contacto) {
    const copy: Contacto = {
      ...c,
      id: Math.random().toString(36).slice(2, 10),
      nombre: c.nombre ? c.nombre + " (copia)" : "(copia)",
      preferido: false,
    };
    persist([...contactos, copy]);
  }

  function setPreferido(id: string) {
    persist(contactos.map((c) => ({ ...c, preferido: c.id === id })));
  }

  function confirmRemove(id: string) {
    setConfirmDeleteId(id);
  }

  function remove(id: string) {
    const removing = contactos.find((c) => c.id === id);
    let next = contactos.filter((c) => c.id !== id);
    if (removing?.preferido && next.length > 0) {
      next = next.map((c, i) => ({ ...c, preferido: i === 0 }));
    }
    persist(next);
    setConfirmDeleteId(null);
    if (editingId === id) { setEditingId(null); setDraft(null); }
  }

  return (
    <section style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Contactos del cliente</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Las personas con las que tratas. Marca uno como preferido para que aparezca en el listado.
          </p>
        </div>
        <button
          type="button"
          onClick={startAdd}
          style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Añadir contacto
        </button>
      </div>

      {contactos.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Aún no hay contactos. Pulsa &quot;Añadir contacto&quot; para empezar.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh(56)}>Pref.</th>
                <th style={subTh()}>Nombre</th>
                <th style={subTh()}>Cargo</th>
                <th style={subTh()}>Email</th>
                <th style={subTh()}>Teléfono</th>
                <th style={subTh(160)}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => {
                const isEditing = editingId === c.id;
                const v = isEditing && draft ? draft : c;
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid #e5e7eb", background: c.preferido ? "#f0f9ff" : "transparent" }}>
                    <td style={subTd}>
                      <label title={c.preferido ? "Contacto preferido" : "Marcar como preferido"} style={{ display: "inline-flex", cursor: "pointer" }}>
                        <input type="radio" checked={c.preferido} onChange={() => setPreferido(c.id)} disabled={isEditing} />
                      </label>
                    </td>
                    {isEditing && draft ? (
                      <>
                        <td style={subTd}><input style={subIpt} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Nombre" autoFocus /></td>
                        <td style={subTd}><input style={subIpt} value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} placeholder="Cargo" /></td>
                        <td style={subTd}><input style={subIpt} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="email@ejemplo.com" /></td>
                        <td style={subTd}><input style={subIpt} type="tel" value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} placeholder="+34 600 000 000" /></td>
                        <td style={subTd}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={saveDraft} style={subBtnPrimary(accent)} title="Guardar cambios">Guardar</button>
                            <button type="button" onClick={cancelEdit} style={subBtn} title="Descartar cambios">Cancelar</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={subTd}>{v.nombre || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.cargo || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.email ? <a href={"mailto:" + v.email} style={{ color: "#2563eb", textDecoration: "none" }}>{v.email}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>{v.telefono ? <a href={"tel:" + v.telefono} style={{ color: "#2563eb", textDecoration: "none" }}>{v.telefono}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                        <td style={subTd}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={() => startEdit(c)} style={subBtn} title="Modificar">✏️</button>
                            <button type="button" onClick={() => duplicate(c)} style={subBtn} title="Copiar / Duplicar">📋</button>
                            <button type="button" onClick={() => confirmRemove(c.id)} style={subBtnDanger} title="Eliminar">🗑</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 80, display: "grid", placeItems: "center" }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#0f172a" }}>Eliminar contacto</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569" }}>¿Eliminar este contacto del cliente? Esta acción no se puede deshacer hasta que guardes el cliente.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmDeleteId(null)} style={subBtn}>Cancelar</button>
              <button type="button" onClick={() => remove(confirmDeleteId)} style={{ ...subBtnDanger, padding: "8px 14px" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const subIpt: React.CSSProperties = {
  padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6,
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", width: "100%",
};

function subTh(width?: number): React.CSSProperties {
  return {
    textAlign: "left", padding: "8px 10px", fontSize: 11,
    ...(width ? { width } : {}),
  };
}

const subTd: React.CSSProperties = {
  padding: "8px 10px", verticalAlign: "middle", color: "#0f172a",
};

const subBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "4px 8px", fontSize: 13, cursor: "pointer", color: "#334155",
};

const subBtnDanger: React.CSSProperties = {
  ...subBtn,
  border: "1px solid #fecaca", color: "#dc2626",
};

function subBtnPrimary(accent: string): React.CSSProperties {
  return {
    ...subBtn,
    background: accent, color: "#fff", border: "1px solid " + accent,
    fontWeight: 600,
  };
}

// TEST-3.8 — Sublista de Proyectos colgando del cliente.
// Lista los proyectos cuyo campo "cliente" coincide con el ID del cliente
// abierto. Solo se monta cuando ya existe id (mode === "edit"). El usuario
// puede ver datos, eliminar y crear nuevos proyectos con el cliente
// precargado vía query string `?prefill_cliente=<id>` que el generic
// module-runtime-page interpreta para abrir el editor en modo create.
// TEST-16 F — Sublista de proyectos del cliente: columnas pedidas por
// Pedro son Proyecto, Estado, Responsable, Servicio, Facturable,
// Tarifa, Unidad. Inicio/Caducidad excluidas.
type ProyectoRow = {
  id: string;
  nombre: string;
  cliente: string;
  estado: string;
  responsable: string;
  codigoTipo: string;       // Servicio (código)
  facturable: string;
  tarifaHoraOverride: string;
  unidadTarifa: string;
};

function ProyectosSublist({ clienteId, clienteName, accent }: { clienteId: string; clienteName: string; accent: string }) {
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<ProyectoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function load() {
    if (!clienteId && !clienteName) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=proyectos", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        // Si el tenant no tiene el módulo proyectos, salimos limpios.
        setRows([]);
        setError("");
        setLoading(false);
        return;
      }
      const all: Array<Record<string, unknown>> = Array.isArray(data.rows) ? data.rows : [];
      // TEST-4.2 — La API /api/erp/options para 'clientes' usa `nombre` como
      // `value` del dropdown relation, así que `row.cliente` se guarda con el
      // NOMBRE del cliente, no su id. Filtramos por nombre, con fallback al id
      // por si en el futuro se migra a id.
      const filtered = all.filter((row) => {
        const c = String(row.cliente || "");
        if (!c) return false;
        return c === clienteName || c === clienteId;
      }).map((row) => ({
        id: String(row.id || ""),
        nombre: String(row.nombre || ""),
        cliente: String(row.cliente || ""),
        estado: String(row.estado || ""),
        responsable: String(row.responsable || ""),
        // TEST-16 F — Servicio (código del catalogo-servicios),
        // Facturable, Tarifa y Unidad: nuevas columnas pedidas.
        codigoTipo: String(row.codigoTipo || ""),
        facturable: String(row.facturable || ""),
        tarifaHoraOverride: String(row.tarifaHoraOverride || ""),
        unidadTarifa: String(row.unidadTarifa || ""),
      }));
      setRows(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando proyectos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clienteId, clienteName]);

  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "proyectos", mode: "delete", recordId: id }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error eliminando.");
      } else {
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  }

  // TEST-4.2 — prefill_cliente recibe el NOMBRE del cliente (no el id) porque
  // la API /api/erp/options usa nombre como `value` del dropdown relation.
  const nuevoHref = link("proyectos") + "?prefill_cliente=" + encodeURIComponent(clienteName || clienteId);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Proyectos del cliente</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Trabajos y contratos asignados a este cliente. Para crear o editar a fondo se abre el módulo Proyectos con el cliente ya seleccionado.
          </p>
        </div>
        <Link href={nuevoHref} style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + Alta de proyecto
        </Link>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando proyectos…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Este cliente todavía no tiene proyectos asignados. Pulsa &quot;Nuevo proyecto&quot; para crear el primero.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              {/* TEST-16 F — Columnas: Proyecto, Estado, Responsable,
                  Servicio, Facturable, Tarifa, Unidad. Excluidas
                  Inicio/Caducidad. */}
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh()}>Proyecto</th>
                <th style={subTh()}>Estado</th>
                <th style={subTh()}>Responsable</th>
                <th style={subTh()}>Servicio</th>
                <th style={subTh(100)}>Facturable</th>
                <th style={subTh(90)}>Tarifa</th>
                <th style={subTh(90)}>Unidad</th>
                <th style={subTh(120)}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={subTd}>{p.nombre || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.estado || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.responsable || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.codigoTipo || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.facturable || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.tarifaHoraOverride || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.unidadTarifa || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* TEST-16 bis C — "Abrir" navega al editor de la
                          ficha del Proyecto (?edit=<id>), no al detalle
                          rápido. Pedro quiere editar directamente. */}
                      <Link href={link("proyectos") + "?edit=" + encodeURIComponent(p.id)} style={{ ...subBtn, textDecoration: "none" }} title="Abrir formulario de edición de este proyecto">Abrir</Link>
                      <button type="button" onClick={() => setConfirmDeleteId(p.id)} style={subBtnDanger} title="Eliminar proyecto" disabled={busy}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 80, display: "grid", placeItems: "center" }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 380, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 16, color: "#0f172a" }}>Eliminar proyecto</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569" }}>¿Eliminar este proyecto del cliente? Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmDeleteId(null)} style={subBtn}>Cancelar</button>
              <button type="button" onClick={() => remove(confirmDeleteId)} style={{ ...subBtnDanger, padding: "8px 14px" }} disabled={busy}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// TEST-15 E.2 — Sublista de Propuestas asociadas a una Oportunidad
// (moduleKey crm). Lista los registros de `presupuestos` cuya
// `codigoOportunidad` coincide con el código nemotécnico OP-YYYY-NNN
// de la oportunidad actual. Botón "Añadir Propuesta" abre el editor de
// presupuestos con código + cliente prerellenados.
type PropuestaRow = {
  id: string;
  numero: string;
  cliente: string;
  concepto: string;
  importe: string;
  estado: string;
  fechaEnvio: string;
};
/**
 * Preguntas 1.con / mail 2 puntos 7+8 — Sublista de Gastos o
 * Desplazamientos asociados a una Tarea (actividades). Lista los
 * registros del módulo cuya `tareaId` coincide con la tarea actual.
 * Botón "+ Alta" abre el alta del módulo con `tareaId`, `fecha`,
 * `empleado`, `cliente` y `proyecto` ya prerrellenados.
 */
function SublistaTareaModule({
  moduleKey, label, singular, tareaId, tareaValues, accent,
}: {
  moduleKey: "gastos" | "desplazamientos";
  label: string;
  singular: string;
  tareaId: string;
  tareaValues: Record<string, string>;
  accent: string;
}) {
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!tareaId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=" + encodeURIComponent(moduleKey), { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setRows([]);
        setLoading(false);
        return;
      }
      const all = (Array.isArray(data.rows) ? data.rows : []) as Array<Record<string, string>>;
      // Test 18 bis 2 A — Tras renombrar `tareaId`→`tarea`, filtrar por
      // ambas claves para tolerar registros antiguos sin perder histórico.
      setRows(all.filter((row) => String(row.tarea || row.tareaId || row.tareaRef || "") === tareaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando " + label.toLowerCase() + ".");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tareaId, moduleKey]);

  // Construye la URL de + Alta con los prefill heredados de la tarea.
  const qs: string[] = [];
  qs.push("action=new");
  // Test 18 bis 2 A — Prefill bajo la nueva clave `tarea` (relation
  // readOnly que muestra el concepto). Mantenemos también el legacy
  // `tareaId` por compat backward por si quedaran registros antiguos.
  qs.push("prefill_tarea=" + encodeURIComponent(tareaId));
  qs.push("prefill_tareaId=" + encodeURIComponent(tareaId));
  if (tareaValues.fecha) qs.push("prefill_fecha=" + encodeURIComponent(tareaValues.fecha));
  if (tareaValues.empleado) qs.push("prefill_empleado=" + encodeURIComponent(tareaValues.empleado));
  if (tareaValues.cliente) qs.push("prefill_cliente=" + encodeURIComponent(tareaValues.cliente));
  if (tareaValues.proyecto) qs.push("prefill_proyecto=" + encodeURIComponent(tareaValues.proyecto));
  // Desplazamientos: prerellenar km del cliente (igual que en el form
  // principal de Tarea cuando Lugar=Casa cliente).
  if (moduleKey === "desplazamientos" && tareaValues.km) qs.push("prefill_km=" + encodeURIComponent(tareaValues.km));
  const nuevoHref = link(moduleKey) + "?" + qs.join("&");

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{label} de esta tarea</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Los {label.toLowerCase()} dados de alta aquí heredan Fecha, Empleado, Cliente y Proyecto de la tarea. Para crear casos sueltos (sin tarea), usa el listado general.
          </p>
        </div>
        <Link href={nuevoHref} style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + Alta de {singular}
        </Link>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando {label.toLowerCase()}…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Sin {label.toLowerCase()} asociados a esta tarea. Pulsa &quot;+ Alta de {singular}&quot; para añadir el primero.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh()}>Fecha</th>
                <th style={subTh()}>{moduleKey === "gastos" ? "Tipo / Descripción" : "Origen → Destino"}</th>
                <th style={subTh(110)}>{moduleKey === "gastos" ? "Importe" : "Km"}</th>
                <th style={subTh(100)}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id || "")} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={subTd}>{r.fecha ? fmtDateEs(String(r.fecha)) : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{moduleKey === "gastos" ? (r.tipo || r.descripcion || "—") : (String(r.origen || "") + " → " + String(r.destino || ""))}</td>
                  <td style={subTd}>{moduleKey === "gastos" ? (r.importe || "—") : (r.kilometros || r.km || "—")}</td>
                  <td style={subTd}>{r.estado || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Test 18 bis 2 E — Sublista de Zonas comerciales asignadas al
 * empleado actual. Se muestra solo cuando el rol contiene "comercial".
 * Las zonas se asignan desde el maestro /zonas-comerciales con el
 * campo `agenteResponsable`. Esta pestaña es de solo lectura — el alta
 * y modificación de zonas se hace desde el maestro.
 */
function ZonasEmpleadoSublist({ empleadoNombre, accent }: { empleadoNombre: string; accent: string }) {
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!empleadoNombre) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=zonas-comerciales", { cache: "no-store" });
      const data = await r.json();
      const all = (r.ok && data.ok && Array.isArray(data.rows)) ? data.rows as Array<Record<string, string>> : [];
      setRows(all.filter((z) => String(z.agenteResponsable || "") === empleadoNombre));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando zonas.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [empleadoNombre]);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Zonas asignadas</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Zonas comerciales en las que este empleado es el agente responsable. Para reasignar zonas, abre el maestro <strong>Zonas</strong>.
          </p>
        </div>
        <Link href={link("zonas-comerciales")} style={{ ...subBtn, textDecoration: "none", color: accent, borderColor: accent }}>Abrir maestro Zonas →</Link>
      </div>
      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando zonas…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Este empleado no tiene zonas asignadas. Abre el maestro Zonas y pon su nombre como agente responsable.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh(110)}>Código</th>
                <th style={subTh()}>Zona</th>
                <th style={subTh(110)}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((z) => (
                <tr key={String(z.id || "")} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={subTd}>{z.codigo || "—"}</td>
                  <td style={subTd}>{z.nombre || "—"}</td>
                  <td style={subTd}>{z.estado || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
/**
 * Preguntas 1.con / mail 2 punto 9 — Sublista de Vencimientos de la
 * factura actual. Solo lectura: el alta se genera automáticamente al
 * crear la factura (ver `/api/erp/module` → trigger
 * `generarVencimientosDesdeFactura`). El usuario puede marcar un
 * vencimiento como cobrado y, si todos están cobrados, el backend
 * dispara el cambio de la factura a estado "cobrada".
 */
function VencimientosSublist({ facturaNumero, accent }: { facturaNumero: string; accent: string }) {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!facturaNumero) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=vencimientos-factura", { cache: "no-store" });
      const data = await r.json();
      const all = (r.ok && data.ok && Array.isArray(data.rows)) ? data.rows as Array<Record<string, string>> : [];
      const propios = all.filter((row) => String(row.factura || "") === facturaNumero);
      // Test 18 bis 3 — Pedro: ordenar por FECHA de vencimiento
      // ascendente (antes por nVencimiento). A igual fecha, por número.
      propios.sort((a, b) => {
        const fa = String(a.fecha || "").slice(0, 10);
        const fb = String(b.fecha || "").slice(0, 10);
        if (fa !== fb) return fa < fb ? -1 : 1;
        const na = parseInt(String(a.nVencimiento || "0"), 10) || 0;
        const nb = parseInt(String(b.nVencimiento || "0"), 10) || 0;
        return na - nb;
      });
      setRows(propios);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando vencimientos.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [facturaNumero]);

  async function marcarCobrado(v: Record<string, string>) {
    setSavingId(String(v.id || ""));
    try {
      const today = new Date().toISOString().slice(0, 10);
      await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "vencimientos-factura", mode: "edit", recordId: v.id, payload: { ...v, estado: "cobrado", fechaCobro: v.fechaCobro || today } }),
      });
      await load();
    } catch { /* tolerar */ }
    finally { setSavingId(null); }
  }

  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Vencimientos de esta factura</h3>
        <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
          Generados automáticamente al crear la factura según la forma de pago. Marca cada vencimiento como cobrado conforme entren los pagos. Cuando el último se marque, la factura pasa a Cobrada.
        </p>
      </div>
      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando vencimientos…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Esta factura todavía no tiene vencimientos generados (revisa la forma de pago al guardar).
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh(50)}>Nº</th>
                <th style={subTh(120)}>Fecha vto.</th>
                <th style={subTh(120)}>Importe</th>
                <th style={subTh(110)}>Estado</th>
                <th style={subTh(120)}>Fecha cobro</th>
                <th style={subTh(130)}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const cobrado = String(v.estado || "").toLowerCase() === "cobrado";
                return (
                  <tr key={String(v.id || "")} style={{ borderTop: "1px solid #e5e7eb", background: cobrado ? "#f0fdf4" : "transparent" }}>
                    <td style={subTd}>{v.nVencimiento || "—"}</td>
                    <td style={subTd}>{v.fecha ? fmtDateEs(String(v.fecha)) : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={subTd}>{v.importe || "—"}</td>
                    <td style={subTd}>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: cobrado ? "#dcfce7" : "#fef3c7", color: cobrado ? "#15803d" : "#a16207" }}>
                        {cobrado ? "Cobrado" : (v.estado || "Pendiente")}
                      </span>
                    </td>
                    <td style={subTd}>{v.fechaCobro ? fmtDateEs(String(v.fechaCobro)) : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={subTd}>
                      {!cobrado ? (
                        <button type="button" onClick={() => marcarCobrado(v)} disabled={savingId === v.id} style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: savingId === v.id ? "wait" : "pointer" }}>
                          {savingId === v.id ? "…" : "Cobrado"}
                        </button>
                      ) : <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PropuestasSublist({ oportunidadId, oportunidadNumero, empresaCliente, accent }: {
  oportunidadId: string;
  oportunidadNumero: string;
  empresaCliente: string;
  accent: string;
}) {
  const { link } = useCurrentVertical();
  const [rows, setRows] = useState<PropuestaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!oportunidadNumero && !oportunidadId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/erp/module?module=presupuestos", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setRows([]); setLoading(false); return;
      }
      const all: Array<Record<string, unknown>> = Array.isArray(data.rows) ? data.rows : [];
      // Filtramos por código nemotécnico (OP-YYYY-NNN) primario, con
      // fallback al UUID por si en el futuro se migra a id.
      const filtered = all.filter((row) => {
        const c = String(row.codigoOportunidad || "");
        if (!c) return false;
        return c === oportunidadNumero || c === oportunidadId;
      }).map((row) => ({
        id: String(row.id || ""),
        numero: String(row.numero || ""),
        cliente: String(row.cliente || ""),
        concepto: String(row.concepto || ""),
        importe: String(row.importe || ""),
        estado: String(row.estado || ""),
        fechaEnvio: String(row.fechaEnvio || ""),
      }));
      setRows(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando propuestas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [oportunidadId, oportunidadNumero]);

  // Botón "+ Alta de propuesta" con cliente y código de oportunidad
  // prerellenados (mismo patrón que TEST-5.W oportunidad→propuesta).
  const qs: string[] = [];
  if (empresaCliente) qs.push("prefill_cliente=" + encodeURIComponent(empresaCliente));
  if (oportunidadNumero) qs.push("prefill_codigoOportunidad=" + encodeURIComponent(oportunidadNumero));
  if (oportunidadId) qs.push("wf_back_crm=" + encodeURIComponent(oportunidadId));
  const nuevoHref = link("presupuestos") + (qs.length ? "?" + qs.join("&") : "");

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Propuestas de la oportunidad</h3>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Propuestas vinculadas a esta oportunidad. Para editar a fondo se abre el módulo Propuestas con la oportunidad ya seleccionada.
          </p>
        </div>
        <Link href={nuevoHref} style={{ background: accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + Añadir propuesta
        </Link>
      </div>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Cargando propuestas…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
          Esta oportunidad todavía no tiene propuestas. Pulsa &quot;Añadir propuesta&quot; para crear la primera.
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
                <th style={subTh(110)}>Nº</th>
                <th style={subTh()}>Concepto</th>
                <th style={subTh()}>Cliente</th>
                <th style={subTh(110)}>Importe</th>
                <th style={subTh(110)}>Estado</th>
                <th style={subTh(110)}>Enviada</th>
                <th style={subTh(80)}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={subTd}>{p.numero || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.concepto || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.cliente || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.importe || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.estado || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>{p.fechaEnvio ? fmtDateEs(p.fechaEnvio) : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={subTd}>
                    <Link href={link("presupuestos") + "?ver=" + encodeURIComponent(p.numero || p.id)} style={{ ...subBtn, textDecoration: "none" }} title="Ver/editar propuesta">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// TEST-1.5 — mensaje cuando el pack del tenant no tiene fields para el
// módulo. Antes el editor mostraba la tab "Documentos" como única, lo que
// permitía al usuario pulsar Guardar y crear registros vacíos.
function NoFieldsConfigured({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🧩</div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
        Sin campos configurados
      </h3>
      <p style={{ margin: "0 0 16px 0", fontSize: 13, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
        El módulo <strong>{moduleLabel}</strong> aún no tiene campos definidos en tu pack sectorial.
        Configúralos en <strong>Ajustes → Campos personalizados</strong> antes de crear registros.
      </p>
      <a href="/ajustes-campos" style={{ display: "inline-block", padding: "8px 16px", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
        Ir a Ajustes de campos →
      </a>
    </div>
  );
}

// === Documentos tab (placeholder con link al módulo documentos) ===
function DocumentosTab({ moduleKey, recordId, mode }: { moduleKey: string; recordId: string; mode: "create" | "edit" }) {
  const { link } = useCurrentVertical();
  if (mode === "create") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        Guarda primero el registro para poder adjuntar documentos.
      </div>
    );
  }
  void moduleKey;
  // TEST-5.1.c — Usamos <a href> (no <Link>) para esquivar comportamientos
  // raros del componente Next/Link dentro del <form> del editor que dejaban
  // el botón sin responder. Damos también más área clicable.
  const href = link("documentos") + "?ref=" + encodeURIComponent(recordId);
  return (
    <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📎</div>
      <div style={{ marginBottom: 14 }}>Documentos vinculados aparecerán aquí.</div>
      <a
        href={href}
        style={{
          display: "inline-block",
          padding: "8px 16px",
          background: "#1d4ed8",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 6,
          textDecoration: "none",
        }}
      >
        Ir a Documentos →
      </a>
    </div>
  );
}

// === Sidebar cards ===
function InfoRapidaCard({ record }: { record: Record<string, string> }) {
  const items: Array<{ label: string; value: string; valueColor?: string; pill?: { bg: string; fg: string; text: string } }> = [];
  if (record.limiteCredito) items.push({ label: "Límite de crédito", value: fmtMoney(record.limiteCredito) });
  if (record.creditoDisponible) items.push({ label: "Crédito disponible", value: fmtMoney(record.creditoDisponible), valueColor: "#15803d" });
  if (record.diasCredito) items.push({ label: "Días de crédito", value: record.diasCredito + " días" });
  if (record.ventasAcumuladas) items.push({ label: "Ventas acumuladas", value: fmtMoney(record.ventasAcumuladas) });
  if (record.ultimaCompra) items.push({ label: "Última compra", value: record.ultimaCompra });
  if (record.estado) items.push({ label: "Estado", value: "", pill: { bg: "#dcfce7", fg: "#15803d", text: record.estado === "activo" ? "Al día" : record.estado } });

  if (items.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Información rápida</div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>{it.label}</span>
            {it.pill ? (
              <span style={{ background: it.pill.bg, color: it.pill.fg, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{it.pill.text}</span>
            ) : (
              <span style={{ color: it.valueColor || "#0f172a", fontWeight: 600 }}>{it.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EstadisticasCard({ record }: { record: Record<string, string> }) {
  const items: Array<{ label: string; value: string }> = [];
  if (record.numCompras) items.push({ label: "Nº de compras", value: record.numCompras });
  if (record.importeTotal) items.push({ label: "Importe total", value: fmtMoney(record.importeTotal) });
  if (record.ticketPromedio) items.push({ label: "Ticket promedio", value: fmtMoney(record.ticketPromedio) });
  if (items.length === 0) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Estadísticas</div>
        <select style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 24px 4px 8px", fontSize: 11, fontWeight: 600, color: "#475569", background: "#ffffff", appearance: "none", backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", backgroundSize: "8px" }}>
          <option>Este año</option>
          <option>Este mes</option>
          <option>Histórico</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>{it.label}</span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Helpers ===
function fmtMoney(v: unknown): string {
  const n = parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return String(v ?? "—");
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
// TEST-16 — singular() ahora vive en `@/lib/text/singular`. Tener una
// única fuente de verdad evita el drift de los overrides (Pedro reportó
// "Alta de Asignacione" porque actualicé el de generic-module-runtime
// pero no este).

// === Botones ===
function btnPrimary(accent: string): React.CSSProperties {
  return {
    padding: "10px 20px", border: "none", borderRadius: 10,
    background: accent, color: "#ffffff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}
function btnSecondaryAccent(accent: string): React.CSSProperties {
  return {
    padding: "10px 18px", border: "1px solid " + accent + "55", borderRadius: 10,
    background: accent + "10", color: accent,
    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}
const btnSecondary: React.CSSProperties = {
  padding: "10px 18px", border: "1px solid #e2e8f0", borderRadius: 10,
  background: "#ffffff", color: "#475569",
  fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};

// TEST-8bis2 — botón link de navegación cruzada entre entidades del workflow.
const crossLinkBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "#0ea5e9", color: "#ffffff", border: "none",
  borderRadius: 8, padding: "8px 14px", fontWeight: 700,
  fontSize: 13, textDecoration: "none", whiteSpace: "nowrap",
};
