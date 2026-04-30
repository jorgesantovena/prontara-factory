import type { StartupReadiness } from "@/lib/erp/startup-readiness";

export default function StartupConfidencePanel({
  readiness,
  activeClientId,
}: {
  readiness: StartupReadiness;
  activeClientId: string | null;
}) {
  const colorMap = {
    listo: {
      bg: "#f0fdf4",
      border: "#bbf7d0",
      text: "#166534",
      badge: "#dcfce7",
    },
    "casi-listo": {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
      badge: "#fef3c7",
    },
    arrancando: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1d4ed8",
      badge: "#dbeafe",
    },
  }[readiness.statusLabel];

  return (
    <section
      style={{
        border: "1px solid " + colorMap.border,
        borderRadius: 16,
        background: colorMap.bg,
        padding: 20,
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Entorno preparado
          </div>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
            {readiness.headline}
          </h2>
          <p style={{ margin: 0, color: "#374151", maxWidth: 780 }}>
            {readiness.summary}
          </p>
        </div>

        <div
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            background: colorMap.badge,
            color: colorMap.text,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Estado: {readiness.statusLabel}
        </div>
      </div>

      <div style={{ color: "#4b5563", fontSize: 14 }}>
        Cliente activo: <strong>{activeClientId || "sin cliente activo"}</strong>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {readiness.cards.map((card) => (
          <article
            key={card.key}
            style={{
              border: "1px solid #ffffff",
              borderRadius: 12,
              background: "#ffffff",
              padding: 14,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, color: "#6b7280" }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{card.value}</div>
            <div style={{ fontSize: 13, color: "#4b5563" }}>{card.helper}</div>
          </article>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 0.95fr) minmax(260px, 1.05fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <article
          style={{
            border: "1px solid #ffffff",
            borderRadius: 12,
            background: "#ffffff",
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Qué hacer hoy</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
            {readiness.recommendedToday.map((item) => (
              <li key={item} style={{ marginBottom: 8 }}>
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article
          style={{
            border: "1px solid #ffffff",
            borderRadius: 12,
            background: "#ffffff",
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Mensaje importante
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
            {readiness.confidenceBullets.map((item) => (
              <li key={item} style={{ marginBottom: 8 }}>
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}