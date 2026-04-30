# Factory Chat — configuración inicial

El chat interno de la Factory (`/factory/chat`) conecta con **Claude** (Anthropic) para responder con lenguaje natural y ejecutar tools sobre tu Factory. Esta guía cubre los cinco pasos que hay que hacer una sola vez para que funcione.

Tiempo estimado: 5 minutos + validación con tarjeta.

## 1. Crear cuenta en Anthropic

1. Abre <https://console.anthropic.com/>.
2. Regístrate con tu email. Confirma el correo de verificación.
3. Cuando entres, verás el dashboard del Console.

## 2. Añadir crédito de prepago

El uso de la API es de pago por consumo (pay-as-you-go). Hay que cargar crédito antes de la primera llamada.

1. En la barra lateral, ve a **Plans & Billing** (o similar).
2. Añade tarjeta y compra **5 $ o 10 $ de crédito** para empezar. Es suficiente para mucho uso interno.
3. Activa **Auto-reload** opcionalmente (recarga automática cuando baje del mínimo); cómodo si vas a usar el chat a diario.

Coste estimado con Claude Sonnet 4.6 y uso razonable: 5-20 €/mes. Un mensaje corto ~1 céntimo; una conversación larga con adjuntos grandes, 10-30 céntimos.

## 3. Generar API key

1. Ve a **Settings → API Keys**.
2. Click **Create Key**.
3. Dale un nombre descriptivo, por ejemplo `prontara-factory-prod` o `prontara-factory-dev`.
4. Copia la clave (empieza por `sk-ant-api03-...`). **Solo se muestra una vez** — si la pierdes tienes que generar otra.

## 4. Poner la clave en tu `.env`

