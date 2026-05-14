# Probar el ERP Software Factory — guía para el revisor

> **Tiempo**: 1-2 horas tranquilas.
> **Lo que vas a hacer**: usar el ERP como si fueras el CEO de una software factory pequeña, igual que lo usarían tus clientes finales.
> **Lo que tienes que entregar**: una nota con qué te ha funcionado, qué te ha parecido raro o lento, qué no entiendes, y qué cambiarías. Captura pantalla de cualquier cosa rara.

---

## 0. Datos para entrar

- **URL**: `https://app.prontara.com`
- **Email**: pídeselo a Jorge (es el de la cuenta del tenant demo SF)
- **Contraseña**: pídesela a Jorge
- **Tenant / slug**: `software-factory-demo`
- **Navegador recomendado**: Chrome o Firefox. En el móvil también puedes probar.

---

## 1. Entrar en el sistema

1. Abre el navegador en modo **incógnito** (Ctrl+Shift+N en Chrome, Ctrl+Shift+P en Firefox).
2. Ve a `https://app.prontara.com/software-factory`.
3. Deberías ver una **landing comercial** (página de venta) del producto para empresas de desarrollo.
4. Pulsa arriba a la derecha en **"Iniciar sesión"**.
5. Te pide tres cosas: tenant (slug), email y contraseña.
   - **Tenant**: escribe `software-factory-demo`
   - **Email**: el que te dio Jorge
   - **Contraseña**: la que te dio Jorge
6. Pulsa **Entrar**.

✅ **Lo que debería pasar**: aterrizas en la pantalla principal del ERP, con tu nombre arriba ("Buenos días, [Nombre] 👋") y un panel con datos.

❌ **Si algo falla**:
- "Credenciales inválidas" → revisa que el tenant sea exactamente `software-factory-demo`.
- "Tenant no encontrado" → habla con Jorge.
- Después de entrar te lleva a otra página rara → anótalo.

---

## 2. Mirar el menú lateral izquierdo

Ya dentro, verás un menú a la izquierda con secciones agrupadas. Repasa que tenga estas secciones y que **no haya cosas raras**:

**Operación** (lo del día a día):
- Inicio
- Buscar
- Clientes
- Oportunidades
- Proyectos
- Producción
- Parte de horas
- Tareas
- Avisos

**Administración** (lo financiero):
- Propuestas
- Facturas
- Entregables
- Compras
- CAU
- Base de conocimiento
- Gastos
- Vencimientos
- Desplazamientos

**Analítica**:
- Reportes

**Configuración**:
- Asistente
- Ajustes
- Empleados
- (alguno más)

**Maestros** (cerrado por defecto, lo abres con un click):
- Cosas como Catálogo servicios, Aplicaciones, Tarifas, Formas de pago, Tipos cliente...

❌ **Cosas que NO deberían aparecer en el menú** (si las ves, anótalo):
- Caja
- Puntos de venta
- Bodegas
- Kardex
- Albaranes
- Productos
- Reservas
- Tickets (sí debería estar CAU, no "Tickets")
- Cualquier cosa que suene a colegio (Docentes, Calificaciones, Comedor, Biblioteca, Transporte...)

✅ También prueba el botón **"Colapsar"** abajo del menú. La barra debería estrecharse a iconos. Vuélvela a abrir.

---

## 3. Mirar la pantalla de inicio

Estás en **Inicio** (sale destacado en azul en el menú).

Comprueba que ves:

- Tu **saludo** con el nombre y la **fecha de hoy** en español.
- **4 tarjetas de números** arriba: Horas este mes, Proyectos activos, Propuestas abiertas, Facturas pendientes.
- Una sección de **Accesos rápidos** con botones tipo: Imputar horas, Nueva factura, Nueva propuesta, Pre-facturación.
- **Pendientes** con bullets de colores y números (pagos pendientes, tareas por revisar, documentos por aprobar).
- **Notificaciones** a la derecha.
- Más abajo: **Actividad reciente** y **Agenda de hoy**.

