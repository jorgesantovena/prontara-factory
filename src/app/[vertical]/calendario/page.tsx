"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Vista calendario unificada (H3-FUNC-03).
 *
 * Mezcla en una grid mensual los eventos provenientes de:
 *   - tareas (campo fechaLimite)
 *   - reservas (campo fecha)
 *   - actividades (campo fecha si existe)
 *   - citas (campo fecha si existe)
 *   - eventos (campo fecha si existe)
 *
 * Lee de /api/erp/module?moduleKey=X y compone los items en runtime.
 * Filtros: por módulo y por usuario asignado.
 */

type Item = {
  id: string;
  date: string; // YYYY-MM-DD
  module: string;
  title: string;
  detail?: string;
  user?: string;
};

const SOURCES: Array<{ moduleKey: string; dateField: string; titleField: string; userField?: string; label: string; color: string }> = [
  { moduleKey: "tareas", dateField: "fechaLimite", titleField: "titulo", userField: "asignado", label: "Tarea", color: "#1d4ed8" },
  { moduleKey: "reservas", dateField: "fecha", titleField: "recurso", userField: "solicitante", label: "Reserva", color: "#7c3aed" },
  { moduleKey: "actividades", dateField: "fecha", titleField: "concepto", userField: "responsable", label: "Actividad", color: "#16a34a" },
  { moduleKey: "citas", dateField: "fecha", titleField: "motivo", userField: "profesional", label: "Cita", color: "#0891b2" },
  { moduleKey: "eventos", dateField: "fecha", titleField: "nombre", userField: "responsable", label: "Evento", color: "#ea580c" },
  { moduleKey: "caja", dateField: "fecha", titleField: "concepto", userField: "cajero", label: "Caja", color: "#db2777" },
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export default function CalendarioPage() {
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const all: Item[] = [];
      for (const src of SOURCES) {
        try {
          const r = await fetch("/api/erp/module?moduleKey=" + src.moduleKey, { cache: "no-store" });
          const data = await r.json();
          if (!r.ok || !data.ok) continue;
          for (const row of (data.rows || []) as Array<Record<string, unknown>>) {
            const dateStr = String(row[src.dateField] || "").trim();
            if (!dateStr) continue;
            // Tomar solo YYYY-MM-DD si viene con hora
            const d = dateStr.slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
            all.push({
              id: src.moduleKey + ":" + String(row.id || Math.random()),
              date: d,
              module: src.moduleKey,
              title: String(row[src.titleField] || "(sin título)"),
              user: src.userField ? String(row[src.userField] || "") : "",
              detail: String(row.estado || ""),
            });
          }
        } catch {
          // ignorar módulos no presentes
        }
      }
      setItems(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (moduleFilter && it.module !== moduleFilter) return false;
      if (userFilter && !(it.user || "").toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [items, moduleFilter, userFilter]);

  const itemsByDate = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of filtered) {
      if (!m.has(it.date)) m.set(it.date, []);
      m.get(it.date)!.push(it);
    }
    return m;
  }, [filtered]);

  // Días del mes + padding inicial al primer día
  const firstWeekday = (cursor.getDay() + 6) % 7; // lunes = 0
  const total = daysInMonth(cursor);
  const cells: Array<{ day?: number; date?: string }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({});
  for (let d = 1; d <= total; d++) {
    const dt = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ day: d, date: ymd(dt) });
  }

  const monthLabel = cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const allUsers = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      if (it.user) s.add(it.user);
    }
    return Array.from(s).sort();
  }, [items]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>Calendario</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>
        Vista unificada: tareas, reservas, citas, actividades, eventos y caja en un solo grid mensual.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} style={btn}>← Mes anterior</button>
        <strong style={{ fontSize: 16, textTransform: "capitalize", minWidth: 200, textAlign: "center" }}>{monthLabel}</strong>
        <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} style={btn}>Mes siguiente →</button>
        <button type="button" onClick={() => setCursor(startOfMonth(new Date()))} style={{ ...btn, background: "#1d4ed8", color: "#ffffff", borderColor: "#1d4ed8" }}>Hoy</button>

        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={ipt}>
          <option value="">Todos los módulos</option>
          {SOURCES.map((s) => <option key={s.moduleKey} value={s.moduleKey}>{s.label}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={ipt}>
          <option value="">Todos los usuarios</option>
          {allUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button type="button" onClick={load} style={btn}>↻ Recargar</button>
      </div>

      {error ? <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div> : null}
      {loading ? <p>Cargando…</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, background: "#e5e7eb", borderRadius: 8, padding: 4 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "#475569", padding: 6, textAlign: "center", textTransform: "uppercase" }}>{d}</div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              background: "#ffffff",
              minHeight: 90,
              padding: 6,
              borderRadius: 4,
              fontSize: 11,
              opacity: c.day ? 1 : 0.4,
            }}
          >
            {c.day ? (
              <>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{c.day}</div>
                <div style={{ display: "grid", gap: 2 }}>
                  {(itemsByDate.get(c.date || "") || []).slice(0, 4).map((it) => {
                    const src = SOURCES.find((s) => s.moduleKey === it.module);
                    const color = src?.color || "#475569";
                    return (
                      <div
                        key={it.id}
                        title={it.title + " — " + (it.user || "") + " — " + (it.detail || "")}
                        style={{
                          background: color + "22",
                          color: color,
                          padding: "2px 4px",
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {it.title}
                      </div>
                    );
                  })}
                  {(itemsByDate.get(c.date || "") || []).length > 4 ? (
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>+{(itemsByDate.get(c.date || "") || []).length - 4} más</div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        {SOURCES.map((s) => (
          <span key={s.moduleKey} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: s.color + "22", border: "1px solid " + s.color, borderRadius: 3 }} />
            {s.label}
          </span>
        ))}
      </div>
    </main>
  );
}

const ipt: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
};

const btn: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