En la raíz de `prontara-factory/` abre el fichero `.env` (o créalo si no existe) y añade una línea:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-tu-clave-aqui
```

**Importante:**
- Nunca hagas commit de `.env` al repositorio. El `.gitignore` del proyecto ya lo excluye (F-18).
- Si despliegas en producción (Vercel, Fly, etc.), configura la variable de entorno equivalente en el panel del proveedor.

## 5. Reiniciar el servidor

```bash
pnpm dev
```

Abre <http://localhost:3000/factory/chat> (habiendo iniciado sesión con una cuenta con rol `admin` o `owner`). Verás el chat funcionando. Si falta la clave, el chat muestra un banner amarillo indicándolo.

## Qué puede hacer (Fase 1 + Fase 2)

**Lectura** (sin efectos secundarios):

- `list_tenants` — listar todos los tenants de la Factory.
- `read_tenant_detail` — ficha detallada de un tenant por clientId.
- `list_verticals` — catálogo de sector packs.
- `read_vertical` — definición completa de un vertical.
- `read_factory_health` — estado de salud técnica.
- `read_repo_file` — leer archivos dentro de `src/`, `docs/`, `scripts/`, `prisma/` y archivos sueltos en raíz.
- `list_repo_files` — listar directorios dentro del whitelist.
- `read_audit_log` — consultar el historial de escrituras del chat.
- `list_backup_snapshots` — listar snapshots de escrituras previas.

**Escritura** (auditadas, con snapshot previo automático cuando aplica):

- `write_repo_file(path, content)` — crea o reescribe un fichero dentro de `src/`, `docs/`, `scripts/` o `prisma/schema.prisma`.
- `patch_repo_file(path, oldString, newString, replaceAll?)` — edición quirúrgica por find-replace.
- `run_tsc_check` — valida TypeScript tras escribir (filtra ruido de entorno).
- `run_lint_check(paths?)` — corre ESLint sobre paths opcionales.
- `restore_backup_snapshot(backupRef)` — rollback de un snapshot anterior si algo salió mal.
- `regenerate_tenant(clientId)` — cierra el loop tras modificar un vertical: verifica que el tenant existe, inicializa trial/onboarding idempotentemente e invalida la caché del dashboard.
- `invalidate_factory_cache` — invalida solo la caché en memoria del dashboard de Factory.

Ejemplos de prompts:

- *"Lista mis tenants y dime cuál lleva más tiempo sin modificarse"*
- *"Enséñame el vertical software-factory y resume cómo se diferencia del de gimnasio"*
- *"Lee `sector-pack-registry.ts` y dime cuántos verticales están registrados"*
- *"Añade un módulo 'tarjetas' al vertical software-factory con campos Número, Titular, Saldo y Estado. Valida con tsc."*
- *"Cambia el label del vertical gimnasio de 'Gimnasio' a 'Gimnasio & Wellness'."*
- *"Adjunto un .docx con un roadmap; resúmeme los bloques que no están hechos"*
- *"¿Qué ficheros has tocado en las últimas 2 horas? Enséñame el log de auditoría."*

## Auditoría y rollback

Cada escritura genera dos artefactos automáticamente:

1. **Snapshot previo** en `.prontara/backups/chat-writes/<timestamp>-<rand>/` con la versión anterior exacta de los ficheros tocados.
2. **Entrada JSONL** en `data/factory/chat/audit/YYYY-MM-DD.jsonl` con: hora ISO-8601, actor (accountId + email), conversationId, tool, input, outcome, duración en ms, paths tocados y backupRef.

Puedes pedir al chat *"¿qué has modificado hoy?"* (usa `read_audit_log`). Si un cambio salió mal, *"restaura el snapshot XYZ"* (usa `restore_backup_snapshot`) vuelve al estado anterior y a su vez genera otro snapshot del estado actual por si el rollback fuera el error.

Whitelist de escritura más estricto que el de lectura: solo `src/`, `docs/`, `scripts/` y `prisma/schema.prisma`. `data/`, `.env*`, `.prontara/`, `.next/`, `node_modules/` y `.git/` están bloqueados.

## Imágenes

El chat acepta capturas y fotos (PNG, JPG, GIF, WebP). Se adjuntan con el 📎 igual que los PDF/DOCX, aparecen como thumbnail en el composer y en el mensaje enviado, y el modelo las recibe como bloques visuales nativos (multimodal). Útil para reportar bugs de UI pasando una captura y diagnosticar directamente. Las imágenes solo se envían en el turno actual; en turnos siguientes hay que volver a adjuntarlas si se quiere revisar.

## Qué NO puede hacer todavía (Fase siguiente)

- Búsqueda vectorial del código (indexado semántico).
- Enviar emails reales fuera del pipeline de lifecycle (Stripe, webhooks externos).

## Seguridad

- **Autenticación:** el endpoint requiere sesión de runtime con rol `admin` u `owner`. Cualquier otro rol recibe 401.
- **Rutas de archivo:** `read_repo_file` tiene whitelist estricto (`src/`, `docs/`, `scripts/`, `prisma/`). Fuera de esos prefijos recibe error. Así `data/` (donde viven datos sensibles por tenant) y `.env` no son accesibles.
- **Adjuntos:** máximo 10 MB por archivo. Se guardan en `data/factory/chat/uploads/` con ID aleatorio. El chat nunca devuelve el binario, solo el texto extraído.
- **Historial:** las conversaciones viven en `data/factory/chat/<accountId>/`. Cada usuario ve solo las suyas.
- **Coste controlado:** cada conversación tiene un máximo de 10 iteraciones de tool use por turno. Si el modelo entra en loop se corta y avisa.

## Diagnosticar problemas

**"Se requiere sesión con rol admin en la Factory."** → Estás logueado con un rol sin permisos. Usa una cuenta admin/owner o crea una.

**"Falta ANTHROPIC_API_KEY en el entorno."** → Paso 4 no completado. Revisa que la clave esté en `.env` y reinicia el servidor.

**"Error 401 llamando a Anthropic"** → La clave es inválida o se revocó. Genera otra en el Console.

**"Error 429 llamando a Anthropic"** → Te quedaste sin crédito. Recarga en **Plans & Billing**.

**El chat no responde con datos reales del tenant** → Comprueba que `list_tenants` devuelve la lista que esperas; si está vacía probablemente no hay tenants provisionados todavía en tu entorno.
