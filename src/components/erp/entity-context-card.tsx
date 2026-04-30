"use client";

export default function EntityContextCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
        padding: 16,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>

      {items.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 14 }}>Todavía no hay información.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 12,
                background: "#fafafa",
                padding: 10,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>{item.label}</div>
              <div style={{ color: "#111827" }}>{item.value || "-"}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}