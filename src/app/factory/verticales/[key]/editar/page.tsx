"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import FactoryShell from "@/components/factory/factory-shell";

/**
 * Editor visual de un sector pack — reconstrucción tras la corrupción del
 * fichero original (28/04/2026).
 *
 * Cubre los campos editables como override:
 *   - Branding (nombre, color, tono)
 *   - Etiquetas por módulo + renameMap singular/plural
 *   - Módulos (enabled, label, navigationLabel, emptyState)
 *   - Landing (headline, subheadline, bullets, CTA)
 *   - Asistente (welcome, suggestion)
 *
 * Lo que NO cubre y se deriva al chat de Factory:
 *   - Edición masiva de entidades (CRUD complejo de relaciones)
 *   - Edición masiva de fields (con tipos, validación, etc.)
 *   - Edición de demoData
 *
 * Esos están mostrados como vistas read-only con nota explicativa.
 *
 * Persistencia: PUT /api/factory/verticales/[key] con el override completo,
 * o DELETE para volver a la definición base.
 */

type ModuleItem = {
  moduleKey: string;
  enabled: boolean;
  label: string;
  navigationLabel: string;
  emptyState: string;
};

type Branding = {
  displayName: string;
  shortName: string;
  accentColor: string;
  logoHint: string;
  tone: "simple" | "professional" | "sectorial";
};

type Landing = {
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
};

type AssistantCopy = {
  welcome: string;
  suggestion: string;
};

type SectorPack = {
  key: string;
  label: string;
  sector: string;
  businessType: string;
  description: string;
  branding: Branding;
  labels: Record<string, string>;
  renameMap: Record<string, string>;
  modules: ModuleItem[];
  entities: Array<{ key: string; label: string; description: string; moduleKey: string }>;
  fields: Array<{ moduleKey: string; fieldKey: string; label: string; kind: string; required?: boolean }>;
  landing: Landing;
  assistantCopy: AssistantCopy;
};

type ApiPayload = {
  ok: boolean;
  merged?: SectorPack;
  base?: SectorPack;
  override?: { key: string; updatedAt?: string; updatedBy?: string } | null;
  error?: string;
};

type TabKey = "branding" | "etiquetas" | "modulos" | "landing" | "asistente" | "entidades-fields";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "branding", label: "Branding" },
  { key: "etiquetas", label: "Etiquetas" },
  { key: "modulos", label: "Módulos" },
  { key: "landing", label: "Landing" },
  { key: "asistente", label: "Asistente" },
  { key: "entidades-fields", label: "Entidades y campos" },
];

