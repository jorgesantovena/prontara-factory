# Deploy de Prontara en Vercel + Neon

Guía completa para llevar Prontara de tu PC a producción real en Vercel
con base de datos en Neon (Postgres serverless).

Tiempo estimado: 1-2 horas la primera vez. Re-deploys posteriores: 30 segundos.

## Requisitos previos

1. Cuenta en GitHub con el repo `prontara-factory` subido (privado o público).
2. Cuenta en <https://vercel.com> (gratuita, conecta con GitHub).
3. Cuenta en <https://neon.tech> (gratuita hasta 0,5 GB).
4. Dominio que apunta a tu app — recomendado `app.prontara.com` para
   separar marketing (`prontara.com`, en WordPress) de producto.

## Paso 0 · Antes de tocar nada

**Importante**: Prontara hoy guarda sus datos en ficheros JSON dentro de
`data/` y `.prontara/`. En Vercel **el filesystem es efímero** — cada
despliegue tiene un fs limpio. Antes de pasar a producción tienes que
migrar a una base de datos persistente. Esta guía te pone Postgres en
Neon como destino, pero **la migración del código a Postgres es trabajo
adicional** que no está en el repo todavía.

Tienes dos opciones para empezar:

- **Opción A (recomendada para validar la idea)**: deploy en Vercel sin
  Postgres aún. Funciona para que vean la landing pública. Login y datos
  de tenants no funcionarán hasta que se migre.
- **Opción B (recomendada para tener clientes reales)**: completar la
  migración a Postgres antes de deploy. Es ~2-3 días de trabajo. Pídelo
  como tarea a Claude cuando estés listo.

El resto de la guía cubre Opción A — landing pública en Vercel.

## Paso 1 · Crear proyecto en Neon

1. <https://console.neon.tech> → New Project.
2. Nombre: `prontara-prod`. Region: `eu-central-1` (Frankfurt) para tener
   menos latencia en Europa.
3. Postgres version: la más reciente (16 a fecha de esta doc).
4. Create.
5. En la pantalla siguiente Neon te muestra el **Connection String** con
   formato `postgresql://user:pass@xxx.eu-central-1.aws.neon.tech/dbname?sslmode=require`.
   Cópialo. Lo necesitas en el paso 4.

## Paso 2 · Conectar el repo a Vercel

1. <https://vercel.com/new> → Add New Project.
2. Selecciona el repo de GitHub `prontara-factory`.
3. Vercel autodetecta Next.js — no toques nada del build.
4. **No despliegues todavía**: clic en "Environment Variables" antes de
   "Deploy".

## Paso 3 · Variables de entorno mínimas para producción

Pega estas en Vercel → Settings → Environment Variables (Production):

```
# === Sesión (obligatorio en producción) ===
PRONTARA_SESSION_SECRET=<genera una cadena aleatoria de 64 chars>

# === Base de datos (cuando migres a Postgres) ===
DATABASE_URL=postgresql://user:pass@xxx.eu-central-1.aws.neon.tech/prontara?sslmode=require

# === Anthropic (chat del Factory) ===
ANTHROPIC_API_KEY=sk-ant-api03-...

# === Stripe ===
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SETUP_PRICE_BASICO=price_...
STRIPE_SETUP_PRICE_ESTANDAR=price_...
STRIPE_SETUP_PRICE_PREMIUM=price_...
STRIPE_SUPPORT_PRICE=price_...

# === Email (Resend con dominio verificado) ===
RESEND_API_KEY=re_...
PRONTARA_FROM_EMAIL=hola@prontara.com

# === URLs públicas ===
APP_BASE_URL=https://app.prontara.com
PRONTARA_APP_BASE_URL=https://app.prontara.com

# === Datos legales (para que se rellenen en /legal/*) ===
PRONTARA_LEGAL_COMPANY_NAME=Tu razón social SL
PRONTARA_LEGAL_NIF=B12345678
PRONTARA_LEGAL_ADDRESS=Calle X 1, 28001 Madrid
PRONTARA_LEGAL_EMAIL=hola@prontara.com
PRONTARA_DPO_EMAIL=privacidad@prontara.com
```

**Para generar `PRONTARA_SESSION_SECRET`** desde PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Guarda los 64+ caracteres resultantes en la variable. **No reutilices el
de desarrollo** — debe ser distinto en producción.

## Paso 4 · Deploy

Click "Deploy" en Vercel. La primera vez tarda 2-5 minutos.

Si todo va bien verás `https://prontara-factory-xxxxx.vercel.app`. Visítala:

- `/verticales` debería cargar el catálogo público.
- `/precios`, `/como-funciona`, `/faq`, `/contacto` también.
- `/acceso`, `/factory/*`, `/api/runtime/*` darán errores (porque no hay
  Postgres todavía y Prontara intenta leer ficheros que no existen).

## Paso 5 · Conectar tu dominio