✅ Pulsa uno de los **Accesos rápidos** ("Nueva propuesta", por ejemplo). Debe abrir una pantalla para crear una propuesta nueva.

❌ Si la pantalla de inicio aparece toda en blanco o con números a "0" en todo, anótalo.

---

## 4. Probar el menú de la cabecera (arriba)

Arriba del todo de la pantalla tienes una **barra horizontal**:

- **Buscador central** con texto "Buscar clientes, documentos, productos..." y a la derecha `⌘K` (Mac) o `Ctrl K` (Windows).
- Una **campana** de notificaciones (con número rojo si hay sin leer).
- Un **interrogante** "?" de ayuda.
- Tu **avatar** y nombre a la derecha.

Pruebas:

1. Pulsa `Ctrl+K` desde cualquier sitio. El cursor debe ir al buscador.
2. Escribe el nombre de algún cliente que veas y pulsa Enter. Debería llevarte a una página de resultados.
3. Click en la campana. Se abre un desplegable con notificaciones (o "Sin notificaciones").
4. Click en "?". Se abre un panel de ayuda.
5. Click en tu avatar/nombre arriba a la derecha. Sale un menú con "Mi cuenta", "Ajustes del tenant", "Cerrar sesión", etc.

---

## 5. Recorrido por las páginas — clica en cada item del menú izquierdo

Para cada uno de estos enlaces, **pulsa, mira la pantalla, vuelve atrás con el menú**. Anota lo que te parezca raro:

| Click en | Qué deberías ver |
|----------|------------------|
| **Clientes** | Lista de empresas cliente. Si el demo está sembrado verás varias. |
| **Oportunidades** | Lista de oportunidades comerciales con estado (lead, contactado, ganado…) |
| **Proyectos** | Lista de proyectos en marcha con cliente, fecha, estado |
| **Producción** | Una pantalla con pestañas: Tareas, Incidencias, Versiones, Mantenimientos, Justificantes |
| **Parte de horas** | Tabla con imputaciones de horas (persona, fecha, proyecto, horas) |
| **Tareas** | Tareas pendientes |
| **Propuestas** | Lista de propuestas (presupuestos) enviados |
| **Facturas** | Lista de facturas emitidas con estado (emitida, cobrada, vencida) |
| **Entregables** | Lista de documentos entregables del cliente |
| **Compras** | Órdenes de compra a proveedores |
| **CAU** | Lista de tickets de soporte de aplicación (con bullets de color del SLA) |
| **Base de conocimiento** | Listado de soluciones reusables |
| **Gastos** | Hojas de gastos del equipo |
| **Vencimientos** | Facturas a punto de vencer / vencidas |
| **Desplazamientos** | Visitas a cliente con kilometraje |
| **Reportes** | Constructor de informes |
| **Asistente** | Chat con la IA |
| **Ajustes** | Configuración del tenant (datos fiscales, branding, etc.) |
| **Empleados** | Lista del equipo |

Para **cada página** comprueba:

- ¿Carga rápido (< 2 segundos)?
- ¿Tiene un título claro y un subtítulo explicando qué es?
- ¿Hay un botón azul **"+ Nuevo …"** arriba a la derecha?
- ¿Hay un buscador y filtros?
- ¿La tabla muestra columnas con sentido?
- ¿Se entiende qué hace la página sin necesidad de manual?

❌ Si una página da error "No se pudo cargar" o se queda colgada, anota el nombre.

---

## 6. Crear un cliente nuevo

1. Click en **Clientes** en el menú izquierdo.
2. Click en **"+ Nuevo cliente"** (botón azul arriba a la derecha).
3. Te debe abrir una pantalla completa con un formulario con pestañas (Datos generales, Contactos, Comercial, Financiero, Notas).
4. Rellena solo lo obligatorio (lo que tenga asterisco rojo): Nombre, etc.
5. Click en **Guardar** (botón azul arriba a la derecha).

✅ **Esperado**: vuelves a la lista de clientes y ves el cliente que acabas de crear.

✅ Ahora **pulsa en su fila**. Se debe abrir un **panel lateral derecho** con un "Detalle rápido" del cliente y botones de acciones rápidas (Ver ficha, Editar, Email, Llamar, Eliminar).

