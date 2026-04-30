"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type OnboardingSnapshot = {
  activeClientId: string | null;
  totalClientes: number;
  oportunidadesAbiertas: number;
  presupuestosAbiertos: number;
  facturasPendientes: number;
  proyectosActivos: number;
};

type StepItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

type Props = {
  snapshot: OnboardingSnapshot;
};

type PersistedState = {
  dismissed: boolean;
  manualDoneMap: Record<string, boolean>;
};

export default function OnboardingStartPanel({ snapshot }: Props) {
  const [persisted, setPersisted] = useState<PersistedState>({
    dismissed: false,
    manualDoneMap: {},
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/runtime/onboarding", { cache: "no-store" });
        const data = await response.json();

        if (!cancelled && response.ok && data.ok && data.state) {
          setPersisted({
            dismissed: Boolean(data.state.dismissed),
            manualDoneMap: data.state.manualDoneMap || {},
          });
        }
      } catch {
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [snapshot.activeClientId]);

  async function persist(next: PersistedState) {
    setPersisted(next);

    try {
      await fetch("/api/runtime/onboarding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(next),
      });
    } catch {
    }
  }

  const steps = useMemo<StepItem[]>(() => {
    const empresaDone = Boolean(persisted.manualDoneMap["empresa"]);
    const clienteDone = snapshot.totalClientes > 0 || Boolean(persisted.manualDoneMap["cliente"]);
    const presupuestoDone =
      snapshot.presupuestosAbiertos > 0 || Boolean(persisted.manualDoneMap["presupuesto"]);
    const facturaDone =
      snapshot.facturasPendientes > 0 || Boolean(persisted.manualDoneMap["factura"]);
    const proyectoDone =
      snapshot.proyectosActivos > 0 || Boolean(persisted.manualDoneMap["proyecto"]);

    return [
      {
        key: "empresa",
        title: "Revisa los datos de tu empresa",
        description: "Confirma lo básico para trabajar con tranquilidad desde el primer día.",
        href: "/ajustes",
        done: empresaDone,
      },
      {
        key: "cliente",
        title: "Crea tu primer cliente",
        description: "Con un cliente ya puedes empezar a usar el sistema de verdad.",
        href: "/clientes",
        done: clienteDone,
      },
      {
        key: "presupuesto",
        title: "Prepara una propuesta sencilla",
        description: "Así recorres el flujo comercial sin complicarte.",
        href: "/presupuestos",
        done: presupuestoDone,
      },
      {
        key: "factura",
        title: "Emite tu primera factura",
        description: "Te ayuda a dejar lista la operativa de cobro desde el principio.",
        href: "/facturacion",
        done: facturaDone,
      },
      {
        key: "proyecto",
        title: "Revisa el trabajo en marcha",
        description: "Si trabajas por proyectos, deja preparado al menos uno.",
        href: "/proyectos",
        done: proyectoDone,
      },
    ];
  }, [
    persisted.manualDoneMap,
    snapshot.facturasPendientes,
    snapshot.presupuestosAbiertos,
    snapshot.proyectosActivos,
    snapshot.totalClientes,
  ]);

  const completedCount = steps.filter((item) => item.done).length;
  const allCompleted = completedCount === steps.length;
  const nextRecommended = steps.find((item) => !item.done) || null;

  if (!ready) {
    return (
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          background: "#ffffff",
        }}
      >
        Cargando guía de arranque...
      </section>
    );
  }

  if (persisted.dismissed && !allCompleted) {
    return (
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          background: "#ffffff",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 700 }}>Guía de arranque oculta</div>
        <div style={{ color: "#4b5563", fontSize: 14 }}>
          Puedes volver a mostrarla cuando quieras.
        </div>
        <div>
          <button
            type="button"
            onClick={() =>
              persist({
                ...persisted,
                dismissed: false,
              })
            }
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              background: "#ffffff",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Mostrar guía
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        background: "#ffffff",
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Primeros pasos
          </div>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>
            Qué hacer primero
          </h2>
          <p style={{ margin: 0, color: "#4b5563", maxWidth: 720 }}>
            No necesitas formación larga. Con estos pasos ya puedes dejar el negocio
            funcionando de forma ordenada.
          </p>
        </div>

        {!allCompleted ? (
          <button
            type="button"
            onClick={() =>
              persist({
                ...persisted,
                dismissed: true,
              })
            }
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              background: "#ffffff",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Ocultar guía
          </button>
        ) : null}
      </div>

      <div
        style={{
          border: allCompleted ? "1px solid #bbf7d0" : "1px solid #eef2f7",
          borderRadius: 14,
          background: allCompleted ? "#f0fdf4" : "#fafafa",
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>
            {allCompleted ? "Arranque completado" : "Tu avance"}
          </div>
          <div style={{ fontSize: 13, color: allCompleted ? "#166534" : "#4b5563" }}>
            {completedCount} de {steps.length}
          </div>
        </div>

        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: ((completedCount / steps.length) * 100).toFixed(0) + "%",
              height: "100%",
              background: allCompleted ? "#16a34a" : "#111827",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {nextRecommended ? (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Siguiente paso recomendado</div>
              <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis" }}>
                {nextRecommended.title}
              </div>
            </div>
            <Link
              href={nextRecommended.href}
              style={{
                border: "none",
                borderRadius: 10,
                background: "#111827",
                color: "#ffffff",
                padding: "10px 16px",
                textDecoration: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Empezar este paso
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              color: "#166534",
              fontSize: 14,
              background: "#dcfce7",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <strong>Listo.</strong>
            <span>Ya tienes cubierto el arranque básico. Puedes trabajar con normalidad.</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {steps.map((step, index) => (
          <article
            key={step.key}
            style={{
              border: "1px solid #eef2f7",
              borderRadius: 14,
              background: step.done ? "#f0fdf4" : "#ffffff",
              padding: 14,
              display: "grid",
              gap: 10,
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
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Paso {index + 1}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{step.title}</div>
                <div style={{ color: "#4b5563", fontSize: 14 }}>{step.description}</div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: step.done ? "#166534" : "#92400e",
                  background: step.done ? "#dcfce7" : "#fef3c7",
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                {step.done ? "Hecho" : "Pendiente"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href={step.href}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: "#111827",
                  color: "#ffffff",
                  padding: "10px 14px",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Ir ahora
              </Link>

              {!step.done ? (
                <button
                  type="button"
                  onClick={() =>
                    persist({
                      ...persisted,
                      manualDoneMap: {
                        ...persisted.manualDoneMap,
                        [step.key]: true,
                      },
                    })
                  }
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    background: "#ffffff",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Marcar como hecho
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const nextMap = { ...persisted.manualDoneMap };
                    delete nextMap[step.key];
                    persist({
                      ...persisted,
                      manualDoneMap: nextMap,
                    });
                  }}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    background: "#ffffff",
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Marcar como pendiente
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}