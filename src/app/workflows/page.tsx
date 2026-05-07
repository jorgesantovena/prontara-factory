"use client";

import { useEffect, useState } from "react";

/**
 * Constructor de reglas de workflow (DEV-WF).
 *
 * Lista las reglas activas + formulario simple para crear una regla
 * nueva. Lo que el operador define aquí se aplica automáticamente
 * cuando se crea o cambia el estado de un registro del módulo
 * disparador.
 */
type Rule = {
  id: string;
  name: string;
  triggerModule: string;
  triggerEstado: string | null;
  actionType: string;
  actionPayload: Record<string, unknown>;
  enabled: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  notify: "Notificar al operador",
  createTask: "Crear tarea",
  setEstado: "Cambiar estado",
};

export default function WorkflowsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [triggerModule, setTriggerModule] = useState("facturacion");
  const [triggerEstado, setTriggerEstado] = useState("");
  const [actionType, setActionType] = useState<"notify" | "createTask" | "setEstado">("notify");
  const [actionTitle, setActionTitle] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTaskTitle, setActionTaskTitle] = useState("");
  const [actionEstado, setActionEstado] = useState("");

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

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      let actionPayload: Record<string, unknown> = {};
      if (actionType === "notify") {
        actionPayload = { type: "notify", title: actionTitle, message: actionMessage, severity: "info" };
      } else if (actionType === "createTask") {
        actionPayload = { type: "createTask", titulo: actionTaskTitle, prioridad: "media" };
      } else {
        actionPayload = { type: "setEstado", estado: actionEstado };
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
      setActionTitle("");
      setActionMessage("");
      setActionTaskTitle("");
      setActionEstado("");
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
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Workflows — automatizaciones
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Define reglas que se disparan automáticamente cuando un registro cambia de estado.
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
          <Field label="Tipo de acción">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as "notify" | "createTask" | "setEstado")}
              style={ipt}
            >
              <option value="notify">Notificar al operador</option>
              <option value="createTask">Crear tarea</option>
              <option value="setEstado">Cambiar estado del registro</option>
            </select>
          </Field>
          {actionType === "notify" ? (
            <>
              <Field label="Título notificación">
                <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} style={ipt} />
              </Field>
              <Field label="Mensaje notificación">
                <input value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} style={ipt} />
              </Field>
            </>
          ) : null}
          {actionType === "createTask" ? (
            <Field label="Título de la tarea a crear">
              <input value={actionTaskTitle} onChange={(e) => setActionTaskTitle(e.target.value)} style={ipt} />
            </Field>
          ) : null}
          {actionType === "setEstado" ? (
            <Field label="Nuevo estado">
              <input value={actionEstado} onChange={(e) => setActionEstado(e.target.value)} placeholder="urgente, archivado..." style={ipt} />
            </Field>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !name || !triggerModule}
          style={{ marginTop: 16, border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || !name ? 0.6 : 1 }}
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
        {rules.map((r) => (
          <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <strong>{r.name}</strong>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Cuando un registro de <code>{r.triggerModule}</code>{" "}
                  {r.triggerEstado ? <>cambie a estado <code>{r.triggerEstado}</code></> : "sea creado"} →{" "}
                  <strong>{ACTION_LABELS[r.actionType] || r.actionType}</strong>
                </div>
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
        ))}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      {children}
    </label>
  );
}
