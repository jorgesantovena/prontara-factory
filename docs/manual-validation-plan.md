# Plan de validación manual del flujo Factory → Vertical → Tenant

Este checklist se ejecuta con browser real antes de declarar el sistema
listo para clientes. Cubre los flujos críticos.

**Tiempo estimado**: 30-45 min la primera vez; 10 min en re-tests.

## Pre-requisito · Smoke test programático verde

```powershell
node scripts/smoke-test-factory-flow.mjs
```

Si algún paso falla, arreglar antes de seguir. El smoke test detecta
incoherencias que no se ven en browser hasta que un usuario real las pisa.

## Sección 1 · Acceso del cliente al ERP (runtime)

Tenant de prueba: `estandar-20260419194129` (slug: `software-factory-demo`).

### 1.1 Login con admin existente
- [ ] `pnpm dev` corriendo.
- [ ] Abrir <http://localhost:3000/acceso> en navegador limpio (incógnito).
- [ ] Tenant: `software-factory-demo`. Email: el de tu cuenta admin. Password: el real.
- [ ] Click "Entrar" → redirige a `/?tenant=software-factory-demo`.
- [ ] El dashboard carga sin errores en consola.
- [ ] Arriba hay un chip con tu email y rol "owner".

### 1.2 Forgot password
- [ ] Cerrar sesión.
- [ ] `/acceso` → click "¿Olvidaste tu contraseña?".
- [ ] Form con tenant + email → click "Enviar".
- [ ] Mensaje verde "Si el email existe, recibirás el enlace".
- [ ] Si Resend no está configurado: mirar `data/saas/mail-outbox/` — debe haber un .txt nuevo.
- [ ] Si Resend SÍ configurado: revisar bandeja (puede tardar 1-2 min).
- [ ] Copiar el enlace del email/outbox y pegarlo en navegador.
- [ ] `/restablecer?token=...` muestra dos campos password.
- [ ] Probar con password muy corta — debe rechazar (mín 8).
- [ ] Probar con passwords no coincidentes — debe rechazar.
- [ ] Password válida → "Contraseña actualizada".
- [ ] Click "Ir a iniciar sesión" → entrar con la nueva. Funciona.

## Sección 2 · Vertical aplicado correctamente

Ya logueado en el runtime del tenant Software Factory Demo:

### 2.1 Branding y módulos
- [ ] El header muestra "Software Factory Demo".
- [ ] Color acento azul Prontara (no el default genérico).
- [ ] Nav lateral / breadcrumbs: módulos del software-factory pack
  (Clientes, CRM, Proyectos, Presupuestos, Facturación, Documentos…).
- [ ] **No** aparecen labels de otros verticales (no hay "Pacientes" si es software).

### 2.2 Datos demo coherentes
- [ ] `/clientes` → ves "Acme Legal", "Nova Health", "Blue Retail".
- [ ] `/proyectos` → 3 proyectos al menos.
- [ ] `/crm` → 1 oportunidad.
- [ ] `/presupuestos`, `/facturacion`, `/documentos` cargan sin error.

### 2.3 Dashboard del vertical Software Factory
- [ ] Visita `/software-factory`.
- [ ] Ves los 8 KPIs del vertical (Clientes, Pipeline, Proyectos
  activos, En riesgo, Propuestas abiertas, Facturas pendientes,
  Entregables 30d, Carga operativa).
- [ ] El bloque "Pipeline por fase" muestra al menos una fase con datos.
- [ ] Si hay alertas operativas, aparecen.
- [ ] Tres botones de acceso rápido: "Proyectos en riesgo", "Propuestas
  estancadas", "Facturas vencidas".
- [ ] Click en cada uno carga su lista focal.

## Sección 3 · CRUD de módulos

### 3.1 Crear un cliente nuevo
- [ ] `/clientes` → click "Añadir" o equivalente.
- [ ] Rellena el formulario. Los **campos son los del vertical** —
  para software-factory: Cliente, Último contacto, Segmento, Estado.
- [ ] Submit → vuelve al listado con el nuevo registro.
- [ ] El conteo arriba sube en 1.

