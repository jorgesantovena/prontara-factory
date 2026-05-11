"use client";

import { useEffect, useState } from "react";

/**
 * Constructor de reglas de workflow (DEV-WF + H2-WF2).
 *
 * Permite definir reglas con MÚLTIPLES condiciones AND y MÚLTIPLES
 * acciones. Si la regla solo tiene 1 acción y 0 condiciones se guarda
 * en formato legacy (compatible con DEV-WF). Si tiene N acciones o
 * cualquier condición se guarda como payload extendido:
 *
 *   actionPayload = { actions: [...], conditions: [...] }
 *
 * Esto el engine ya lo entiende — ver workflow-engine.ts (H2-WF2).
 */
type LegacyAction =
  | { type: "notify"; title: string; message: string; severity?: string }
  | { type: "createTask"; titulo: string; asignado?: string; prioridad?: string }
  | { type: "setEstado"; estado: string };

type Condition = {
  field: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "notEmpty" | "empty";
  value?: string;
};

type ExtendedPayload = {
  actions: LegacyAction[];
  conditions?: Condition[];
};

type Rule = {
  id: string;
  name: string;
  triggerModule: string;
  triggerEstado: string | null;
  actionType: string;
  actionPayload: LegacyAction | ExtendedPayload | Record<string, unknown>;
  enabled: boolean;
};

type ActionDraft =
  | { type: "notify"; title: string; message: string; severity: string }
  | { type: "createTask"; titulo: string; asignado: string; prioridad: string }
  | { type: "setEstado"; estado: string };

const ACTION_LABELS: Record<string, string> = {
  notify: "Notificar al operador",
  createTask: "Crear tarea",
  setEstado: "Cambiar estado",
};

const OP_LABELS: Record<Condition["operator"], string> = {
  eq: "= igual",
  neq: "≠ distinto",
  contains: "contiene",
  gt: "> mayor que",
  lt: "< menor que",
  notEmpty: "no vacío",
  empty: "vacío",
};

function newAction(type: ActionDraft["type"]): ActionDraft {
  if (type === "notify") return { type, title: "", message: "", severity: "info" };
  if (type === "createTask") return { type, titulo: "", asignado: "", prioridad: "media" };
  return { type, estado: "" };
}

