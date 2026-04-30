# Cómo abrir Prontara Factory desde el escritorio

Tienes **dos formas**:

## Opción A · Acceso directo "tipo programa" (lo más rápido, recomendado)

Esto crea un icono "Prontara Factory" en tu escritorio y en el menú Inicio
de Windows. Cuando lo pulses, arrancará el servidor (si no está ya
corriendo) y abrirá tu navegador en el dashboard.

Pasos (una sola vez):

1. Abre la carpeta `prontara-factory\scripts\` con el explorador.
2. Doble-click en **`Instalar-Prontara-en-Escritorio.bat`**.
3. Acepta el aviso de Windows si te lo pide ("Más información" → "Ejecutar
   de todas formas" — es porque no está firmado, no es virus).
4. Te confirmará que el acceso directo está creado.

A partir de ahí: doble-click en **"Prontara Factory"** en tu escritorio
y se abre todo solo. Si quieres que esté siempre a mano, botón derecho
sobre el icono → "Anclar a la barra de tareas".

## Opción B · Aplicación de escritorio "real" (.exe instalable, más adelante)

Cuando quieras una app de escritorio de verdad (instalable .msi/.exe
con su propio icono en la barra de tareas, sin ventana negra de la
consola), construye la versión Tauri:

```powershell
cd prontara-factory
pnpm desktop:build
```

Esto necesita Rust + Tauri CLI instalados (la primera vez puede tardar
20-30 minutos en descargar las dependencias). Cuando termina, encuentras
el instalable en:

```
src-tauri\target\release\bundle\msi\Prontara Desktop_0.1.0_x64_en-US.msi
src-tauri\target\release\bundle\nsis\Prontara Desktop_0.1.0_x64-setup.exe
```

Doble-click sobre el `.msi` o el `-setup.exe` y queda instalado como
cualquier otro programa de Windows. El icono ya tiene el logo de Prontara.

Si Tauri te pide instalar Rust, sigue las instrucciones de
<https://tauri.app/start/prerequisites/>.

## Si algo falla

- "No se encuentra pnpm" → instala pnpm con `npm install -g pnpm`.
- "Puerto 3000 ya en uso" → otro proceso lo está usando. Cierra el otro
  o cambia el puerto en `.env.local` con `PORT=3001`.
- "Página en blanco" → mira la ventana minimizada "Prontara Factory -
  servidor" y busca el error en consola.
