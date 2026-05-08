"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (H4-PWA-01).
 *
 * Solo en producción y solo si el navegador lo soporta. Silencioso si
 * falla — la PWA es enhancement, no requirement.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Silencioso — PWA opt-in, no rompe la app
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
