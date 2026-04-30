# Configuración de Stripe para el modelo de pago real

## Modelo de precios

Prontara cobra de dos formas:

- **Setup fee** (one-time): pago único al contratar un plan.
  - Básico: 590 €
  - Estándar: 990 €
  - Premium: 1.490 €
- **Soporte mensual** (recurrente, opcional): 12 € por usuario concurrente al mes.

El checkout actual cobra el setup fee. La activación del soporte mensual se gestiona desde el panel admin (no entra en el flujo público de checkout).

## Crear los productos en Stripe

1. Entra en <https://dashboard.stripe.com/products>.
2. Crea **3 productos** para los setup fees:
   - "Prontara Básico - Alta" → precio **one-time** de **590 EUR**.
   - "Prontara Estándar - Alta" → precio **one-time** de **990 EUR**.
   - "Prontara Premium - Alta" → precio **one-time** de **1.490 EUR**.
3. En cada producto, copia el **Price ID** (formato `price_XXXXXXX`). Lo necesitas en el siguiente paso.
4. Crea un **4º producto** para el soporte:
   - "Prontara Soporte" → precio **recurring monthly** de **12 EUR** con **per-unit billing** (cantidad = usuarios concurrentes).
   - Copia el Price ID.

## Configurar variables de entorno

En `prontara-factory/.env` (o las variables de entorno del proveedor de hosting en producción):

```bash
# Claves de Stripe
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXX

# Setup fees (Price IDs de los 3 planes)
STRIPE_SETUP_PRICE_BASICO=price_XXXXXXXXXX
STRIPE_SETUP_PRICE_ESTANDAR=price_XXXXXXXXXX
STRIPE_SETUP_PRICE_PREMIUM=price_XXXXXXXXXX

# Soporte mensual (Price ID per-unit recurring)
STRIPE_SUPPORT_PRICE=price_XXXXXXXXXX

# URL pública de la app (para success/cancel del checkout)
APP_BASE_URL=https://app.tudominio.com
```

Reinicia `pnpm dev` después de cambiar el `.env` — Next.js solo lee variables al arrancar.

## Configurar el webhook

1. <https://dashboard.stripe.com/webhooks> → Add endpoint.
2. URL: `https://app.tudominio.com/api/runtime/billing-confirm` (o la equivalente en producción).
3. Eventos a escuchar (mínimo):
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el "Signing secret" → `STRIPE_WEBHOOK_SECRET`.

## Probar el checkout

Modo test:

1. Cambia las claves a las de test (`sk_test_…`).
2. Crea Price IDs de test con los mismos importes.
3. Entra al ERP de un tenant en trial → `/suscripcion`.
4. Click en cualquier plan distinto de trial → te lleva a Stripe Checkout.
5. Tarjeta de prueba: `4242 4242 4242 4242`, CVV `123`, fecha futura.
6. Tras pagar, vuelves a `/suscripcion?success=1` y el plan queda en `active`.
7. Verifica que llegó la suscripción al webhook (Stripe → "Logs").

## Estado actual del código

- `src/lib/saas/billing-store.ts` — catálogo con setupFeeCents y supportMonthlyCentsPerUser.
- `src/lib/saas/billing-stripe.ts` — `createStripeCheckoutSession` cobra el setup fee one-time. Activa la suscripción de soporte se hace por separado (pendiente de UI específica en panel admin).
- `src/lib/saas/billing-store.ts` — `activatePaidPlan` graba `setupFeePaidCents` y marca `supportActive: true` automáticamente al pagar el alta. El operador puede desactivar soporte luego desde el panel.
- `subscription-guard.ts` — sigue funcionando: solo bloquea acceso si status es `cancelled`.
- `business-analytics.ts` — MRR ahora se calcula como `support × concurrentUsersBilled` para tenants con `supportActive=true`. Los setup fees aparecen en `nonRecurringMonthCents`.

## Migración de datos existentes

Los ficheros `data/saas/billing/<clientId>.json` antiguos con planes `starter|growth|pro` se migran automáticamente al primer leer:

- `starter` → `basico`
- `growth` → `estandar`
- `pro` → `premium`
- Si el status era `active` en el modelo viejo, asume que se pagó el setup y activa soporte.

La migración se hace lazy: no hay script destructivo, simplemente al leer el fichero la primera vez se devuelve en formato nuevo, y al guardar siguiente queda persistido. Para ejecutar la migración explícitamente, abre cada tenant en `/factory/client/<clientId>` o llama a `getOrCreateBillingSubscription` desde un script.
