/**
 * Catálogo de eventos de lifecycle para tenants.
 *
 * Cada evento lleva:
 *   - key único
 *   - cuándo se dispara (descripción human para el UI)
 *   - renderer que recibe contexto y devuelve {subject, text}
 *
 * Los emails son texto plano por ahora — fáciles de revisar en outbox,
 * simples de integrar con cualquier proveedor.
 */
import type { BillingSubscriptionRecord } from "@/lib/saas/billing-definition";
import type { TrialState } from "@/lib/saas/trial-store";

export type LifecycleEventKey =
  | "trial-reminder-7d"
  | "trial-reminder-1d"
  | "trial-expired"
  | "subscription-activated"
  | "subscription-cancelled"
  | "reactivation-invite";

export type LifecycleContext = {
  tenant: {
    clientId: string;
    slug: string;
    displayName: string;
  };
  trial: TrialState | null;
  subscription: BillingSubscriptionRecord | null;
  recipient: {
    email: string;
    name: string;
  };
  now: Date;
};

export type LifecycleRenderedMessage = {
  subject: string;
  text: string;
};

export type LifecycleEventDefinition = {
  key: LifecycleEventKey;
  label: string;
  description: string;
  render: (ctx: LifecycleContext) => LifecycleRenderedMessage;
};

function daysUntil(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - now.getTime()) / (24 * 60 * 60 * 1000));
}

function signOff(): string {
  return (
    "\n" +
    "Si necesitas ayuda, responde a este correo o entra a tu panel.\n" +
    "\n" +
    "— Equipo Prontara\n"
  );
}

function displayAppUrl(slug: string): string {
  const base = String(process.env.PRONTARA_APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + "/acceso?tenant=" + encodeURIComponent(slug);
}

function billingUrl(slug: string): string {
  const base = String(process.env.PRONTARA_APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + "/suscripcion?tenant=" + encodeURIComponent(slug);
}

export const LIFECYCLE_EVENTS: LifecycleEventDefinition[] = [
  {
    key: "trial-reminder-7d",
    label: "Trial · recordatorio 7 días antes",
    description: "Se dispara cuando el trial vence en 7 días y el tenant no ha contratado todavía.",
    render: ({ tenant, trial, recipient }) => ({
      subject: "Te quedan 7 días de prueba en Prontara",
      text:
        "Hola " + recipient.name + ",\n\n" +
        "Tu prueba gratuita de Prontara termina en una semana" +
        (trial?.expiresAt ? " (" + new Date(trial.expiresAt).toLocaleDateString("es") + ")" : "") +
        ". Si quieres seguir usando el entorno de " + tenant.displayName +
        ", activa un plan antes de esa fecha para no perder acceso.\n\n" +
        "Ver planes y activar: " + billingUrl(tenant.slug) + "\n" +
        signOff(),
    }),
  },
  {
    key: "trial-reminder-1d",
    label: "Trial · recordatorio 1 día antes",
    description: "Aviso urgente cuando faltan 24 horas o menos para que termine el trial.",
    render: ({ tenant, recipient }) => ({
      subject: "Tu prueba termina mañana — " + tenant.displayName,
      text:
        "Hola " + recipient.name + ",\n\n" +
        "Solo un recordatorio: tu prueba gratuita de Prontara termina en las próximas 24 horas.\n\n" +
        "Si no activas un plan, perderás acceso al entorno de " + tenant.displayName +
        ". Tus datos quedan intactos y puedes reactivar cuando quieras, pero el acceso se bloquea mientras tanto.\n\n" +
        "Activar suscripción: " + billingUrl(tenant.slug) + "\n" +
        signOff(),
    }),
  },
  {
    key: "trial-expired",
    label: "Trial · vencido",
    description: "Notificación cuando el trial ya ha expirado. Se envía una sola vez.",
    render: ({ tenant, recipient }) => ({
      subject: "Tu prueba de Prontara ha terminado",
      text:
        "Hola " + recipient.name + ",\n\n" +
        "Tu prueba gratuita de " + tenant.displayName + " ha expirado. Por ahora el acceso al ERP está bloqueado " +
        "para todos los usuarios, pero tus datos siguen guardados y ninguna configuración se ha perdido.\n\n" +
        "Para reactivar el entorno, contrata cualquier plan desde aquí:\n" +
        billingUrl(tenant.slug) + "\n\n" +
        "Si necesitas más tiempo de prueba, responde a este correo y lo hablamos.\n" +
        signOff(),
    }),
  },
  {
    key: "subscription-activated",
    label: "Suscripción · activada",
    description: "Confirmación al activar un plan de pago por primera vez.",
    render: ({ tenant, subscription, recipient }) => ({
      subject: "Suscripción activada — " + tenant.displayName,
      text:
        "Hola " + recipient.name + ",\n\n" +
        "Gracias por confiar en Prontara. Tu plan " +
        (subscription ? subscription.currentPlanKey : "") +
        " para " + tenant.displayName + " ya está activo.\n\n" +
        "Entra a tu panel: " + displayAppUrl(tenant.slug) + "\n\n" +
        "Las facturas las recibirás en " + recipient.email + " cada mes.\n" +
        signOff(),
    }),
  },
  {
    key: "subscription-cancelled",
    label: "Suscripción · cancelada",
    description: "Confirmación de cancelación con info de cuándo termina el acceso.",
    render: ({ tenant, subscription, recipient }) => {
      const cancelAt = subscription?.cancelAt
        ? new Date(subscription.cancelAt).toLocaleDateString("es")
        : "la próxima renovación";
      return {
        subject: "Has cancelado tu suscripción",
        text:
          "Hola " + recipient.name + ",\n\n" +
          "Hemos registrado la cancelación de la suscripción de " + tenant.displayName + ". " +
          "Seguirás teniendo acceso hasta " + cancelAt + ".\n\n" +
          "Si fue un error, puedes reactivar desde:\n" +
          billingUrl(tenant.slug) + "\n\n" +
          "Si cancelaste porque algo no funcionó, nos ayudaría mucho que nos contestes a este correo contándonos qué fue.\n" +
          signOff(),
      };
    },
  },
  {
    key: "reactivation-invite",
    label: "Reactivación · invitación",
    description: "Se dispara 30 días después de cancelación si no hay reactivación. Se envía una vez.",
    render: ({ tenant, recipient }) => ({
      subject: "¿Volvemos? " + tenant.displayName + " te espera en Prontara",
      text:
        "Hola " + recipient.name + ",\n\n" +
        "Hace un mes que cancelaste tu suscripción de " + tenant.displayName + ". Tus datos siguen " +
        "intactos — si quieres volver, reactivar tarda menos de un minuto y conservas todo lo que tenías.\n\n" +
        "Reactivar: " + billingUrl(tenant.slug) + "\n" +
        signOff(),
    }),
  },
];

export function getLifecycleEvent(key: LifecycleEventKey): LifecycleEventDefinition | null {
  return LIFECYCLE_EVENTS.find((e) => e.key === key) || null;
}

export { daysUntil };