❌ Si al guardar el formulario te dice error o se queda dando vueltas, anótalo.

---

## 7. Workflow comercial completo (lo más importante)

Sigue estos pasos en orden. Es el flujo real que haría una software factory:

### 7.1. Crear una oportunidad

1. Menú → **Oportunidades**.
2. **+ Nueva**.
3. Rellena: Empresa, Contacto, Email, Teléfono, Fase = "Lead", Valor estimado = 5000.
4. Guarda.

### 7.2. Avanzarla a propuesta

5. Edita la oportunidad que acabas de crear.
6. Cambia Fase a **"Ganado"** y guarda.

### 7.3. Crear la propuesta

7. Menú → **Propuestas** → **+ Nueva**.
8. Rellena: Cliente (selecciona uno existente), Concepto = "Desarrollo aplicación web", Importe = "5000", Estado = "Enviado".
9. Guarda.

### 7.4. Aceptar la propuesta

10. Edita la propuesta y cambia el estado a **"Aceptado"** o **"Firmado"**.
11. Guarda.

### 7.5. Convertir en proyecto

12. Aquí va a haber dos opciones:
    - Si ves en la propuesta un botón **"Convertir en proyecto"**, púlsalo.
    - Si NO hay botón (porque la UI está pendiente), avísalo y pasa al siguiente paso manualmente.

13. Ve al menú → **Proyectos**. Debería aparecer un proyecto nuevo con el mismo cliente y nombre.

### 7.6. Imputar horas al proyecto

14. Menú → **Parte de horas** → **+ Nueva**.
15. Rellena: Fecha = hoy, Persona = tu nombre, Proyecto = el que acabas de crear, Concepto = "Análisis funcional", Horas = "2.5", Facturable = "Sí".
16. Guarda.
17. Repite con otra imputación de "3" horas, otro día.

### 7.7. Pre-facturación

18. Menú lateral → busca **Pre-facturación** o desde "Accesos rápidos" del inicio.
19. Verás una tabla con clientes, horas pendientes y a facturar.
20. Pulsa **"Emitir mes"** si aparece — debería generar facturas automáticas.

### 7.8. Ver factura generada

21. Menú → **Facturas**. Deberías ver una factura nueva con tu cliente, importe y estado "emitida".

✅ **Si has llegado hasta aquí sin errores, el workflow comercial completo funciona**.

❌ Si algún paso falla, anota EN QUÉ PASO falló y qué mensaje de error sale.

---

## 8. Probar el CAU (soporte de aplicación)

1. Menú → **CAU**. Verás una lista de tickets con bullets de color (verde/amarillo/rojo según SLA).
2. **+ Nuevo ticket**:
   - Asunto: "No me cargan los pedidos"
   - Cliente: selecciona uno
   - Aplicación: la que sea (si hay catálogo)
   - Severidad: "Alta"
   - Urgencia: "Urgente"
   - Estado: "Nuevo"
   - Descripción: "Cuando entro al módulo de pedidos no me aparece nada."
3. Guarda.
4. **Pulsa en la fila del ticket** que acabas de crear. Se abre una página completa del ticket.
5. Verás una **conversación** estilo chat. El mensaje del cliente aparece a la izquierda.
6. Escribe abajo: "Hola, estamos revisando el problema, te confirmamos en 1 hora." y pulsa **Enviar respuesta**.
7. Tu mensaje aparece a la derecha (en azul).
8. Marca el checkbox **"Nota interna"** y escribe "Revisar logs servidor staging". Guarda.
9. Verás tu nota interna en amarillo, con una etiqueta "🔒 NOTA INTERNA" — el cliente NO la vería.
10. Pulsa **"Imputar horas"** arriba a la derecha. Mete "1.5" horas.
11. Sale una nota interna automática "⏱️ Imputadas 1.5 h".
12. Ve a Parte de horas — debería aparecer la imputación nueva con un texto tipo "CAU #xxx — No me cargan los pedidos".
13. Vuelve al ticket. En el ticket, rellena el campo "Solución" con "Era un caché obsoleto, regenerado". Cambia estado a "Resuelto".
14. Pulsa **"Cerrar ticket"**. Te preguntará si quieres convertir la solución en una entrada de **Base de conocimiento**. Di que sí.
15. Ve a **Base de conocimiento** en el menú. Debería aparecer tu entrada.