1. Vercel → Settings → Domains → Add.
2. Introduce `app.prontara.com`.
3. Vercel te dice qué registro DNS añadir (CNAME).
4. Ve al panel DNS de tu dominio → añade el CNAME.
5. Espera la verificación (5-30 min). Vercel emite SSL automático.

## Paso 6 · Configurar el webhook de Stripe en producción

1. <https://dashboard.stripe.com/webhooks> (modo `Live`, no test).
2. Add endpoint: `https://app.prontara.com/api/runtime/billing-confirm`.
3. Eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
4. Copia el "Signing secret" → actualiza `STRIPE_WEBHOOK_SECRET` en Vercel.
5. **Redeploy** (Vercel → Deployments → último → Redeploy) para que las
   variables actualizadas se apliquen.

## Paso 7 · Configurar Resend en producción

Sigue `docs/email-resend-checklist.md`. El paso DNS ya lo hiciste para
verificar el dominio; aquí solo necesitas asegurar que `RESEND_API_KEY` y
`PRONTARA_FROM_EMAIL` están en Vercel y que el dominio sigue verificado
en Resend.

Test rápido: desde tu cuenta admin en producción, `/factory/lifecycle` →
"Ejecutar envíos reales". Si llegan los emails, está OK.

## Paso 8 · Configurar GitHub Actions de respaldo (opcional)

Vercel hace un build por cada push a `main`. Si quieres además hacer que
falle el deploy si hay errores de tsc, añade en `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit
```

## Paso 9 · Migración a Postgres (cuando llegue el momento)

Esto es trabajo adicional. La migración tiene cuatro frentes:

1. **Schema Prisma**: extender `prisma/schema.prisma` con tablas para todo
   lo que hoy vive en JSON: `tenants`, `accounts`, `subscriptions`,
   `trial_state`, `onboarding_state`, `lifecycle_state`, `leads`,
   `audit_entries`, `chat_conversations`, `chat_messages`.
2. **Adapter pattern**: cada `*-store.ts` actual tiene que poder funcionar
   con Postgres en producción y ficheros en local. Un flag
   `PRONTARA_PERSISTENCE=postgres|filesystem` lo decide.
3. **Migración de datos**: script que lee el `data/` actual y lo carga en
   Postgres. Solo se ejecuta una vez por entorno.
4. **Update de las funciones de listado**: por ejemplo
   `listTenantClientsIndex` hoy lee directorios; tendría que SELECT.

Estimación realista: **2-3 días** de trabajo cuidadoso, con backup,
testing en staging antes de producción y un rollback plan.

Cuando estés listo, pídelo a Claude como tarea explícita ("migra
billing-store y account-store a Postgres") y lo hace.

## Diagnóstico común

| Síntoma | Causa probable | Solución |
|---|---|---|
| 500 al cargar `/verticales` | Falta `listSectorPacks()` en build, problema de import | Revisar logs en Vercel → Functions |
| `/acceso` da 401 sin entrar | Falta `PRONTARA_SESSION_SECRET` | Configurar en Vercel y redeploy |
| Email no llega | Resend no verificado o `RESEND_API_KEY` mal | Reverificar dominio en Resend, regenerar API key |
| Stripe checkout 400 | Falta algún `STRIPE_SETUP_PRICE_*` | Correr `node scripts/setup-stripe-products.mjs` con `sk_live_...` |
| 500 en cualquier `/factory/*` | Falta migración a Postgres | Hacer la migración (paso 9) o desactivar esas rutas hasta entonces |

## Costes estimados de producción

Con estos servicios y 0-10 clientes:

- **Vercel** Hobby (free): 0 € si tráfico bajo. Pro: 20 $/mes.
- **Neon** Free: 0 € hasta 0,5 GB. Pro: 19 $/mes.
- **Resend**: free hasta 3.000 emails/mes. Pro: 20 $/mes.
- **Stripe**: 1,4 % + 0,25 € por transacción europea. Cobras 590 € por
  alta → 8,51 € de comisión. No cuesta nada estar dado de alta.
- **Anthropic**: tu uso del chat — cuelga del consumo de tokens. Tier 1
  con 5-10 €/mes te llega para uso interno tuyo.
- **Dominio**: 10-15 €/año.

**Total fijo mensual estimado en arranque**: 0-15 € si no cruzas tiers
gratuitos, 50-80 € cuando llegues a Pro de varios servicios.

## Antes de cobrar el primer 590 €

Lista mínima:

- [ ] Producción desplegada en Vercel y accesible vía dominio.
- [ ] Postgres migrado y los datos guardándose ahí.
- [ ] Stripe en modo `Live` con productos creados y webhook funcionando.
- [ ] Resend con dominio verificado y emails llegando.
- [ ] Páginas `/legal/*` con tus datos fiscales reales.
- [ ] Asesor revisando los términos antes de publicar.
- [ ] Test end-to-end: alguien ajeno a ti se da de alta, paga con tarjeta
  real (puedes empezar tú mismo con tu propia tarjeta), recibe email,
  entra al ERP y opera.

Cuando los 7 estén marcados, ya puedes vender.