### 3.2 Editar y borrar
- [ ] Click en el cliente que acabas de crear → editor.
- [ ] Cambia algún campo, guarda. Vuelve al listado, dato cambiado.
- [ ] Borra el cliente. Confirmación. Tras OK desaparece.

### 3.3 Asistente
- [ ] `/asistente` o icono del asistente del runtime.
- [ ] Pregunta *"qué proyectos tengo en riesgo"* — debe responder con
  los proyectos del módulo, no inventar.
- [ ] Pregunta *"cuántos clientes tengo"* — devuelve el conteo real.

## Sección 4 · Suscripción y soporte (modelo real)

### 4.1 Página /suscripcion
- [ ] `/suscripcion?tenant=software-factory-demo`.
- [ ] Ves los 4 planes: Trial, Básico (590€), Estándar (990€), Premium (1.490€).
- [ ] Cada plan muestra setup fee como pago único.
- [ ] Bajo el precio: "+ soporte: 12€ por usuario concurrente al mes".
- [ ] El plan actual (trial) marcado como "Plan actual".
- [ ] Días restantes del trial = 14 (o lo que sea según fecha).

### 4.2 Activar plan (sin Stripe en local — solo registro)
- [ ] Mirar el flujo: click "Empezar con Estándar" — debe llevar a Stripe
  checkout si está configurado, o dar error claro si no lo está.

### 4.3 Soporte mensual desde el panel admin
- [ ] Loguear como Factory admin (mismo usuario, va a `/factory`).
- [ ] `/factory/client/estandar-20260419194129`.
- [ ] Sección "Soporte mensual" — botón "Soporte inactivo" (rojo).
- [ ] Click "Activar". Se pone verde "Soporte activo".
- [ ] Ajusta usuarios concurrentes a 3. "Guardar". Nota: MRR = 36€/mes.
- [ ] Ve a `/factory/analiticas` — el MRR debería incluir esos 36€.

### 4.4 Emitir factura
- [ ] En el mismo `/factory/client/...`, sección "Facturas".
- [ ] Sin marcar "Enviar a Stripe" → click "Emitir factura".
- [ ] Aparece la factura en la tabla con estado "issued".
- [ ] Cambia el estado a "paid" desde el select. Persiste.

## Sección 5 · Editor visual de verticales

### 5.1 Editar branding del vertical
- [ ] `/factory/verticales/software-factory`.
- [ ] Tab "General" → cambia el accentColor a `#dc2626`. Guardar.
- [ ] Vuelve al runtime del tenant `/?tenant=software-factory-demo`.
- [ ] El acento debería ser rojo ahora (puede haber caché de 60s).
- [ ] Si tarda, fuerza refresh con Ctrl+F5.

### 5.2 Añadir un módulo al vertical
- [ ] `/factory/verticales/software-factory` → tab Módulos.
- [ ] "+ Añadir módulo": `tarjetas-fidelizacion`, label "Tarjetas".
- [ ] Guardar.
- [ ] Vuelve al runtime → debe aparecer "Tarjetas" en la nav (puede que
  como módulo vacío sin entidades — es esperado).

### 5.3 Volver a base
- [ ] Botón "Volver a base" → confirma → desaparece el override.
- [ ] Color y módulos vuelven al estado original.

## Sección 6 · Operaciones e incidencias

- [ ] `/factory/operaciones`.
- [ ] Las 7 tarjetas del resumen cargan con datos.
- [ ] Si hay tenants con issues, salen en la sección correspondiente.
- [ ] Si hay trials vencidos en ≤3 días, aparecen.
- [ ] Auto-refresh cada minuto (o click "Refrescar").

## Sección 7 · Chat de la Factory

### 7.1 Lectura
- [ ] `/factory/chat` → nueva conversación.
- [ ] *"Lista mis tenants"* — ejecuta `list_tenants` y muestra los reales.
- [ ] *"Enséñame el vertical software-factory"* — `read_vertical` con datos correctos.