export default function FactoryVerticalEditarPage() {
  const params = useParams();
  const verticalKey = decodeURIComponent(String(params?.key || ""));

  const [merged, setMerged] = useState<SectorPack | null>(null);
  const [base, setBase] = useState<SectorPack | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [overrideMeta, setOverrideMeta] = useState<{ updatedAt?: string; updatedBy?: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("branding");

  // Estados editables (se inicializan al cargar)
  const [branding, setBranding] = useState<Branding | null>(null);
  const [labelsState, setLabelsState] = useState<Record<string, string>>({});
  const [renameMapState, setRenameMapState] = useState<Record<string, string>>({});
  const [modulesState, setModulesState] = useState<ModuleItem[]>([]);
  const [landingState, setLandingState] = useState<Landing | null>(null);
  const [assistantState, setAssistantState] = useState<AssistantCopy | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verticalKey]);

  async function load() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/factory/verticales/" + encodeURIComponent(verticalKey), {
        cache: "no-store",
      });
      const data = (await res.json()) as ApiPayload;
      if (!res.ok || !data.ok || !data.merged) {
        throw new Error(data.error || "No se pudo cargar el vertical.");
      }
      setMerged(data.merged);
      setBase(data.base || null);
      setHasOverride(data.override !== null && data.override !== undefined);
      setOverrideMeta(data.override ? { updatedAt: data.override.updatedAt, updatedBy: data.override.updatedBy } : null);

      // Inicializar formularios con los valores mergeados
      setBranding({ ...data.merged.branding });
      setLabelsState({ ...data.merged.labels });
      setRenameMapState({ ...data.merged.renameMap });
      setModulesState(data.merged.modules.map((m) => ({ ...m })));
      setLandingState({ ...data.merged.landing, bullets: [...(data.merged.landing.bullets || [])] });
      setAssistantState({ ...data.merged.assistantCopy });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando vertical.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!merged || !branding || !landingState || !assistantState) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const overridePayload = {
        key: merged.key,
        branding,
        labels: labelsState,
        renameMap: renameMapState,
        modulesFullReplace: true,
        modules: modulesState,
        landing: landingState,
        assistantCopy: assistantState,
      };
      const res = await fetch("/api/factory/verticales/" + encodeURIComponent(verticalKey), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overridePayload),
      });
      const data = (await res.json()) as ApiPayload;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error guardando.");
      }
      setSuccess("Cambios guardados. Los tenants verán la nueva configuración al refrescar.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("¿Restaurar este vertical a su definición base? Se borran TODOS los cambios guardados como override.")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/factory/verticales/" + encodeURIComponent(verticalKey), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error restaurando.");
      }
      setSuccess("Override eliminado. El vertical vuelve a su definición base.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error restaurando.");
    } finally {
      setSaving(false);
    }
  }

  const accent = branding?.accentColor || merged?.branding.accentColor || "#1d4ed8";

  const dirty = useMemo(() => {
    if (!merged || !branding || !landingState || !assistantState) return false;
    if (JSON.stringify(branding) !== JSON.stringify(merged.branding)) return true;
    if (JSON.stringify(labelsState) !== JSON.stringify(merged.labels)) return true;
    if (JSON.stringify(renameMapState) !== JSON.stringify(merged.renameMap)) return true;
    if (JSON.stringify(modulesState) !== JSON.stringify(merged.modules)) return true;
    if (JSON.stringify(landingState) !== JSON.stringify(merged.landing)) return true;
    if (JSON.stringify(assistantState) !== JSON.stringify(merged.assistantCopy)) return true;
    return false;
  }, [merged, branding, labelsState, renameMapState, modulesState, landingState, assistantState]);

  return (
    <FactoryShell>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
        {/* Cabecera */}
        <div>
          <Link
            href={"/factory/verticales/" + encodeURIComponent(verticalKey)}
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}
          >
            ← Volver al vertical
          </Link>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: accent }} />
              <div>
                <h1 style={{ margin: 0, fontSize: 24, color: "#0f172a" }}>
                  Editar: {merged?.label || verticalKey}
                </h1>
                <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
                  Cambios se guardan como override. Para restaurar, pulsa &ldquo;Restaurar base&rdquo;.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {hasOverride ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "#9a3412",
                    background: "#fed7aa",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                  title={
                    overrideMeta?.updatedAt
                      ? "Editado el " + new Date(overrideMeta.updatedAt).toLocaleString("es") +
                        (overrideMeta.updatedBy ? " por " + overrideMeta.updatedBy : "")
                      : "Con override"
                  }
                >
                  ✎ con override
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
                  Pack base sin overrides
                </span>
              )}
              <button
                type="button"
                onClick={reset}
                disabled={saving || !hasOverride}
                style={{
                  padding: "8px 14px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: hasOverride && !saving ? "pointer" : "not-allowed",
                  color: hasOverride ? "#991b1b" : "#9ca3af",
                  opacity: hasOverride && !saving ? 1 : 0.6,
                }}
              >
                Restaurar base
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                style={{
                  padding: "8px 18px",
                  border: "none",
                  background: dirty ? "#1d4ed8" : "#94a3b8",
                  color: "#ffffff",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: dirty && !saving ? "pointer" : "not-allowed",
                }}
              >
                {saving ? "Guardando..." : dirty ? "Guardar cambios" : "Sin cambios"}
              </button>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {error ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: 12, fontSize: 14 }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 8, padding: 12, fontSize: 14 }}>
            {success}
          </div>
        ) : null}

        {/* Tabs */}
        <nav style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", overflowX: "auto" }}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1d4ed8" : "#6b7280",
                  borderBottom: active ? "2px solid #1d4ed8" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {busy ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Cargando…</div>
        ) : (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            {tab === "branding" && branding ? (
              <BrandingTab branding={branding} onChange={setBranding} />
            ) : null}
            {tab === "etiquetas" ? (
              <LabelsTab
                labels={labelsState}
                onChangeLabels={setLabelsState}
                renameMap={renameMapState}
                onChangeRenameMap={setRenameMapState}
              />
            ) : null}
            {tab === "modulos" ? (
              <ModulesTab modules={modulesState} onChange={setModulesState} />
            ) : null}
            {tab === "landing" && landingState ? (
              <LandingTab landing={landingState} onChange={setLandingState} />
            ) : null}
            {tab === "asistente" && assistantState ? (
              <AssistantTab assistant={assistantState} onChange={setAssistantState} />
            ) : null}
            {tab === "entidades-fields" && merged ? (
              <EntitiesAndFieldsTab pack={merged} verticalKey={verticalKey} />
            ) : null}
          </section>
        )}
      </div>
    </FactoryShell>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────

