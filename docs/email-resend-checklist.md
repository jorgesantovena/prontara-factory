# Resend · checklist de configuración

Tiempo estimado: 30-60 min (la mayor parte es esperar la propagación DNS).

## Paso 1 · Crear cuenta y proyecto

1. Ve a <https://resend.com> y regístrate. Tier gratuito: 3.000 emails/mes y 100/día.
2. Resend te pide verificar tu email para activar la cuenta.
3. Ya dentro, no es necesario crear "proyectos": funciona con un único workspace.

## Paso 2 · Verificar el dominio

Esto es **crítico**: hasta que el dominio esté verificado, los emails reales no salen.

1. Sidebar → **Domains** → **Add Domain**.
2. Introduce `prontara.com`. Resend te muestra una pantalla con varios registros DNS que tienes que poner en tu registrador.

Los registros típicos (los exactos te los da Resend, no copies estos a ciegas):

| Tipo | Nombre | Valor |
|---|---|---|
| TXT | `send.prontara.com` | `v=spf1 include:amazonses.com ~all` |
| MX | `send.prontara.com` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) |
| TXT | `resend._domainkey.prontara.com` | (clave DKIM larga) |
| TXT | `_dmarc.prontara.com` | `v=DMARC1; p=none;` |

3. Entra en tu **registrador de DNS** (donde compraste prontara.com — Cloudflare, GoDaddy, Namecheap, Hostinger, etc.).
4. Crea cada uno de los registros tal como Resend te indica. **Copia y pega exactamente** — los valores tienen comillas y caracteres especiales.
5. Guarda y espera. La verificación tarda **5-30 min** normalmente; si tu registrador es lento puede llegar a 24h.
6. Vuelve a Resend → Domains → tu dominio → click "Verify". Si está OK, aparece en verde "Verified".

**Si no se verifica**:
- Confirma que no añadiste `prontara.com.` con punto extra al final.
- Algunos registradores duplican el dominio (`send.prontara.com.prontara.com`); revisa.
- Usa <https://mxtoolbox.com> para confirmar que los TXT están publicados.

## Paso 3 · Crear API key

1. Sidebar → **API Keys** → **Create API Key**.
2. Nombre: `prontara-factory-prod` (o lo que quieras identificar después).
3. Permission: **Sending access** (no necesitas full access).
4. Domain: el que acabas de verificar.
5. Click Create. Copia la key — empieza por `re_...`. **Solo se muestra una vez**.

## Paso 4 · Configurar Prontara

En `prontara-factory/.env`:

```bash
RESEND_API_KEY=re_XXXXXXXXXXXXXXXX
PRONTARA_FROM_EMAIL=hola@prontara.com
PRONTARA_APP_BASE_URL=https://app.prontara.com
```

- `PRONTARA_FROM_EMAIL` debe ser una dirección **dentro del dominio verificado**. No tiene que existir como buzón real (Resend no recibe emails desde ahí; solo manda).
- `PRONTARA_APP_BASE_URL` es la URL pública donde corre la app. En desarrollo puedes poner `http://localhost:3000`.

Reinicia `pnpm dev`.

## Paso 5 · Probar que funciona

### Test 1: outbox (siempre disponible)

Si aún no terminaste lo anterior, puedes probar el flujo completo sin enviar emails reales:

1. `/factory/lifecycle` → "Ejecutar envíos reales".
2. Mira `data/saas/mail-outbox/` — habrá `.txt` por cada email "enviado".

### Test 2: Resend real

1. En Resend, sidebar → **Logs** → quédate ahí.
2. En Prontara → `/factory/lifecycle` → "Ejecutar envíos reales".
3. En Resend → Logs aparecen los envíos en segundos.
4. Verifica el email que llegó al buzón objetivo.

Si en Logs aparece un envío con status "Failed":
- Click el envío → ves el error completo.
- Causas comunes: dominio no verificado, From email no permitido, key revocada.

## Paso 6 · Producción

Cuando despliegues a Vercel/Fly/lo que uses:

- Añade las mismas 3 variables al panel del proveedor.
- En Resend, considera crear una API key separada `prontara-factory-staging` con scope solo a un email de prueba para no romper producción al testear.
- Si esperas más de 100 emails/día (cuando llegues a 30-50 clientes activos), considera el plan Pro de Resend (15 € / mes, 50.000 emails / mes).

## Cómo se usa desde el código

Ya está listo. Cuando configuras `RESEND_API_KEY`, automáticamente:

- Los lifecycle emails (`/factory/lifecycle` "Ejecutar reales") salen por Resend.
- El email de activación de un tenant nuevo (cuando completas alta) también va por Resend.
- Si Resend falla por cualquier razón, automáticamente cae al outbox como fallback (ver `src/lib/saas/email-service.ts`).

## Si quieres cambiar el contenido de los emails

Edita `src/lib/saas/lifecycle-catalog.ts`. Cada evento tiene un `render()` que devuelve `{subject, text}`. El texto es plano por simplicidad — fácil de mantener y compatible con todos los clientes de email.
