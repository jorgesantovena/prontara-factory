# Política de retención de artefactos

Documento vivo. Define qué se conserva, qué se archiva y qué se borra en el repositorio de Prontara Factory.

Cierra los hallazgos **F-15** (proliferación de backups y auditorías) y **F-17** (ficheros `.bak` en raíz) del informe de auditoría interna del 23 de abril de 2026. Complementa al script idempotente [`scripts/cleanup-repo.mjs`](../scripts/cleanup-repo.mjs).

## 1. Principios

1. La fuente de verdad es **git**. Cualquier histórico recuperable por `git log` no necesita vivir como fichero físico.
2. Los artefactos derivados (builds, exports, deployments) no son fuente de verdad y se pueden regenerar, luego no se commitean.
3. Los informes de auditoría completan el registro institucional del proyecto; se conservan, pero no en la raíz visible del repo.
4. Los ficheros `.bak` producidos por scripts PowerShell se tratan como contaminación del espacio de trabajo y se eliminan en cada limpieza.

## 2. Categorías

| Categoría | Ruta | Retención | Acción |
|---|---|---|---|
| Código fuente | `src/`, `scripts/`, `prisma/`, `docs/` | Indefinida en git | Nunca borrar |
| Copia de seguridad manual | `backups/<etiqueta>/` | Máx. 30 días sin comprimir | Comprimir en `backups/archive-YYYY-MM-DD.tar.gz` y borrar carpeta |
| Informes de auditoría activos | `_audit/*.txt`, `_audit/*.md` | Los 5 más recientes en raíz | El resto a `_audit/archive/` |
| Informes de auditoría archivados | `_audit/archive/` | Indefinida | No borrar sin revisión manual |
| Backups de scripts PS1 | `*.bak`, `*.bak-*` en raíz | Cero | Borrar en cada ronda |
| Persistencia legado | `.prontara/current-client.txt` | Cero (ver F-14) | Borrar tras migración one-shot |
| Artefactos de entrega | `.prontara/exports/`, `.prontara/deployments/`, `.prontara/artifacts/` | Máx. 7 días | Limpiar manualmente o ignorar en git |
| Datos operativos de tenant | `.prontara/data/<clientId>/` | Vivo | No tocar desde scripts de mantenimiento |

## 3. Aplicación

### 3.1 Limpieza manual

```bash
# Dry-run: solo lista qué haría
node scripts/cleanup-repo.mjs

# Ejecutar de verdad
node scripts/cleanup-repo.mjs --apply
```

El script es idempotente: ejecutarlo dos veces seguidas no produce cambios.

### 3.2 Prevención

El `.gitignore` del repositorio ya excluye `*.bak`, `*.bak-*`, `/backups/`, `/_audit/archive/` y `/.prontara/current-client.txt`. Cualquier script que genere copias de seguridad debe:

- Escribir en `backups/<etiqueta>-YYYYMMDD-HHMMSS/` (no en la raíz).
- Nombrar las carpetas con sufijo de fecha ISO.
- Respetar los 30 días de retención.

Si un script añade `.bak` en raíz, revisar su implementación: normalmente se puede reemplazar por `git stash` o `git commit` en una branch de trabajo.

## 4. Excepciones

Cualquier excepción (por ejemplo, conservar un informe de auditoría concreto fuera de rotación) se documenta aquí en un PR:

- _Ninguna a fecha 2026-04-23._

## 5. Revisión

Esta política se revisa en cada cierre de ronda de auditoría. Próxima revisión prevista: al cierre de F-06.
