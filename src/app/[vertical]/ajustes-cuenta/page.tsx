"use client";

import { useState } from "react";

/**
 * Página de configuración de la cuenta del usuario actual (DEV-MFA).
 *
 * Hoy expone solo la activación/desactivación de MFA TOTP. En el futuro
 * podrá ampliarse con cambio de contraseña, sesiones activas, preferencias.
 */
type SetupResult = {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
  qrUrl: string;
};

export default function AjustesCuentaPage() {
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "active" | "disable">("idle");
  const [setupData, setSetupData] = useState<SetupResult | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  async function handleSetup() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/mfa/setup", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Error iniciando MFA.");
        return;
      }
      setSetupData(data as SetupResult);
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "Código inválido.");
        return;
      }
      setSuccess("MFA activado correctamente. Guarda los backup codes en lugar seguro.");
      setStep("active");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/runtime/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error || "No se pudo desactivar.");
        return;
      }
      setSuccess("MFA desactivado.");
      setStep("idle");
      setSetupData(null);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
        Mi cuenta
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
        Configuración de seguridad y preferencias.
      </p>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, background: "#ffffff" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          Autenticación de dos factores (MFA)
        </h2>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>
          Añade un código de 6 dígitos a tu login. Necesitarás una app autenticadora
          (Google Authenticator, Authy, Microsoft Authenticator, 1Password…).
        </p>

        {error ? (
          <div style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
            {success}
          </div>
        ) : null}

        {step === "idle" ? (
          <button
            type="button"
            onClick={handleSetup}
            disabled={busy}
            style={{ border: "none", background: "#1d4ed8", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Generando..." : "Activar MFA"}
          </button>
        ) : null}

        {step === "verify" && setupData ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                <strong>Paso 1.</strong> Escanea este QR con tu app autenticadora:
              </div>
              <img
                src={setupData.qrUrl}
                alt="QR código MFA"
                style={{ width: 200, height: 200, border: "1px solid #e5e7eb", borderRadius: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                O escribe manualmente este código en la app:
              </div>
              <code
                style={{ display: "block", padding: 12, background: "#f3f4f6", borderRadius: 8, fontFamily: "monospace", fontSize: 14, wordBreak: "break-all" }}
              >
                {setupData.secret}
              </code>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                <strong>Paso 2.</strong> Introduce el código de 6 dígitos que te muestra la app:
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                style={{ padding: "10px 12px", fontSize: 18, fontFamily: "monospace", border: "1px solid #d1d5db", borderRadius: 8, width: 160, letterSpacing: 4 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 6 }}>
                ⚠️ Backup codes — guárdalos en lugar seguro:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {setupData.backupCodes.map((bc) => (
                  <code key={bc} style={{ padding: 8, background: "#fef3c7", borderRadius: 6, fontFamily: "monospace", fontSize: 13 }}>
                    {bc}
                  </code>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || code.length !== 6}
              style={{ border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || code.length !== 6 ? 0.6 : 1, justifySelf: "start" }}
            >
              {busy ? "Verificando..." : "Verificar y activar"}
            </button>
          </div>
        ) : null}

        {step === "active" || step === "disable" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: "#16a34a", fontSize: 14, fontWeight: 600 }}>✓ MFA activo</div>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>
                Para desactivar MFA, introduce un código actual de tu app:
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                style={{ padding: "10px 12px", fontSize: 18, fontFamily: "monospace", border: "1px solid #d1d5db", borderRadius: 8, width: 160, letterSpacing: 4, marginRight: 8 }}
              />
              <button
                type="button"
                onClick={handleDisable}
                disabled={busy || code.length !== 6}
                style={{ border: "1px solid #dc2626", background: "#ffffff", color: "#dc2626", borderRadius: 8, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy || code.length !== 6 ? 0.6 : 1 }}
              >
                Desactivar MFA
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
