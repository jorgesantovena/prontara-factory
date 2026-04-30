"use client";

import { useEffect, useState } from "react";

function readTenantFromBrowser(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return String(new URLSearchParams(window.location.search).get("tenant") || "").trim();
}

type SessionResponse = {
  ok: boolean;
  session?: {
    slug: string;
    mustChangePassword: boolean;
  } | null;
};

export default function AccessGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const tenant = readTenantFromBrowser();

      try {
        const response = await fetch(
          "/api/runtime/session" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""),
          { cache: "no-store" }
        );
        const data = (await response.json()) as SessionResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.ok || !data.session) {
          window.location.href = "/acceso" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : "");
          return;
        }

        if (data.session.mustChangePassword) {
          window.location.href = "/primer-acceso?tenant=" + encodeURIComponent(tenant || data.session.slug);
          return;
        }

        setReady(true);
      } catch {
        window.location.href = "/acceso" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : "");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          padding: 18,
          color: "#4b5563",
        }}
      >
        Preparando tu acceso...
      </section>
    );
  }

  return null;
}