/**
 * Backups previos a escrituras del chat de Factory.
 *
 * Cada write_repo_file o apply_repo_patch copia primero la versión
 * actual del fichero a `.prontara/backups/chat-writes/<timestamp>/<relPath>`
 * antes de tocarlo. Eso permite rollback manual rápido sin depender de git
 * (por ejemplo si aún no se ha hecho commit).
 *
 * No sustituye a git — es una red de seguridad complementaria. Los snapshots
 * se pueden borrar a mano sin peligro cuando ya se ha commiteado.
 */
import fs from "node:fs";
import path from "node:path";

function getProjectRoot(): string {
  return process.cwd();
}

function getBackupsRoot(): string {
  const dir = path.join(getProjectRoot(), ".prontara", "backups", "chat-writes");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeTimestampFolderName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "-" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export type BackupSnapshotResult = {
  /** Ruta absoluta del directorio de snapshot. */
  snapshotDir: string;
  /** Referencia corta (relativa a .prontara/backups/chat-writes/) para logs. */
  backupRef: string;
  /** Paths relativos al repo copiados (los que existían antes). */
  backedUpPaths: string[];
};

/**
 * Crea un snapshot previo de los ficheros indicados (los que existan).
 * Si un path no existe aún (escritura nueva) no falla: simplemente no
 * aparece en backedUpPaths. Esto permite llamar a esta función antes de
 * cualquier mutación sin validar previamente la existencia.
 */
export function snapshotFiles(relPaths: string[]): BackupSnapshotResult {
  const folder = makeTimestampFolderName();
  const snapshotDir = path.join(getBackupsRoot(), folder);
  const projectRoot = getProjectRoot();
  const backedUp: string[] = [];

  for (const rel of relPaths) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;

    const destAbs = path.join(snapshotDir, rel);
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(abs, destAbs);
    backedUp.push(rel);
  }

  return {
    snapshotDir,
    backupRef: folder,
    backedUpPaths: backedUp,
  };
}

/**
 * Lista snapshots existentes con su contenido resumido, más recientes
 * primero. Límite por defecto 50 para evitar cargar todo el historial.
 */
export type BackupSnapshotSummary = {
  backupRef: string;
  createdAt: string;
  files: string[];
};

export function listBackupSnapshots(limit = 50): BackupSnapshotSummary[] {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return [];

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse()
    .slice(0, limit);

  return entries.map((name) => {
    const abs = path.join(root, name);
    const files = walkFilesRelative(abs);
    const stat = fs.statSync(abs);
    return {
      backupRef: name,
      createdAt: stat.mtime.toISOString(),
      files,
    };
  });
}

function walkFilesRelative(base: string, sub = ""): string[] {
  const out: string[] = [];
  const here = path.join(base, sub);
  if (!fs.existsSync(here)) return out;
  const entries = fs.readdirSync(here, { withFileTypes: true });
  for (const e of entries) {
    const childRel = sub ? path.join(sub, e.name) : e.name;
    if (e.isDirectory()) {
      out.push(...walkFilesRelative(base, childRel));
    } else if (e.isFile()) {
      out.push(childRel.replace(/\\/g, "/"));
    }
  }
  return out;
}

/**
 * Restaura un snapshot sobreescribiendo los ficheros actuales con su
 * versión del snapshot. Devuelve los paths restaurados. Si el snapshot
 * no existe lanza error.
 */
export function restoreSnapshot(backupRef: string): string[] {
  const snapshotDir = path.join(getBackupsRoot(), backupRef);
  if (!fs.existsSync(snapshotDir) || !fs.statSync(snapshotDir).isDirectory()) {
    throw new Error("Snapshot no encontrado: " + backupRef);
  }

  const projectRoot = getProjectRoot();
  const files = walkFilesRelative(snapshotDir);
  const restored: string[] = [];

  for (const rel of files) {
    const src = path.join(snapshotDir, rel);
    const dest = path.join(projectRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    restored.push(rel);
  }

  return restored;
}
