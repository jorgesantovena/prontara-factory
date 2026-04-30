"use client";

import { useEffect, useState } from "react";

type PruneDetail = {
  name: string;
  ageDays: number;
  sizeBytes: number;
  removed: boolean;
  error?: string;
};

type PruneResult = {
  candidates: number;
  removed: number;
  totalBytesFreed: number;
  details: PruneDetail[];
};

type Policy = {
  backupSnapshotDays: number;
  mailOutboxDays: number;
  chatUploadsDays: number;
};

type Snapshot = {
  generatedAt: string;
  policy: Policy;
  backupSnapshots: PruneResult;
  mailOutbox: PruneResult;
  chatUploads: PruneResult;
  totals: {
    candidates: number;
    removable: number;
    bytesReclaimable: number;
  };
};

export default function RetencionPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [policy, setPolicy] = useState<Policy>({
    backupSnapshotDays: 30,
    mailOutboxDays: 60,
    chatUploadsDays: 14,
  });
  const [busy, setBusy] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<Snapshot | null>(null);

  async function loadPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/retencion");
      if (res.status === 401) {
        setError("Se requiere sesión con rol admin/owner.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error cargando preview.");
      }
      const data = await res.json();
      setSnapshot(data.snapshot);
      if (data.snapshot?.policy) setPolicy(data.snapshot.policy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando preview.");
    } finally {
      setBusy(false);
    }
  }

  async function runWithPolicy(dryRun: boolean) {
    if (!dryRun) {
      const yes = confirm(
        "Vas a borrar " +
          (snapshot?.totals.candidates ?? 0) +
          " artefactos antiguos (" +
          formatBytes(snapshot?.totals.bytesReclaimable ?? 0) +
          "). Esta acción no se puede deshacer salvo que los ficheros estén en git. ¿Continuar?",
      );
      if (!yes) return;
    }

    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/factory/retencion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, policy }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error ejecutando.");
      }
      const data = await res.json();
      if (dryRun) {
        setSnapshot(data.snapshot);
      } else {
        setLastExecution(data.snapshot);
        await loadPreview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error ejecutando.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 40px",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <a href="/factory" style={{ color: "#6b7280", textDecoration: "none" }}>
              ← Factory
            </a>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#111827" }}>Retención y limpieza</h1>
          <p style={{ marginTop: 6, color: "#4b5563", fontSize: 14 }}>
            Purga snapshots de chat-writes, emails del outbox y adjuntos antiguos del chat.
            El log de auditoría no se toca — queda fuera del scope.
          </p>
        </div>

        {error ? <Banner tone="danger" text={error} /> : null}
        {lastExecution ? (
          <Banner
            tone="ok"
            text={
              "Limpieza ejecutada. Se borraron " +
              lastExecution.totals.removable +
              " artefactos y se liberaron " +
              formatBytes(lastExecution.totals.bytesReclaimable) +
              "."
            }
          />
        ) : null}

        <section style={sectionStyle()}>
          <h2 style={sectionTitle()}>Política</h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 14px" }}>
            Edades máximas en días. Los artefactos más viejos que el umbral entran al plan de limpieza.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
            <PolicyField
              label="Snapshots de chat-writes"
              value={policy.backupSnapshotDays}
              onChange={(v) => setPolicy({ ...policy, backupSnapshotDays: v })}
              hint=".prontara/backups/chat-writes/"
            />
            <PolicyField
              label="Emails en outbox"
              value={policy.mailOutboxDays}
              onChange={(v) => setPolicy({ ...policy, mailOutboxDays: v })}
              hint="data/saas/mail-outbox/"
            />
            <PolicyField
              label="Adjuntos del chat"
              value={policy.chatUploadsDays}
              onChange={(v) => setPolicy({ ...policy, chatUploadsDays: v })}
              hint="data/factory/chat/uploads/"
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={loadPreview}
              disabled={busy || running}
              style={secondaryButton(busy || running)}
            >
              {busy ? "Cargando…" : "Refrescar con política por defecto"}
            </button>
            <button
              type="button"
              onClick={() => runWithPolicy(true)}
              disabled={busy || running}
              style={secondaryButton(busy || running)}
            >
              Previsualizar con esta política
            </button>
            <button
              type="button"
              onClick={() => runWithPolicy(false)}
              disabled={busy || running || (snapshot?.totals.candidates ?? 0) === 0}
              style={primaryButton(
                busy || running || (snapshot?.totals.candidates ?? 0) === 0,
              )}
            >
              {running ? "Borrando…" : "Ejecutar limpieza"}
            </button>
          </div>
        </section>

        {snapshot ? (
          <>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 16 }}>
              <KpiCard
                label="Artefactos a borrar"
                value={String(snapshot.totals.candidates)}
              />
              <KpiCard
                label="Espacio a liberar"
                value={formatBytes(snapshot.totals.bytesReclaimable)}
              />
              <KpiCard
                label="Generado"
                value={new Date(snapshot.generatedAt).toLocaleTimeString("es")}
              />
            </div>

            <CategorySection
              title="Snapshots de chat-writes"
              path=".prontara/backups/chat-writes/"
              result={snapshot.backupSnapshots}
              retentionDays={snapshot.policy.backupSnapshotDays}
            />
            <CategorySection
              title="Emails en outbox"
              path="data/saas/mail-outbox/"
              result={snapshot.mailOutbox}
              retentionDays={snapshot.policy.mailOutboxDays}
            />
            <CategorySection
              title="Adjuntos del chat"
              path="data/factory/chat/uploads/"
              result={snapshot.chatUploads}
              retentionDays={snapshot.policy.chatUploadsDays}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

function CategorySection({
  title,
  path,
  result,
  retentionDays,
}: {
  title: string;
  path: string;
  result: PruneResult;
  retentionDays: number;
}) {
  return (
    <section style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <h2 style={sectionTitle()}>{title}</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          <code>{path}</code> · retención {retentionDays} días
        </div>
      </div>
      {result.candidates === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Nada que limpiar. Todo dentro de la ventana de retención.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
            {result.candidates} artefactos antiguos ·{" "}
            <strong>{formatBytes(result.details.reduce((a, d) => a + d.sizeBytes, 0))}</strong>
          </div>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th align="right">Edad</Th>
                  <Th align="right">Tamaño</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {result.details.slice(0, 200).map((d, i) => (
                  <tr key={d.name + i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <Td>
                      <code style={{ fontSize: 11 }}>{d.name}</code>
                    </Td>
                    <Td align="right">
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{d.ageDays} d</span>
                    </Td>
                    <Td align="right">{formatBytes(d.sizeBytes)}</Td>
                    <Td>
                      {d.error ? (
                        <span style={{ color: "#991b1b", fontSize: 11 }}>{d.error}</span>
                      ) : d.removed ? (
                        <span style={{ color: "#166534", fontSize: 11, fontWeight: 700 }}>borrado</span>
                      ) : (
                        <span style={{ color: "#92400e", fontSize: 11 }}>pendiente</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.details.length > 200 ? (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280", borderTop: "1px solid #f3f4f6" }}>
                (mostrando 200 de {result.details.length})
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function PolicyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          style={{
            width: 90,
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            background: "#fff",
          }}
        />
        <span style={{ fontSize: 12, color: "#6b7280" }}>días</span>
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontFamily: "monospace" }}>{hint}</div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Banner({ tone, text }: { tone: "ok" | "danger" | "info"; text: string }) {
  const palette = {
    ok: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    danger: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af" },
  }[tone];
  return (
    <div
      style={{
        border: "1px solid " + palette.border,
        background: palette.bg,
        color: palette.color,
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
}

function sectionStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  };
}

function sectionTitle(): React.CSSProperties {
  return { margin: 0, fontSize: 16, color: "#111827" };
}

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 10,
    background: disabled ? "#94a3b8" : "#991b1b",
    color: "#fff",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
  };
}

function secondaryButton(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        textAlign: align || "left",
        padding: "8px 12px",
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

function Td({ children, align }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      style={{ textAlign: align || "left", padding: "8px 12px", color: "#111827" }}
    >
      {children}
    </td>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}