function BrandingTab({ branding, onChange }: { branding: Branding; onChange: (b: Branding) => void }) {
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 600 }}>
      <Field label="Nombre comercial">
        <Input
          value={branding.displayName}
          onChange={(v) => onChange({ ...branding, displayName: v })}
          placeholder="Prontara Tech"
        />
      </Field>
      <Field label="Nombre corto">
        <Input
          value={branding.shortName}
          onChange={(v) => onChange({ ...branding, shortName: v })}
          placeholder="PT"
        />
      </Field>
      <Field label="Color de acento (hex)">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="color"
            value={branding.accentColor}
            onChange={(e) => onChange({ ...branding, accentColor: e.target.value })}
            style={{ width: 50, height: 38, borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", padding: 0 }}
          />
          <Input
            value={branding.accentColor}
            onChange={(v) => onChange({ ...branding, accentColor: v })}
            placeholder="#2563eb"
          />
        </div>
      </Field>
      <Field label="Hint para el logo (qué transmite)">
        <Input
          value={branding.logoHint}
          onChange={(v) => onChange({ ...branding, logoHint: v })}
          placeholder="digital, técnico, limpio"
        />
      </Field>
      <Field label="Tono">
        <select
          value={branding.tone}
          onChange={(e) => onChange({ ...branding, tone: e.target.value as Branding["tone"] })}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            background: "#fff",
          }}
        >
          <option value="simple">Simple — pequeñas pymes</option>
          <option value="professional">Profesional — B2B, empresarial</option>
          <option value="sectorial">Sectorial — vertical específico</option>
        </select>
      </Field>
    </div>
  );
}

