# ADR-0005 · REST API directa para Stripe, Resend y Anthropic (sin SDK)

- **Fecha**: 2025-Q4 (formalizado 2026-04-29)
- **Estado**: Aceptado
- **Decisores**: Equipo Prontara

## Contexto

Prontara integra con tres servicios externos:

- **Stripe** — pagos y suscripciones.
- **Resend** — email transaccional.
- **Anthropic** — LLM del Factory Chat.

Los tres ofrecen SDK oficiales en Node/TypeScript:

- `stripe` (paquete oficial Stripe).
- `resend` (paquete oficial Resend).
- `@anthropic-ai/sdk`.

Y los tres ofrecen REST API públicas estables, completas y documentadas.

El runtime principal es Vercel + Next.js (Edge runtime para algunos endpoints, Node runtime para otros). En particular:

- El webhook de Stripe necesita el **raw body** para verificar la firma → el SDK de Stripe ayuda con esto pero puede ocultar comportamiento.
- Anthropic usa SSE streaming → el SDK añade utilities pero el `fetch` nativo + un parser de eventos basta.
- Resend es un solo endpoint POST → el SDK aporta poco más que typing.

## Opciones consideradas

### A. Usar los SDK oficiales

**A favor**:
- Menos código propio.
- Tipos TypeScript bien hechos out of the box.
- Mantenimiento del cliente (retries, paginación, paginación, edge cases) lo hace el vendor.
- Onboarding más rápido para devs nuevos que ya conocen el SDK.

**En contra**:
- **3 dependencias adicionales en supply chain**, cada una con sus propias subdependencias (ej: `stripe` arrastra paquetes cripto que duplican lo que ya tiene Node).
- Cualquiera de las 3 puede romper en una mayor con cambios incompatibles → bloquea el deploy hasta migrar.
- El SDK de Stripe pesa ~400 KB minificado → impacta al cold start de funciones serverless.
- Edge runtime de Vercel **no soporta** todos los SDKs (binarios nativos, dependencias node-only).
- SSL pinning, retries, timeouts a menudo son configurables solo a través de la API del SDK, no transparentes.
- Onboarding requiere aprender N SDKs en lugar de "lee la doc REST y haz fetch".

### B. REST directo con `fetch` nativo

**A favor**:
- Cero dependencias externas para estas 3 integraciones.
- Funciona en cualquier runtime Vercel (edge, node, serverless).
- Cold start mínimo.
- Auditoría de seguridad (qué hace mi código cuando llama a Stripe) es leer 50 líneas, no leer un SDK.
- Cambios de versión de la API se gestionan con cabeceras (`Stripe-Version`, `anthropic-version`) sin esperar release del SDK.
- Trivial mockear en tests (interceptas `fetch`).

**En contra**:
- Los retries, paginación, parsing de errores hay que implementarlos.
- Los tipos hay que mantenerlos (ya sea a mano o con generadores tipo `openapi-typescript`).

### C. Híbrido: SDK donde aporta, REST donde no

Por ejemplo: Stripe SDK para la mayoría, pero REST para el webhook (donde necesitamos raw body).

**En contra**:
- Lo peor de los dos mundos: dependes del SDK pero también mantienes código REST.
- Inconsistencia: cualquier dev que llegue se pregunta "¿por qué aquí sí y allí no?".

## Decisión

**Opción B: REST directo con `fetch` nativo en los 3 casos**, encapsulado por servicio:

- `src/lib/saas/billing-stripe.ts` — wrapper Stripe.
- `src/lib/saas/email-resend.ts` — wrapper Resend.
- `src/lib/factory-chat/anthropic.ts` — wrapper Anthropic.

Cada wrapper:

- Expone una API tipada para el resto del código (no se hace fetch crudo desde rutas).
- Maneja los retries con backoff propios donde aplica (ej: 429 de Anthropic).
- Tiene su propio set de tipos TypeScript (suficiente con lo que usamos, no exhaustivo).

Cuando un wrapper crece a > 500 líneas o se necesita endpoint exótico, se reconsidera (puede subir a wrapper más completo o, en última instancia, traer SDK). Por ahora, los 3 wrappers son < 300 líneas cada uno.

## Consecuencias

**Positivas**:
- 3 dependencias menos en `package.json` → supply chain más auditable.
- Builds más rápidos, bundle más ligero, cold start menor.
- Funciona en edge runtime sin asteriscos.
- Cambios de API de Stripe/Resend/Anthropic se gestionan con cabeceras, no con `npm update`.
- Tests más simples (mock de `fetch` global).
- ARQ-9 (interfaces hexagonales para `PaymentProvider`, `EmailProvider`, `LLMProvider`) puede implementarse de forma natural encima de estos wrappers, sin renunciar al SDK del vendor.

**Negativas / aceptadas**:
- Cuando aparece un endpoint nuevo (ej: Stripe lanza nuevo tipo de checkout), hay que añadirlo al wrapper a mano.
- Si el wrapper tiene un bug (parseo de error de Stripe), el bug es nuestro y lo arreglamos nosotros (en vez de esperar parche del SDK).
- Onboarding asume que el dev sabe leer doc REST de los 3 vendors.

**Trade-off explícito**: priorizamos **independencia de supply chain y simplicidad de runtime** sobre **velocidad de adopción de features nuevas del vendor**. Para una PYME-SaaS con cadencia de release semanal, gana la primera.

## Cuándo cambiar de opinión

- Cuando un wrapper crece a > 500 líneas y aún siente que faltan cosas.
- Cuando el vendor cambia API a algo no-REST (ej: gRPC obligatorio).
- Cuando aparezca un edge case donde el SDK haga algo no trivial (ej: device fingerprinting de Stripe, beam search de un LLM) que no se pueda replicar fácil con REST.

En ese momento → ADR de superación, traer el SDK específico, **mantener la interfaz hexagonal** para no acoplar el dominio a la elección de cliente HTTP.

## Referencias

- `src/lib/saas/billing-stripe.ts`
- `src/lib/saas/email-resend.ts`
- `src/lib/factory-chat/anthropic.ts`
- `src/app/api/stripe/webhook/route.ts` — verificación de firma con raw body.
- ARQ-9 (hexagonal estricto) — refactor opcional encima de estos wrappers.
