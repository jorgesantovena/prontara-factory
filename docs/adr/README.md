# Architectural Decision Records (ADRs)

Estos documentos congelan **decisiones arquitectónicas importantes** que ya están aplicadas en el código pero que no son evidentes leyéndolo. Sirven para que cualquier persona (incluido tu yo de dentro de 6 meses) pueda entender por qué algo está como está sin tener que reconstruir el contexto a partir de cero.

Formato: [MADR ligero](https://adr.github.io/madr/) — una página por decisión, con contexto, opciones consideradas, decisión y consecuencias.

## Índice

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-0001](./0001-scrypt-vs-bcrypt.md) | Hash de contraseñas con scrypt en lugar de bcrypt | Aceptado |
| [ADR-0002](./0002-shared-db-multi-tenant.md) | Multi-tenancy con shared DB + tenant_id | Aceptado |
| [ADR-0003](./0003-persistencia-dual-fs-postgres.md) | Persistencia dual filesystem \| postgres con flag de runtime | Aceptado |
| [ADR-0004](./0004-sector-packs-declarativos.md) | Sector packs como registry declarativo en TypeScript | Aceptado |
| [ADR-0005](./0005-no-sdk-stripe-resend-anthropic.md) | REST API directa para Stripe, Resend y Anthropic (sin SDK) | Aceptado |

## Cuándo escribir un ADR nuevo

Cuando la decisión cumple **dos** de estos tres criterios:

1. La hemos discutido y descartado al menos una alternativa.
2. Cambiar de opinión en el futuro tendría coste no trivial (refactor, migración, comunicación a clientes).
3. La razón "por qué esto y no aquello" no es obvia leyendo el código.

Si las tres se cumplen → ADR seguro. Si solo una → probablemente basta con un comentario en el código.

## Cómo añadir un ADR

1. Copia el último ADR como plantilla.
2. Numéralo correlativamente (`NNNN-titulo-en-kebab.md`).
3. Añade una línea al índice.
4. Si la decisión **supera** a una anterior, marca la anterior como `Superseded by ADR-NNNN`.
5. No edites un ADR aceptado: si la decisión cambia, escribe uno nuevo que la reemplace.