function isExtended(p: unknown): p is ExtendedPayload {
  return !!p && typeof p === "object" && Array.isArray((p as { actions?: unknown }).actions);
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [triggerModule, setTriggerModule] = useState("facturacion");
  const [triggerEstado, setTriggerEstado] = useState("");
  const [actions, setActions] = useState<ActionDraft[]>([newAction("notify")]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/erp/workflows", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) setRules(data.rules || []);
      else setError(data.error || "Error cargando reglas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateAction(idx: number, patch: Partial<ActionDraft>) {
    setActions((prev) => prev.map((a, i) => (i === idx ? ({ ...a, ...patch } as ActionDraft) : a)));
  }
  function changeActionType(idx: number, type: ActionDraft["type"]) {
    setActions((prev) => prev.map((a, i) => (i === idx ? newAction(type) : a)));
  }
  function addAction() {
    setActions((prev) => [...prev, newAction("notify")]);
  }
  function removeAction(idx: number) {
    setActions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function updateCondition(idx: number, patch: Partial<Condition>) {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addCondition() {
    setConditions((prev) => [...prev, { field: "", operator: "eq", value: "" }]);
  }
  function removeCondition(idx: number) {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      // Si solo hay 1 acción y 0 condiciones, guardamos en modo legacy
      const useLegacy = actions.length === 1 && conditions.length === 0;
      let actionType: string;
      let actionPayload: unknown;
      if (useLegacy) {
        const a = actions[0];
        actionType = a.type;
        if (a.type === "notify") {
          actionPayload = { type: "notify", title: a.title, message: a.message, severity: a.severity };
        } else if (a.type === "createTask") {
          actionPayload = { type: "createTask", titulo: a.titulo, asignado: a.asignado, prioridad: a.prioridad };
        } else {
          actionPayload = { type: "setEstado", estado: a.estado };
        }
      } else {
        // Modo extendido
        actionType = actions[0]?.type || "notify";
        actionPayload = {
          actions: actions.map((a) => {
            if (a.type === "notify") return { type: "notify", title: a.title, message: a.message, severity: a.severity };
            if (a.type === "createTask") return { type: "createTask", titulo: a.titulo, asignado: a.asignado, prioridad: a.prioridad };
            return { type: "setEstado", estado: a.estado };
          }),
          conditions: conditions.filter((c) => c.field.trim() !== ""),
        };
      }

      const r = await fetch("/api/erp/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          triggerModule,
          triggerEstado: triggerEstado || null,
          actionType,
          actionPayload,
          enabled: true,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error creando regla.");
        return;
      }
      setName("");
      setTriggerEstado("");
      setActions([newAction("notify")]);
      setConditions([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar esta regla?")) return;
    setBusy(true);
    try {
      await fetch("/api/erp/workflows?id=" + encodeURIComponent(id), { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Workflows — automatizaciones
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Define reglas con condiciones (AND) y múltiples acciones que se disparan automáticamente cuando un registro cambia de estado.
      </p>

      {error ? (
        <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#ffffff", marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>Nueva regla</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Avisar facturas vencidas" style={ipt} />
          </Field>
          <Field label="Módulo disparador">
            <select value={triggerModule} onChange={(e) => setTriggerModule(e.target.value)} style={ipt}>
              {[
                "facturacion", "presupuestos", "proyectos", "clientes", "crm",
                "tareas", "tickets", "compras", "calificaciones", "asistencia",
                "disciplina", "becas", "actividades",
              ].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Estado disparador (opcional, vacío = al crear)">
            <input value={triggerEstado} onChange={(e) => setTriggerEstado(e.target.value)} placeholder="vencida, por_renovar, ganado..." style={ipt} />
          </Field>
        </div>

        {/* Condiciones */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 13, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Condiciones (todas deben cumplirse — AND)
            </strong>
            <button type="button" onClick={addCondition} style={btnGhost}>+ Añadir condición</button>
          </div>
          {conditions.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0 0" }}>
              Sin condiciones — la acción se ejecuta siempre que dispare el trigger.
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <Field label="Campo">
                  <input value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value })} placeholder="importe, estado, ..." style={ipt} />
                </Field>
                <Field label="Operador">
                  <select value={c.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as Condition["operator"] })} style={ipt}>
                    {Object.entries(OP_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Valor">
                  <input
                    value={c.value || ""}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder={c.operator === "notEmpty" || c.operator === "empty" ? "(no aplica)" : "valor a comparar"}
                    disabled={c.operator === "notEmpty" || c.operator === "empty"}
                    style={ipt}
                  />
                </Field>
                <button type="button" onClick={() => removeCondition(i)} style={btnDanger}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 13, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Acciones (se ejecutan en orden)
            </strong>
            <button type="button" onClick={addAction} style={btnGhost}>+ Añadir acción</button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>ACCIÓN #{i + 1}</span>
                  {actions.length > 1 ? (
                    <button type="button" onClick={() => removeAction(i)} style={btnDanger}>Eliminar</button>
                  ) : null}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Tipo de acción">
                    <select value={a.type} onChange={(e) => changeActionType(i, e.target.value as ActionDraft["type"])} style={ipt}>
                      <option value="notify">Notificar al operador</option>
                      <option value="createTask">Crear tarea</option>
                      <option value="setEstado">Cambiar estado del registro</option>
                    </select>
                  </Field>
                  {a.type === "notify" ? (
                    <>
                      <Field label="Severidad">
                        <select value={a.severity} onChange={(e) => updateAction(i, { severity: e.target.value })} style={ipt}>
                          <option value="info">info</option>
                          <option value="success">success</option>
                          <option value="warning">warning</option>
                          <option value="error">error</option>
                        </select>
                      </Field>
                      <Field label="Título notificación">
                        <input value={a.title} onChange={(e) => updateAction(i, { title: e.target.value })} style={ipt} />
                      </Field>
                      <Field label="Mensaje notificación">
                        <input value={a.message} onChange={(e) => updateAction(i, { message: e.target.value })} style={ipt} />
                      </Field>
                    </>
                  ) : null}
                  {a.type === "createTask" ? (
                    <>
                      <Field label="Título tarea">
                        <input value={a.titulo} onChange={(e) => updateAction(i, { titulo: e.target.value })} style={ipt} />
                      </Field>
                      <Field label="Asignado (opcional)">
                        <input value={a.asignado} onChange={(e) => updateAction(i, { asignado: e.target.value })} placeholder="usuario" style={ipt} />
                      </Field>
                      <Field label="Prioridad">
                        <select value={a.prioridad} onChange={(e) => updateAction(i, { prioridad: e.target.value })} style={ipt}>
                          <option value="baja">baja</option>
                          <option value="media">media</option>
                          <option value="alta">alta</option>
                          <option value="urgente">urgente</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                  {a.type === "setEstado" ? (
                    <Field label="Nuevo estado">
                      <input value={a.estado} onChange={(e) => updateAction(i, { estado: e.target.value })} placeholder="urgente, archivado..." style={ipt} />
                    </Field>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !name || !triggerModule}
          style={{ marginTop: 18, border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || !name ? 0.6 : 1 }}
        >
          {busy ? "Guardando..." : "Crear regla"}
        </button>
      </section>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0" }}>Reglas activas ({rules.length})</h2>
      {loading ? <p>Cargando…</p> : null}
      {!loading && rules.length === 0 ? (
        <p style={{ color: "#6b7280", padding: 16, background: "#f9fafb", borderRadius: 8 }}>
          Sin reglas configuradas todavía.
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {rules.map((r) => {
          const ext = isExtended(r.actionPayload) ? r.actionPayload : null;
          return (
            <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Cuando un registro de <code>{r.triggerModule}</code>{" "}
                    {r.triggerEstado ? <>cambie a estado <code>{r.triggerEstado}</code></> : "sea creado"}
                  </div>
                  {ext ? (
                    <>
                      {ext.conditions && ext.conditions.length > 0 ? (
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                          <strong>Condiciones:</strong>{" "}
                          {ext.conditions.map((c, i) => (
                            <span key={i} style={{ marginRight: 8 }}>
                              <code>{c.field}</code> {OP_LABELS[c.operator]} {c.value ? <code>{c.value}</code> : ""}
                              {i < (ext.conditions?.length || 0) - 1 ? " AND" : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>
                        <strong>Acciones ({ext.actions.length}):</strong>{" "}
                        {ext.actions.map((a, i) => (
                          <span key={i} style={{ marginRight: 8 }}>
                            {i + 1}. {ACTION_LABELS[a.type] || a.type}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      → <strong>{ACTION_LABELS[r.actionType] || r.actionType}</strong>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  style={{ border: "1px solid #fecaca", background: "#ffffff", color: "#dc2626", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  Borrar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

const ipt: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const btnGhost: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1d4ed8",
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

const btnDanger: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#ffffff",
  color: "#dc2626",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}
