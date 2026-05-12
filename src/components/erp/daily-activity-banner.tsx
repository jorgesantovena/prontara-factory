"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Banner del parte de horas diario (H15-C #11).
 *
 * Se monta dentro del TenantShell debajo del topbar. Si:
 *   - el tenant tiene requireDaily=true,
 *   - hoy es día laborable según workdays,
 *   - el empleado tiene < minHoursPerDay imputadas,
 * entonces muestra un banner ambar con "Te faltan X horas — Imputar".
 *
 * Se oculta si está completado o si requireDaily=false.
 */

type Status = {
  ok: boolean;
  config?: { requireDaily: boolean; minHoursPerDay: number };
  isWorkday?: boolean;
  myStatus?: { horasHoy: number; horasRequeridas: number; completado: boolean; faltan: number };
};

export default function DailyActivityBanner() {
  const { link } = useCurrentVertical();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/runtime/sf/daily-activity", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus(null));
  }, []);

  if (!status?.ok || !status.config?.requireDaily) return null;
  if (!status.isWorkday) return null;
  if (status.myStatus?.completado) return null;
  if (dismissed) return null;

  const faltan = status.myStatus?.faltan ?? 0;
  const horas = status.myStatus?.horasHoy ?? 0;
  const req = status.myStatus?.horasRequeridas ?? 0;

  return (
    <div style={{
      background: "#fef3c7", color: "#92400e",
      border: "1px solid #fcd34d", borderRadius: 0,
      padding: "10px 24px", fontSize: 13,
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <div>
        ⏱️ <strong>Te faltan {faltan.toFixed(1)} h por imputar hoy</strong>
        <span style={{ marginLeft: 10, color: "#a16207" }}>
          ({horas.toFixed(1)} h de {req} requeridas)
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href={link("actividades")} style={{
          background: "#a16207", color: "#ffffff",
          padding: "6px 14px", borderRadius: 6,
          fontSize: 12, fontWeight: 700, textDecoration: "none",
        }}>
          Imputar ahora →
        </Link>
        <button type="button" onClick={() => setDismissed(true)} style={{
          background: "transparent", border: "none", color: "#a16207",
          cursor: "pointer", fontSize: 16, padding: "0 4px",
        }}>×</button>
      </div>
    </div>
  );
}
