# Puertos hexagonales (ARQ-9)

Esta carpeta define **interfaces** que el dominio de Prontara consume para hablar con el exterior, sin depender directamente de un proveedor concreto.

```
                       ┌────────────────────────┐
   Dominio Prontara → │   Port (interface)     │ ← Adapter (Stripe / Resend / Anthropic / ...)
                       └────────────────────────┘
```

El dominio importa el **puerto**, no el adapter. Eso permite:

- Tests con un fake adapter en memoria.
- Cambiar de Stripe a Adyen tocando solo el adapter, sin tocar billing.
- Hacer feature flags entre proveedores.

## Puertos definidos

| Puerto | Implementación actual | Para qué |
|---|---|---|
| `PaymentProvider` | Adapter Stripe | Crear checkout sessions, refunds, verificar webhooks |
| `EmailProvider` | Adapter Resend | Enviar emails transaccionales |
| `LLMProvider` | Adapter Anthropic | Streaming SSE para Factory Chat |

## Estado de adopción

Esta refactorización es **incremental y opt-in**. Los wrappers actuales (`src/lib/saas/billing-stripe.ts`, `src/lib/saas/email-resend.ts`, `src/lib/factory-chat/anthropic.ts`) siguen funcionando exactamente igual y son los que consume el código existente.

Los adapters de esta carpeta son **wrappers finos** sobre esos wrappers actuales que cumplen el contrato de los puertos. El plan:

1. **Hoy**: los adapters existen y los puertos están definidos. Cualquier código nuevo debería consumir el puerto en lugar del wrapper.
2. **Cuando se necesite testear un flujo crítico con fake**: los puertos permiten inyectar un fake (sin red).
3. **Cuando se quiera cambiar de proveedor**: se escribe un nuevo adapter contra el mismo puerto y se cambia el factory de defaults.

NO hay urgencia para migrar todo el código consumidor — eso sería mucho riesgo por poco valor. La regla simple: **código nuevo usa puertos, código existente puede seguir igual**.

## Cómo añadir un puerto nuevo

1. Crea `src/lib/ports/{nombre}.ts` con la interface.
2. Crea `src/lib/adapters/{nombre}-{proveedor}.ts` que la implemente.
3. Si quieres un default global, expón un factory en `src/lib/adapters/defaults.ts`.

## Ver también

- [ADR-0005](../../../docs/adr/0005-no-sdk-stripe-resend-anthropic.md) — por qué REST directo en lugar de SDK.
- ARQ-9 en `docs/Auditoria-Arquitectonica-Prontara.docx`.
