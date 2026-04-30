# Configuración de email transaccional

Prontara envía emails para:

- Activación de cuenta (al provisionar un tenant — manual o desde el chat).
- Recordatorios de trial (7 días y 1 día antes de expirar).
- Confirmaciones de suscripción y cancelación.
- Reactivación de cuentas canceladas.

Todos pasan por `src/lib/saas/email-service.ts`, que tiene dos modos:

1. **Resend** (real) — si están configuradas las variables de entorno.
2. **Outbox** (fallback) — guarda los emails como `.txt` en `data/saas/mail-outbox/` para que los puedas inspeccionar localmente sin enviar nada.

## Configuración real con Resend

### 1. Crear cuenta y verificar dominio

1. Registro en <https://resend.com>.
2. **Domains** → Add Domain → introduce el dominio desde el que enviarás (ej. `prontara.com`).
3. Resend te da unos registros DNS (TXT/MX/CNAME). Configúralos en tu registrador.
4. Espera la verificación (suele ser 5-30 min). Hasta que esté verde no puedes enviar desde ese dominio en producción.

### 2. Crear API key

1. **API Keys** → Create API Key.
2. Da permisos de `Sending access`.
3. Copia la clave (`re_…`). Solo se muestra una vez.

### 3. Configurar variables

En `prontara-factory/.env`:

```bash
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXX
PRONTARA_FROM_EMAIL=hola@tudominio.com
PRONTARA_APP_BASE_URL=https://app.tudominio.com
```

- `PRONTARA_FROM_EMAIL` debe ser una dirección dentro del dominio verificado en Resend.
- `PRONTARA_APP_BASE_URL` es la URL pública de tu app en producción (sin barra final). Se usa en los enlaces de los emails (`/acceso?tenant=...`, `/suscripcion?tenant=...`).

Reinicia `pnpm dev` (o el servicio de producción) tras cambiar el `.env`.

## Probar que funciona

### Prueba en local con outbox (sin Resend)

Si no tienes Resend aún configurado, los emails caen en `data/saas/mail-outbox/`:

1. Entra al panel `/factory/lifecycle` como admin.
2. Click "Ejecutar envíos reales".
3. Mira la carpeta `data/saas/mail-outbox/` — verás un `.txt` por email "enviado".

Esto es perfecto para iterar el contenido de los emails sin gastar cuota.

### Prueba en local con Resend test

Si configuras Resend pero no quieres enviar a clientes reales, usa Resend en **modo testing** (con un dominio sandbox que solo manda a ti) o cambia `PRONTARA_FROM_EMAIL` y los `to` para que sean tus propias direcciones.

## Diagnóstico

| Síntoma | Causa probable | Solución |
|---|---|---|
| Los emails caen al outbox aunque Resend esté configurado | Falta `RESEND_API_KEY` o `PRONTARA_FROM_EMAIL` | Revisar `.env`, reiniciar |
| Resend devuelve 401 | API key inválida o revocada | Generar nueva en panel Resend |
| Resend devuelve 403 "domain not verified" | Dominio aún sin verificar o `PRONTARA_FROM_EMAIL` no pertenece al dominio | Esperar verificación o ajustar email |
| Email llega a spam | DKIM/SPF mal configurados | Revisar todos los DNS records que pidió Resend |
| Plantillas con texto raro o caracteres mal | Encoding | El servicio fuerza UTF-8 — no debería pasar; abrir issue |

## Lifecycle automation con email real

Una vez configurado Resend:

1. Ve a `/factory/lifecycle` como admin.
2. La página muestra qué emails están pendientes según las reglas (trial expirando, suscripción cancelada, etc.).
3. Click "Ejecutar envíos reales" — los emails salen por Resend.
4. La tabla "Historial reciente" muestra cuándo se envió cada uno (idempotencia: no se repiten dentro de la ventana definida por evento).

## Tipos de emails que se envían

Definidos en `src/lib/saas/lifecycle-catalog.ts`:

| Evento | Cuándo | Una vez |
|---|---|---|
| `trial-reminder-7d` | 6-8 días antes de expirar el trial | Sí dentro de 5 días |
| `trial-reminder-1d` | ≤ 1 día para expirar | Sí dentro de 2 días |
| `trial-expired` | Trial vencido sin plan de pago | Una sola vez |
| `subscription-activated` | Plan de pago activado | Una sola vez |
| `subscription-cancelled` | Cancelación o cancelación programada | Una sola vez |
| `reactivation-invite` | Cancelada hace ≥ 30 días | Una sola vez |

Para editar el contenido de un email, abre `lifecycle-catalog.ts` y modifica el `render()` correspondiente. Texto plano por simplicidad — fácil de mantener y compatible con cualquier proveedor.
