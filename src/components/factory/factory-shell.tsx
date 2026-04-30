"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Shell del panel Prontara Factory (interno del operador, NO del tenant).
 *
 * Estructura visual:
 *   ┌─────────────┬────────────────────────────────────────────────────┐
 *   │  Sidebar    │  Top horizontal nav (Chat · Verticales · Clientes …)│
 *   │  con        ├────────────────────────────────────────────────────┤
 *   │  conversa-  │                                                    │
 *   │  ciones     │  Main content (children)                           │
 *   │  del chat   │                                                    │
 *   │             │                                                    │
 *   └─────────────┴────────────────────────────────────────────────────┘
 *
 * El chat es el centro operativo: el operador escribe en lenguaje natural
 * lo que quiere construir (verticales, módulos, mejoras) y la IA lo hace.
 * El resto de la nav (Verticales, Clientes...) son herramientas de consulta
 * para ver el estado del SaaS.
 */

type ConversationMeta = {
  id: string;
  accountId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

const ACCENT = "#1d4ed8";
const SIDEBAR_BG = "#0f172a";
const TOPNAV_BG = "#ffffff";

/**
 * `exact: true` significa que el item solo se considera activo si el
 * pathname COINCIDE EXACTAMENTE. Sin esto, "/factory" matchearía cualquier
 * subruta de /factory/* y se quedaría subrayado siempre.
 */
const TOP_NAV: Array<{ href: string; label: string; exact?: boolean; matches?: string[] }> = [
  { href: "/factory", label: "Inicio", exact: true },
  { href: "/factory/chat", label: "Chat", matches: ["/factory/chat"] },
  { href: "/factory/verticales", label: "Verticales", matches: ["/factory/verticales"] },
  { href: "/factory/clientes", label: "Clientes", matches: ["/factory/clientes", "/factory/client"] },
  { href: "/factory/suscripciones", label: "Suscripciones", matches: ["/factory/suscripciones"] },
  { href: "/factory/notificaciones", label: "Notificaciones", matches: ["/factory/notificaciones"] },
  { href: "/factory/auditoria", label: "Auditoría", matches: ["/factory/auditoria"] },
  { href: "/factory/salud", label: "Salud", matches: ["/factory/salud"] },
];

function isActive(
  pathname: string,
  item: { href: string; exact?: boolean; matches?: string[] },
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  if (item.matches && item.matches.length > 0) {
    return item.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
  }
  return pathname === item.href;
}

export default function FactoryShell({
  children,
  contentBackground = "#f5f7fb",
  contentPadding = 24,
}: {
  children: React.ReactNode;
  contentBackground?: string;
  contentPadding?: number;
}) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unauth, setUnauth] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detectar conversación activa cuando estamos en /factory/chat?id=X
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    setActiveConversationId(id);
  }, [pathname]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/factory/chat/conversations", { cache: "no-store" });
      if (res.status === 401) {
        setUnauth(true);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      if (data.ok) setConversations(data.conversations || []);
    } catch {
      // silencioso
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  async function newConversation() {
    try {
      const res = await fetch("/api/factory/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok && data.conversation) {
        await loadConversations();
        router.push("/factory/chat?id=" + encodeURIComponent(data.conversation.id));
      }
    } catch {
      // silencioso
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Borrar esta conversación?")) return;
    try {
      await fetch("/api/factory/chat/conversations/" + encodeURIComponent(id), { method: "DELETE" });
      await loadConversations();
      if (activeConversationId === id) {
        router.push("/factory/chat");
      }
    } catch {
      // silencioso
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "260px 1fr", height: "100vh", overflow: "hidden" }}>
      {/* ========================== SIDEBAR (chat) ========================== */}
      <aside
        className="prontara-factory-sidebar"
        style={{
          background: SIDEBAR_BG,
          color: "#ffffff",
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: 0,
          overflow: "hidden",
          borderRight: "1px solid #1e293b",
        }}
      >
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#94a3b8" }}>
            Prontara
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>Factory</div>
        </div>

        <div style={{ padding: "12px 16px 0" }}>
          <button
            type="button"
            onClick={newConversation}
            style={{
              width: "100%",
              background: ACCENT,
              color: "#ffffff",
              border: "none",
              padding: "10px 12px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Nueva conversación
          </button>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 8, lineHeight: 1.4 }}>
            Crea aquí lo que quieras: nuevos verticales, módulos, mejoras o ajustes — todo en lenguaje natural.
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 8px", display: "grid", gap: 2, alignContent: "start" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 8px 6px" }}>
            Conversaciones
          </div>

          {/* Buscador (visible solo si hay 5+ conversaciones para no estorbar al inicio) */}
          {loaded && !unauth && conversations.length >= 5 ? (
            <div style={{ padding: "0 8px 8px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversación..."
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  background: "#1e293b",
                  color: "#cbd5e1",
                  fontSize: 12,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
          ) : null}

          {(() => {
            if (!loaded) {
              return (
                <div style={{ padding: "8px 10px", color: "#64748b", fontSize: 12 }}>Cargando…</div>
              );
            }
            if (unauth) {
              return (
                <div style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 12 }}>
                  Inicia sesión para ver tus conversaciones.
                </div>
              );
            }
            if (conversations.length === 0) {
              return (
                <div style={{ padding: "8px 10px", color: "#64748b", fontSize: 12 }}>
                  Aún no hay conversaciones. Pulsa “+ Nueva conversación”.
                </div>
              );
            }
            const q = searchQuery.trim().toLowerCase();
            const filtered = q
              ? conversations.filter((c) =>
                  String(c.title || "").toLowerCase().includes(q),
                )
              : conversations;
            if (filtered.length === 0) {
              return (
                <div style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 12 }}>
                  Ninguna conversación coincide con &ldquo;{searchQuery}&rdquo;.
                </div>
              );
            }
            return filtered.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <Link
                  key={c.id}
                  href={"/factory/chat?id=" + encodeURIComponent(c.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: active ? "rgba(29, 78, 216, 0.30)" : "transparent",
                    color: active ? "#ffffff" : "#cbd5e1",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: active ? 700 : 500,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.title || "Sin título"}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>
                      {c.messageCount} {c.messageCount === 1 ? "mensaje" : "mensajes"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteConversation(c.id, e)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: 4,
                      lineHeight: 1,
                    }}
                    aria-label="Borrar conversación"
                  >
                    ×
                  </button>
                </Link>
              );
            });
          })()}
        </div>

        <div
          style={{
            borderTop: "1px solid #1e293b",
            padding: "10px 16px",
            fontSize: 11,
            color: "#64748b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>
            ← Salir
          </Link>
          <span>v1</span>
        </div>
      </aside>

      {/* =========================== CONTENIDO PRINCIPAL =========================== */}
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100vh", overflow: "hidden" }}>
        {/* Top nav horizontal */}
        <nav
          style={{
            background: TOPNAV_BG,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            gap: 0,
            alignItems: "stretch",
            overflowX: "auto",
            padding: "0 16px",
            flexShrink: 0,
          }}
        >
          {TOP_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? ACCENT : "#374151",
                  textDecoration: "none",
                  borderBottom: active ? "2px solid " + ACCENT : "2px solid transparent",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Children con scroll vertical propio */}
        <main
          style={{
            background: contentBackground,
            padding: contentPadding,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .prontara-factory-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