### 7.2 Escritura auditada
- [ ] *"Cambia el accentColor del vertical software-factory a #16a34a"*.
- [ ] El chat usa `patch_repo_file` o `write_repo_file` — chip naranja.
- [ ] Tras la respuesta, recarga `/factory/verticales/software-factory`.
- [ ] El color cambió.
- [ ] `/factory/auditoria` muestra la entrada con el backup ref.
- [ ] Click "Revertir" en esa entrada → vuelve al color anterior.

### 7.3 Multimodal
- [ ] Adjunta una captura de pantalla con el 📎.
- [ ] Aparece thumbnail en el composer.
- [ ] Pregunta "¿qué ves?". El modelo describe la imagen.

## Sección 8 · Lifecycle automation

- [ ] `/factory/lifecycle`.
- [ ] Sin clientes con trials vencidos: "Ningún tenant tiene emails pendientes".
- [ ] Para forzar test: edita manualmente `data/saas/trial/<clientId>.json`,
  cambia `daysRemaining` y `expiresAt` a hace 1 día.
- [ ] Refresca la página → aparece evento "trial-reminder-1d" pendiente.
- [ ] Click "Ver email" → preview del subject + texto.
- [ ] "Dry-run" — no envía pero simula.
- [ ] "Ejecutar envíos reales" — envía (Resend o outbox).
- [ ] Tras ejecutar, el evento desaparece (idempotencia activa).

## Sección 9 · Páginas legales y públicas

- [ ] `/verticales` → catálogo público sin login. Las 6 cards de packs.
- [ ] `/precios` → planes con precios reales.
- [ ] `/como-funciona` → 5 pasos.
- [ ] `/faq` → 4 grupos con acordeones.
- [ ] `/contacto?vertical=software-factory` → form con honeypot.
- [ ] Submit → "Mensaje recibido".
- [ ] Como admin: `/factory/leads` → ves el lead capturado.
- [ ] `/legal/terminos`, `/legal/privacidad`, `/legal/cookies` cargan.
- [ ] Si tienes `PRONTARA_LEGAL_NIF` en .env, aparece tu NIF; si no,
  placeholder visible para que sepas qué te falta.

## Sección 10 · Mobile responsive

- [ ] DevTools → modo dispositivo iPhone.
- [ ] `/verticales` se ve bien — cards en columna.
- [ ] `/precios` — los 3 tiers en columna.
- [ ] `/acceso` — formulario centrado, no se sale.
- [ ] `/contacto` — form usable.
- [ ] El runtime `/?tenant=...` puede verse algo apretado pero usable.

## Si algo falla

Para cada fallo, anota:
- Qué paso del checklist.
- Qué viste vs qué esperabas.
- Mensaje de error de consola del browser (F12 → Console).
- Mensaje de log del servidor (terminal de pnpm dev).

Trasládalo a Claude con esa info y se arregla.

---

## Hallazgos del audit estático (sesión actual)

- ✓ Schema y stores coherentes.
- ✓ Tenant Software Factory Demo tiene todo lo necesario para login y operación.
- ⚠ **Creación de tenants nuevos NO está en runtime de Next.js** — solo en
  scripts PowerShell antiguos. Para producción 100% online hace falta:
  - Endpoint nuevo `POST /api/factory/tenants` que cree el `.prontara/clients/<id>.json`
    + cuenta admin + trial state inicial. Es ~3-4h de trabajo.
  - O conectar el webhook de Stripe `checkout.session.completed` para que
    al pagar el setup fee se cree el tenant automáticamente.
- ⚠ **Migración a Postgres incompleta** — solo leads y vertical-overrides.
  Para deploy real falta migrar account-store, billing-store, etc. (1.5-2 días).

## Bloqueantes confirmados antes de cobrar

1. Falta endpoint para crear tenants desde web (sin esto es manual).
2. Falta migración a Postgres completa.
3. Faltan datos legales reales en .env (NIF, dirección, etc.).
4. Falta verificar dominio en Resend.
5. Falta crear productos Stripe + webhook live.

Cuando los 5 estén listos, el smoke test pasa con todas las opcionales en verde, y el manual checklist completo va sin problemas, ya puedes cobrar el primer 590 €.
