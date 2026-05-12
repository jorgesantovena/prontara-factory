"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import TenantShell from "@/components/erp/tenant-shell";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Ficha de ticket CAU (H15-B).
 *
 * Sidebar derecha: metadata (cliente, aplicación, severidad, urgencia,
 * asignado, estado, deadlines SLA con countdown).
 * Centro: timeline de replies (conversación cliente↔agente). Form al
 * pie para responder (público o nota interna).
 * Acciones: Imputar horas (crea registro en /actividades enlazado),
 * Cerrar ticket + Crear KB entry desde la solución.
 */

type Ticket = Record<string, string>;
type Reply = {
  id: string;
  authorEmail: string;
  authorRole: "agente" | "cliente";
  body: string;
  internal: boolean;
  createdAt: string;
};

export default function CauTicketDetail({ params }: { params: Promise<{ ticketId: string; vertical: string }> }) {
  const resolved = use(params);
  const { link } = useCurrentVertical();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newBody, setNewBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [horasModal, setHorasModal] = useState(false);
  const [horas, setHoras] = useState("");

  async function load() {
    setError("");
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/erp/module?module=cau", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/runtime/cau/replies?ticketId=" + encodeURIComponent(resolved.ticketId), { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (tRes?.ok) {
        const found = (tRes.rows || []).find((r: Ticket) => r.id === resolved.ticketId);
        setTicket(found || null);
      }
      if (rRes?.ok) setReplies(rRes.replies || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando ticket.");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resolved.ticketId]);

  async function submitReply() {
    if (!newBody.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/runtime/cau/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: resolved.ticketId, body: newBody, internal: isInternal }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Error guardando respuesta.");
      setNewBody("");
      setIsInternal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando.");
    } finally { setBusy(false); }
  }

  async function imputarHoras() {
    const h = parseFloat(horas.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0) { setError("Horas inválidas."); return; }
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "actividades",
          mode: "create",
          payload: {
            fecha: today,
            concepto: "CAU #" + resolved.ticketId.slice(0, 8) + " — " + (ticket?.asunto || ""),
            horas: h.toString(),
            tareaRelacionada: "cau:" + resolved.ticketId,
            cliente: ticket?.cliente || "",
            tipoTrabajo: "soporte",
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Error imputando.");
      setHorasModal(false);
      setHoras("");
      // Añade nota interna automática
      await fetch("/api/runtime/cau/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: resolved.ticketId,
          body: "⏱️ Imputadas " + h + " h al parte de horas.",
          internal: true,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally { setBusy(false); }
  }

  async function cerrarTicket() {
    if (!ticket) return;
    if (!confirm("¿Cerrar este ticket? Asegúrate de tener rellena la solución.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/erp/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "cau",
          mode: "edit",
          recordId: resolved.ticketId,
          payload: { ...ticket, estado: "cerrado", resolvedAt: new Date().toISOString() },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Error cerrando.");

      // Si hay solución, ofrece convertirla en KB entry
      if (String(ticket.solucion || "").trim() && confirm("¿Convertir la solución en una entrada de KB reusable?")) {
        await fetch("/api/runtime/cau/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: ticket.asunto,
            sintoma: ticket.descripcion || ticket.asunto,
            solucion: ticket.solucion,
            categoria: "bug",
            aplicacion: ticket.aplicacion,
            ticketRefId: resolved.ticketId,
          }),
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally { setBusy(false); }
  }

  if (!ticket) {
    return (
      <TenantShell>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#64748b" }}>
          {error || "Cargando ticket…"}
        </div>
      </TenantShell>
    );
  }

  return (
    <TenantShell>
      <div style={{ maxWidth: 1280, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
          <Link href={link("")} style={{ color: "#64748b", textDecoration: "none" }}>Inicio</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <Link href={link("cau")} style={{ color: "#64748b", textDecoration: "none" }}>CAU</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>#{resolved.ticketId.slice(0, 8)}</span>
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{ticket.asunto || "Sin asunto"}</h1>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {ticket.cliente} · {ticket.aplicacion} {ticket.version ? "v" + ticket.version : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setHorasModal(true)} style={btnSec}>⏱️ Imputar horas</button>
            {String(ticket.estado || "").toLowerCase() !== "cerrado" ? (
              <button type="button" onClick={cerrarTicket} disabled={busy} style={btnPrimary}>Cerrar ticket</button>
            ) : null}
          </div>
        </div>

        {error ? <div style={{ background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 }} className="cau-cols">
          {/* Centro: timeline */}
          <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 14, fontWeight: 700 }}>Conversación</h3>

            {/* Mensaje original */}
            {ticket.descripcion ? (
              <Message authorEmail={ticket.cliente || "Cliente"} authorRole="cliente" body={String(ticket.descripcion)} createdAt={String(ticket.createdAt || "")} internal={false} />
            ) : null}

            {replies.length === 0 && !ticket.descripcion ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Sin mensajes todavía.</div>
            ) : null}

            {replies.map((r) => (
              <Message key={r.id} authorEmail={r.authorEmail} authorRole={r.authorRole} body={r.body} createdAt={r.createdAt} internal={r.internal} />
            ))}

            {/* Form de respuesta */}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginTop: 16 }}>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Escribe tu respuesta…" rows={4}
                style={{ width: "100%", padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                  Nota interna (no visible para el cliente)
                </label>
                <button type="button" onClick={submitReply} disabled={busy || !newBody.trim()} style={btnPrimary}>
                  {busy ? "Enviando…" : (isInternal ? "Guardar nota" : "Enviar respuesta")}
                </button>
              </div>
            </div>
          </section>

          {/* Sidebar: metadata */}
          <aside style={{ display: "grid", gap: 14 }}>
            <Card title="Metadata">
              <Kv label="Severidad" value={ticket.severidad || "—"} />
              <Kv label="Urgencia" value={ticket.urgencia || "—"} />
              <Kv label="Estado" value={ticket.estado || "—"} />
              <Kv label="Asignado" value={ticket.asignado || "Sin asignar"} />
              <Kv label="Creado" value={ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("es-ES") : "—"} />
            </Card>
          </aside>
        </div>

        {/* Modal imputar horas */}
        {horasModal ? (
          <>
            <div onClick={() => setHorasModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 90 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#ffffff", padding: 24, borderRadius: 12, width: "min(420px, 92%)", zIndex: 100 }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Imputar horas a este ticket</h3>
              <input type="text" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="ej: 1.5"
                style={{ width: "100%", padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", marginBottom: 14 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setHorasModal(false)} style={btnSec}>Cancelar</button>
                <button type="button" onClick={imputarHoras} disabled={busy} style={btnPrimary}>Imputar</button>
              </div>
            </div>
          </>
        ) : null}

        <style>{`@media (max-width: 900px) { .cau-cols { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </TenantShell>
  );
}

function Message({ authorEmail, authorRole, body, createdAt, internal }: { authorEmail: string; authorRole: "agente" | "cliente"; body: string; createdAt: string; internal: boolean }) {
  const isAgent = authorRole === "agente";
  const bg = internal ? "#fef3c7" : isAgent ? "#dbeafe" : "#f1f5f9";
  const fg = "#0f172a";
  const align = isAgent ? "flex-end" : "flex-start";
  return (
    <div style={{ display: "flex", justifyContent: align, marginBottom: 12 }}>
      <div style={{ maxWidth: "75%", background: bg, color: fg, padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11, color: "#475569", marginBottom: 4 }}>
          <strong>{authorEmail}</strong>
          <span>{createdAt ? new Date(createdAt).toLocaleString("es-ES") : ""}</span>
        </div>
        {internal ? <div style={{ fontSize: 10, fontWeight: 700, color: "#a16207", marginBottom: 4 }}>🔒 NOTA INTERNA</div> : null}
        <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{body}</div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#0f172a", fontWeight: 600, textAlign: "right", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: "9px 16px", border: "none", borderRadius: 8, background: "#1d4ed8", color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const btnSec: React.CSSProperties = { padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#ffffff", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 };
