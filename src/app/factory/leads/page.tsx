"use client";

import { useEffect, useMemo, useState } from "react";

type LeadStatus = "new" | "contacted" | "qualified" | "discarded";

type LeadRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  sourceVertical: string | null;
  status: LeadStatus;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [detail, setDetail] = useState<LeadRecord | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/leads");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando.");
      }
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(id: string, status: LeadStatus) {
    try {
      const res = await fetch("/api/factory/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error actualizando.");
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      if (detail && detail.id === id) setDetail({ ...detail, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando.");
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === "all") return leads;
    return leads.filter((l) => l.status === statusFilter);
  }, [leads, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      qualified: leads.filter((l) => l.status === "qualified").length,
      discarded: leads.filter((l) => l.status === "discarded").length,
    };
  }, [leads]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 40px",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <a href="/factory" style={{ color: "#6b7280", textDecoration: "none" }}>
              ← Factory
            </a>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Leads comerciales</h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Formularios de contacto capturados desde la landing pública. Marca el estado según avances.
          </p>
        </div>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <FilterChip
            label={"Todos (" + counts.all + ")"}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <FilterChip
            label={"Nuevos (" + counts.new + ")"}
            active={statusFilter === "new"}
            tone="info"
            onClick={() => setStatusFilter("new")}
          />
          <FilterChip
            label={"Contactados (" + counts.contacted + ")"}
            active={statusFilter === "contacted"}
            tone="warn"
            onClick={() => setStatusFilter("contacted")}
          />
          <FilterChip
            label={"Cualificados (" + counts.qualified + ")"}
            active={statusFilter === "qualified"}
            tone="ok"
            onClick={() => setStatusFilter("qualified")}
          />
          <FilterChip
            label={"Descartados (" + counts.discarded + ")"}
            active={statusFilter === "discarded"}
            onClick={() => setStatusFilter("discarded")}
          />
          <button
            type="button"
            onClick={load}
            disabled={busy}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              padding: "8px 14px",
              borderRadius: 10,
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              marginLeft: "auto",
            }}
          >
            {busy ? "Cargando…" : "Refrescar"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: detail ? "1fr 480px" : "1fr", gap: 14 }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>
                {busy ? "Cargando…" : "Sin leads en este filtro."}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <Th>Creado</Th>
                    <Th>Nombre</Th>
                    <Th>Empresa</Th>
                    <Th>Vertical</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => setDetail(l)}
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: detail?.id === l.id ? "#eff6ff" : "transparent",
                      }}
                    >
                      <Td>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {new Date(l.createdAt).toLocaleString("es", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </Td>
                      <Td>
                        <strong>{l.name}</strong>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{l.email}</div>
                      </Td>
                      <Td>{l.company || <span style={{ color: "#9ca3af" }}>—</span>}</Td>
                      <Td>
                        {l.sourceVertical ? (
                          <code style={{ fontSize: 11 }}>{l.sourceVertical}</code>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={l.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {detail ? (
            <aside
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                position: "sticky",
                top: 16,
                height: "fit-content",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{detail.name}</h3>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                <a href={"mailto:" + detail.email}>{detail.email}</a>
                {detail.phone ? <> · {detail.phone}</> : null}
              </div>
              {detail.company ? (
                <div style={{ fontSize: 13, marginTop: 6 }}>{detail.company}</div>
              ) : null}
              {detail.sourceVertical ? (
                <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4 }}>
                  Vertical: <code>{detail.sourceVertical}</code>
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 10,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {detail.message || "(sin mensaje)"}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 6 }}>
                  Estado
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["new", "contacted", "qualified", "discarded"] as LeadStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(detail.id, s)}
                      style={{
                        border: "1px solid #e5e7eb",
                        background: detail.status === s ? "#1d4ed8" : "#fff",
                        color: detail.status === s ? "#fff" : "#374151",
                        padding: "6px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>
                Creado {new Date(detail.createdAt).toLocaleString("es")} · id <code>{detail.id}</code>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const palette: Record<LeadStatus, { bg: string; fg: string; label: string }> = {
    new: { bg: "#dbeafe", fg: "#1e40af", label: "nuevo" },
    contacted: { bg: "#fef3c7", fg: "#92400e", label: "contactado" },
    qualified: { bg: "#dcfce7", fg: "#166534", label: "cualificado" },
    discarded: { bg: "#f3f4f6", fg: "#6b7280", label: "descartado" },
  };
  const p = palette[status];
  return (
    <span
      style={{
        background: p.bg,
        color: p.fg,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {p.label}
    </span>
  );
}

function FilterChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "info" | "warn" | "ok";
  onClick: () => void;
}) {
  const palette =
    tone === "info"
      ? { fg: "#1e40af", bg: "#dbeafe" }
      : tone === "warn"
        ? { fg: "#92400e", bg: "#fef3c7" }
        : tone === "ok"
          ? { fg: "#166534", bg: "#dcfce7" }
          : { fg: "#374151", bg: "#f3f4f6" };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid " + (active ? "#1d4ed8" : "#e5e7eb"),
        background: active ? "#1d4ed8" : palette.bg,
        color: active ? "#fff" : palette.fg,
        padding: "6px 12px",
        borderRadius: 999,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        background: "#f9fafb",
        fontSize: 11,
        fontWeight: 700,
        color: "#374151",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 12px", color: "#111827", verticalAlign: "top" }}>{children}</td>
  );
}