✅ Si todo el flujo del CAU funciona, está bien.

❌ Si los mensajes no se guardan, o no aparece el bullet de color SLA, o "Imputar horas" da error, anótalo.

---

## 9. Probar el portal del cliente externo (opcional, requiere paso técnico)

Esto es para confirmar que un cliente final puede ver sus tickets/facturas sin entrar al ERP. Necesitas que Jorge te genere un link. Si te lo da:

1. **Abre el link en una pestaña incógnita / otro navegador** (sin sesión Prontara).
2. Deberías ver una página con "Hola, [Nombre cliente]" y stats: tickets abiertos, facturas pendientes, proyectos activos.
3. Una tabla de tickets y una tabla de facturas.
4. **NO debe pedir login**.

❌ Si pide login o sale página en blanco, anótalo.

---

## 10. Probar móvil / PWA

1. Coge tu móvil. Abre el navegador en `https://app.prontara.com/softwarefactory` (entra con tu usuario).
2. ¿Se ve el menú en mobile? Debería haber un botón **hamburguesa ☰** arriba a la izquierda.
3. Ábrelo, navega entre páginas.
4. Si tu navegador móvil te sugiere "Instalar Prontara", instálala y prueba abrir desde el icono.

---

## 11. Cerrar sesión y volver

1. Click en tu nombre arriba a la derecha → **Cerrar sesión**.
2. Deberías volver a `/acceso` o a la landing.
3. Vuelve a entrar con las mismas credenciales.

---

## 12. Errores intencionales — ¿qué pasa si...?

Estas pruebas son para ver que el sistema responde con sentido cuando algo va mal:

1. Intenta crear una factura con importe "ABC" (texto en vez de número). ¿Te avisa o lo acepta?
2. Intenta borrar un cliente. ¿Te pide confirmación con un modal de "ELIMINAR" o lo borra directo?
3. Intenta entrar a `https://app.prontara.com/dental` con tu sesión de SF. ¿Te redirige a `/softwarefactory` o te deja entrar (no debería)?
4. Sal del navegador, espera 8 días y vuelve a entrar. ¿Te pide login otra vez? (La sesión dura 7 días.)
5. Edita una propuesta, cambia algo y NO pulses Guardar — recarga la página. ¿Pierdes los cambios? ¿Te avisa?

---

## 13. Qué entregar a Jorge

Un email (o documento Word/PDF) con:

### A. Lista de cosas que han fallado

Por cada cosa rota:
- **Dónde**: nombre de la página o sección (ej. "Crear factura nueva")
- **Qué hiciste**: 3-4 pasos cortos
- **Qué pasó**: el mensaje de error o lo que viste raro
- **Captura** (si es visual)

### B. Lista de cosas que están bien pero raras

- "El menú tiene `Avisos` pero no entiendo qué hace."
- "La página de Reportes está vacía y no me deja crear nada."
- "Tarda mucho en cargar Facturas (5 segundos)."

### C. Lista de cosas que te gustan

Para reforzar lo que funciona bien. Útil para no romperlo en próximas iteraciones.

### D. Recomendación general

3-4 líneas: "Lo veo en general bien / regular / mal porque...". "Antes de venderlo retocaría X, Y, Z". "Lo que más me preocupa es...".

---

## Atajos útiles mientras pruebas

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Buscar globalmente |
| `?` | Abrir ayuda |
| `g` luego `c` | Ir a Clientes |
| `g` luego `f` | Ir a Facturas |
| `g` luego `p` | Ir a Proyectos |

---

Si te bloqueas con algo o no entiendes un paso, pregunta a Jorge directamente. No hace falta resolverlo solo.

**Gracias por la revisión.**