function LabelsTab({
  labels,
  onChangeLabels,
  renameMap,
  onChangeRenameMap,
}: {
  labels: Record<string, string>;
  onChangeLabels: (l: Record<string, string>) => void;
  renameMap: Record<string, string>;
  onChangeRenameMap: (r: Record<string, string>) => void;
}) {
  const labelKeys = ["clientes", "crm", "proyectos", "presupuestos", "facturacion", "documentos", "ajustes", "asistente"];

  function setLabel(key: string, value: string) {
    onChangeLabels({ ...labels, [key]: value });
  }

  function addRename(key: string, value: string) {
    if (!key.trim()) return;
    onChangeRenameMap({ ...renameMap, [key.trim()]: value });
  }

  function removeRename(key: string) {
    const next = { ...renameMap };
    delete next[key];
    onChangeRenameMap(next);
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#0f172a" }}>Etiquetas por módulo</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>
          Cómo se llama cada módulo en el menú del tenant. Ej: en Software Factory &ldquo;crm&rdquo; → &ldquo;Oportunidades&rdquo;.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {labelKeys.map((k) => (
            <Field key={k} label={k}>
              <Input
                value={labels[k] || ""}
                onChange={(v) => setLabel(k, v)}
                placeholder={"(usa label base)"}
              />
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#0f172a" }}>Renombrado de entidades</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>
          Singular y plural por entidad. Ej: en Gimnasio &ldquo;cliente&rdquo; → &ldquo;socio&rdquo;, &ldquo;clientes&rdquo; → &ldquo;socios&rdquo;.
          Estos renombres se aplican en formularios, breadcrumbs y mensajes.
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {Object.entries(renameMap).map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <Input
                value={k}
                onChange={(newKey) => {
                  const next = { ...renameMap };
                  delete next[k];
                  next[newKey] = v;
                  onChangeRenameMap(next);
                }}
                placeholder="cliente"
              />
              <Input
                value={v}
                onChange={(newVal) => onChangeRenameMap({ ...renameMap, [k]: newVal })}
                placeholder="socio"
              />
              <button
                type="button"
                onClick={() => removeRename(k)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #fecaca",
                  background: "#fff",
                  color: "#991b1b",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
          <AddRenameForm onAdd={addRename} />
        </div>
      </section>
    </div>
  );
}

function AddRenameForm({ onAdd }: { onAdd: (k: string, v: string) => void }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 6 }}>
      <Input value={k} onChange={setK} placeholder="Nueva clave (cliente, factura…)" />
      <Input value={v} onChange={setV} placeholder="Renombrado (socio, cuota…)" />
      <button
        type="button"
        onClick={() => {
          onAdd(k, v);
          setK("");
          setV("");
        }}
        disabled={!k.trim() || !v.trim()}
        style={{
          padding: "8px 14px",
          border: "1px solid #1d4ed8",
          background: k.trim() && v.trim() ? "#1d4ed8" : "#94a3b8",
          color: "#fff",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 700,
          cursor: k.trim() && v.trim() ? "pointer" : "not-allowed",
        }}
      >
        + Añadir
      </button>
    </div>
  );
}

function ModulesTab({ modules, onChange }: { modules: ModuleItem[]; onChange: (m: ModuleItem[]) => void }) {
  function update(idx: number, patch: Partial<ModuleItem>) {
    const next = modules.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange(next);
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
        Activa o desactiva módulos del vertical y personaliza sus etiquetas. Para añadir/quitar módulos del catálogo
        base, pídeselo al chat de Factory.
      </p>
      {modules.map((m, idx) => (
        <article
          key={m.moduleKey}
          style={{
            background: m.enabled ? "#ffffff" : "#f9fafb",
            border: "1px solid " + (m.enabled ? "#e5e7eb" : "#d1d5db"),
            borderRadius: 10,
            padding: 14,
            opacity: m.enabled ? 1 : 0.7,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <code style={{ background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, fontSize: 12, color: "#374151" }}>
                {m.moduleKey}
              </code>
              {!m.enabled ? <span style={{ fontSize: 11, color: "#6b7280" }}>(desactivado)</span> : null}
            </div>
            <label style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={m.enabled} onChange={(e) => update(idx, { enabled: e.target.checked })} />
              Activo
            </label>
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Label">
              <Input value={m.label} onChange={(v) => update(idx, { label: v })} placeholder="Clientes" />
            </Field>
            <Field label="En el menú">
              <Input value={m.navigationLabel} onChange={(v) => update(idx, { navigationLabel: v })} placeholder="Clientes" />
            </Field>
          </div>
          <Field label="Mensaje cuando está vacío">
            <Input
              value={m.emptyState}
              onChange={(v) => update(idx, { emptyState: v })}
              placeholder="Todavía no hay clientes."
            />
          </Field>
        </article>
      ))}
    </div>
  );
}

function LandingTab({ landing, onChange }: { landing: Landing; onChange: (l: Landing) => void }) {
  function setBullet(idx: number, value: string) {
    const next = landing.bullets.slice();
    next[idx] = value;
    onChange({ ...landing, bullets: next });
  }
  function addBullet() {
    onChange({ ...landing, bullets: [...landing.bullets, ""] });
  }
  function removeBullet(idx: number) {
    onChange({ ...landing, bullets: landing.bullets.filter((_, i) => i !== idx) });
  }
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 700 }}>
      <Field label="Headline (titular grande)">
        <Input
          value={landing.headline}
          onChange={(v) => onChange({ ...landing, headline: v })}
          placeholder="Controla clientes, proyectos…"
        />
      </Field>
      <Field label="Subheadline (descripción corta)">
        <Textarea
          value={landing.subheadline}
          onChange={(v) => onChange({ ...landing, subheadline: v })}
          rows={2}
          placeholder="ERP online claro para…"
        />
      </Field>
      <Field label="Bullets (3-5 puntos clave)">
        <div style={{ display: "grid", gap: 6 }}>
          {landing.bullets.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <Input value={b} onChange={(v) => setBullet(i, v)} placeholder="Punto clave del valor" />
              <button
                type="button"
                onClick={() => removeBullet(i)}
                style={{ padding: "8px 12px", border: "1px solid #fecaca", background: "#fff", color: "#991b1b", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addBullet}
            style={{ padding: "8px 14px", border: "1px dashed #d1d5db", background: "#fff", color: "#374151", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + Añadir bullet
          </button>
        </div>
      </Field>
      <Field label="CTA (texto del botón)">
        <Input value={landing.cta} onChange={(v) => onChange({ ...landing, cta: v })} placeholder="Activa tu ERP" />
      </Field>
    </div>
  );
}

function AssistantTab({ assistant, onChange }: { assistant: AssistantCopy; onChange: (a: AssistantCopy) => void }) {
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 700 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
        Copy del asistente que aparece dentro del runtime del cliente al abrir /asistente.
      </p>
      <Field label="Mensaje de bienvenida">
        <Textarea
          value={assistant.welcome}
          onChange={(v) => onChange({ ...assistant, welcome: v })}
          rows={3}
          placeholder="Te ayudo a revisar…"
        />
      </Field>
      <Field label="Sugerencia inicial (placeholder en el input)">
        <Input
          value={assistant.suggestion}
          onChange={(v) => onChange({ ...assistant, suggestion: v })}
          placeholder="¿Qué clientes tienen…?"
        />
      </Field>
    </div>
  );
}

function EntitiesAndFieldsTab({ pack, verticalKey }: { pack: SectorPack; verticalKey: string }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          padding: 14,
          fontSize: 13,
          color: "#92400e",
        }}
      >
        <strong>Edición vía chat de Factory.</strong> Modificar entidades (relaciones entre módulos) y campos
        (con sus tipos, validaciones, opciones) requiere coherencia con la demo data y los formularios. Es más
        rápido y seguro pedírselo al chat en lenguaje natural — &ldquo;añade un campo &lsquo;color de pelo&rsquo; al módulo
        clientes del vertical {verticalKey}&rdquo; — que mediante CRUD manual. Aquí solo se muestra el estado
        actual como referencia.
      </div>

      <section>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#0f172a" }}>
          Entidades ({pack.entities.length})
        </h3>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <Th>Key</Th>
                <Th>Label</Th>
                <Th>Módulo</Th>
                <Th>Descripción</Th>
              </tr>
            </thead>
            <tbody>
              {pack.entities.map((e) => (
                <tr key={e.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <Td><code style={{ fontSize: 12 }}>{e.key}</code></Td>
                  <Td bold>{e.label}</Td>
                  <Td muted>{e.moduleKey}</Td>
                  <Td muted>{e.description}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#0f172a" }}>
          Campos ({pack.fields.length})
        </h3>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <Th>Módulo</Th>
                <Th>Field</Th>
                <Th>Label</Th>
                <Th>Tipo</Th>
                <Th>Obligatorio</Th>
              </tr>
            </thead>
            <tbody>
              {pack.fields.map((f, i) => (
                <tr key={f.moduleKey + ":" + f.fieldKey + ":" + i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <Td muted>{f.moduleKey}</Td>
                  <Td><code style={{ fontSize: 12 }}>{f.fieldKey}</code></Td>
                  <Td bold>{f.label}</Td>
                  <Td muted>{f.kind}</Td>
                  <Td muted>{f.required ? "Sí" : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode; key?: string | number }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        fontSize: 14,
        boxSizing: "border-box",
        width: "100%",
      }}
    />
  );
}

function Textarea({ value, onChange, rows, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows || 3}
      placeholder={placeholder}
      style={{
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        fontSize: 14,
        resize: "vertical",
        fontFamily: "inherit",
        boxSizing: "border-box",
        width: "100%",
      }}
    />
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
      {children}
    </th>
  );
}

function Td({ children, bold, muted }: { children: React.ReactNode; bold?: boolean; muted?: boolean }) {
  return (
    <td style={{ padding: "8px 12px", fontSize: 13, color: muted ? "#6b7280" : "#0f172a", fontWeight: bold ? 600 : 400 }}>
      {children}
    </td>
  );
}
