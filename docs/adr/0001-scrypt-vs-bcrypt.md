# ADR-0001 · Hash de contraseñas con scrypt en lugar de bcrypt

- **Fecha**: 2025-Q3 (formalizado 2026-04-29)
- **Estado**: Aceptado
- **Decisores**: Equipo Prontara

## Contexto

Prontara necesita almacenar contraseñas de cuentas tenant. La auditoría inicial (F-05) recomendaba migrar de un hash débil/custom a un algoritmo estándar resistente a fuerza bruta y a hardware especializado (GPU/ASIC).

El runtime principal de Prontara es **Next.js sobre Vercel** (Node 20+), incluido **edge runtime** para el middleware. El edge runtime de Vercel:

- Solo expone APIs Web Crypto y un subset de `node:crypto`.
- **No** permite `node:crypto` en su totalidad.
- **No** permite cargar binarios nativos compilados (lo que descarta `bcrypt` nativo).
- Sí incluye `scryptSync` desde `node:crypto` en el subset disponible en runtime serverless.

El middleware (verificación de sesión HMAC) corre en edge runtime. La verificación de contraseñas corre en runtime Node estándar (rutas API), pero queremos un único algoritmo compartido entre stores para que cualquier helper pueda hashear sin preocuparse del runtime de quien lo llame.

## Opciones consideradas

### A. `bcrypt` (paquete nativo)

Ventaja: estándar de facto en muchos proyectos.

Problemas:
- Requiere binario nativo compilado (node-gyp), incompatible con edge runtime.
- En despliegues serverless tipo Vercel, requiere `bcryptjs` (versión JS pura) que es ~5× más lenta y rompe el principio de "el mismo algoritmo en todo el código".
- Funciones cost-bound: `bcrypt` maxea en 72 chars de password, lo que obliga a documentar el límite.

### B. `bcryptjs` (puro JavaScript)

Ventaja: funciona en edge runtime.

Problemas:
- Significativamente más lento que `bcrypt` nativo o `scrypt` nativo.
- Mantenimiento del paquete es intermitente.
- Heredamos el cap de 72 chars sin razón técnica buena.

### C. `argon2`

Ventaja: estado del arte, ganador del Password Hashing Competition.

Problemas:
- Sin implementación nativa en `node:crypto` ni en Web Crypto.
- Paquetes existentes (`argon2`, `argon2-browser`) son nativos o WASM, ambos problemáticos en edge runtime de Vercel.
- Sobre-ingeniería para nuestro perfil de amenaza actual (no somos banco, no somos custodios de cripto).

### D. `scryptSync` desde `node:crypto`

Ventaja:
- Built-in, **cero dependencias externas**.
- Disponible tanto en runtime Node como en el subset de edge runtime que usa Vercel para middleware.
- Memory-hard: resistente a ataques con GPU/ASIC.
- Estándar IETF (RFC 7914).

Problema:
- Menos popular que bcrypt en tutoriales → onboarding requiere explicar la decisión (este ADR).

## Decisión

Usar **`scryptSync`** de `node:crypto` con los parámetros recomendados (N=2¹⁴, r=8, p=1, longitud 64), guardando el resultado como `scrypt:N:r:p:salt:hash` para permitir migración futura sin romper hashes existentes.

Implementación: `src/lib/saas/password-hash.ts`.

## Consecuencias

**Positivas**:
- Cero dependencias para este eslabón crítico (auditoría de supply-chain trivial).
- El mismo `hashPassword()` funciona en Node y en el subset edge.
- Sin compilación nativa → builds Vercel limpios y rápidos.
- Migración futura preparada: el prefijo del hash incluye los parámetros, así que un cambio de N/r/p se detecta al leer y se puede re-hashear lazy en el siguiente login.

**Negativas / aceptadas**:
- Tutoriales del ecosistema asumen bcrypt; cualquier nuevo dev necesita 5 min de contexto (este ADR).
- Si en el futuro hay que migrar a Argon2 (por cumplimiento PCI o similar), habrá que ejecutar el flujo de re-hash lazy ya preparado.

## Referencias

- RFC 7914 — `scrypt`
- Vercel Edge Runtime: API Reference (subset de `node:crypto`)
- Implementación: `src/lib/saas/password-hash.ts`
- Tarea de remediación origen: F-05 (ronda 1 de auditoría)
