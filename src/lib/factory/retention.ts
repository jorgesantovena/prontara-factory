/**
 * Política de retención para artefactos que crecen sin parar.
 *
 * Tres áreas afectadas hoy:
 *   - .prontara/backups/chat-writes/<timestamp>-<rand>/ (snapshots de cada
 *     write_repo_file / patch_repo_file del chat). Los creamos en cada
 *     mutación y nunca se limpian. Retención por defecto: 30 días.
 *   - data/saas/mail-outbox/<timestamp>__<email>.txt (emails que no se
 *     enviaron por Resend real). Retención por defecto: 60 días.
 *   - data/factory/chat/uploads/<id>.<ext|meta.json|txt> (adjuntos que
 *     sube el admin al chat). Retención por defecto: 14 días.
 *
 * No toca el log de auditoría: es barato y útil para forense, queda fuera
 * del scope de retención automática.
 *
 * Todas las funciones tienen modo preview (dryRun=true) que devuelve qué
 * se borraría sin borrar nada. El modo real borra y devuelve lo borrado.
 */
import fs from "node:fs";
import path from "node:path";

export const RETENTION_DEFAULTS = {
  backupSnapshotDays: 30,
  mailOutboxDays: 60,
  chatUploadsDays: 14,
};

function projectRoot(): string {
  return process.cwd();
}

function getBackupsRoot(): string {
  return path.join(projectRoot(), ".prontara", "backups", "chat-writes");
}

function getOutboxRoot(): string {
  return path.join(projectRoot(), "data", "saas", "mail-outbox");
}

function getUploadsRoot(): string {
  return path.join(projectRoot(), "data", "factory", "chat", "uploads");
}

function ageMsOf(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Date.now() - stat.mtimeMs;
  } catch {
    return 0;
  }
}

function ageDays(filePath: string): number {
  return ageMsOf(filePath) / (24 * 60 * 60 * 1000);
}

function sizeBytesRecursive(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(filePath)) {
      total += sizeBytesRecursive(path.join(filePath, entry));
    }
    return total;
  } catch {
    return 0;
  }
}

function removeRecursive(filePath: string) {
  fs.rmSync(filePath, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Backup snapshots
// ---------------------------------------------------------------------------

export type BackupSnapshotCandidate = {
  backupRef: string;
  ageDays: number;
  sizeBytes: number;
};

export function listExpiredBackupSnapshots(maxAgeDays: number): BackupSnapshotCandidate[] {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const out: BackupSnapshotCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    const age = ageDays(full);
    if (age < maxAgeDays) continue;
    out.push({
      backupRef: entry.name,
      ageDays: Math.floor(age),
      sizeBytes: sizeBytesRecursive(full),
    });
  }

  out.sort((a, b) => b.ageDays - a.ageDays);
  return out;
}

export type PruneResult = {
  candidates: number;
  removed: number;
  totalBytesFreed: number;
  details: Array<{ name: string; ageDays: number; sizeBytes: number; removed: boolean; error?: string }>;
};

export function pruneBackupSnapshots(options: {
  maxAgeDays?: number;
  dryRun?: boolean;
}): PruneResult {
  const maxAgeDays = options.maxAgeDays ?? RETENTION_DEFAULTS.backupSnapshotDays;
  const dryRun = Boolean(options.dryRun);
  const root = getBackupsRoot();
  const candidates = listExpiredBackupSnapshots(maxAgeDays);
  const details: PruneResult["details"] = [];
  let removed = 0;
  let bytesFreed = 0;

  for (const c of candidates) {
    if (dryRun) {
      details.push({
        name: c.backupRef,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
      });
      continue;
    }
    try {
      removeRecursive(path.join(root, c.backupRef));
      removed++;
      bytesFreed += c.sizeBytes;
      details.push({
        name: c.backupRef,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: true,
      });
    } catch (err) {
      details.push({
        name: c.backupRef,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
        error: err instanceof Error ? err.message : "error desconocido",
      });
    }
  }

  return {
    candidates: candidates.length,
    removed,
    totalBytesFreed: bytesFreed,
    details,
  };
}

// ---------------------------------------------------------------------------
// Mail outbox
// ---------------------------------------------------------------------------

export type OutboxCandidate = {
  fileName: string;
  ageDays: number;
  sizeBytes: number;
};

export function listExpiredOutboxFiles(maxAgeDays: number): OutboxCandidate[] {
  const root = getOutboxRoot();
  if (!fs.existsSync(root)) return [];

  const files = fs.readdirSync(root).filter((f) => f.endsWith(".txt"));
  const out: OutboxCandidate[] = [];

  for (const name of files) {
    const full = path.join(root, name);
    const age = ageDays(full);
    if (age < maxAgeDays) continue;
    const stat = fs.statSync(full);
    out.push({
      fileName: name,
      ageDays: Math.floor(age),
      sizeBytes: stat.size,
    });
  }

  out.sort((a, b) => b.ageDays - a.ageDays);
  return out;
}

export function pruneMailOutbox(options: {
  maxAgeDays?: number;
  dryRun?: boolean;
}): PruneResult {
  const maxAgeDays = options.maxAgeDays ?? RETENTION_DEFAULTS.mailOutboxDays;
  const dryRun = Boolean(options.dryRun);
  const root = getOutboxRoot();
  const candidates = listExpiredOutboxFiles(maxAgeDays);
  const details: PruneResult["details"] = [];
  let removed = 0;
  let bytesFreed = 0;

  for (const c of candidates) {
    if (dryRun) {
      details.push({
        name: c.fileName,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
      });
      continue;
    }
    try {
      fs.unlinkSync(path.join(root, c.fileName));
      removed++;
      bytesFreed += c.sizeBytes;
      details.push({
        name: c.fileName,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: true,
      });
    } catch (err) {
      details.push({
        name: c.fileName,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
        error: err instanceof Error ? err.message : "error desconocido",
      });
    }
  }

  return {
    candidates: candidates.length,
    removed,
    totalBytesFreed: bytesFreed,
    details,
  };
}

// ---------------------------------------------------------------------------
// Chat uploads
//
// Cada upload tiene tres ficheros en disco que comparten id: <id>.<ext>,
// <id>.meta.json y <id>.txt. Consideramos el grupo como una unidad y lo
// borramos a la vez, tomando la edad del meta.json (fue el último que se
// escribió en el saveUpload).
// ---------------------------------------------------------------------------

export type ChatUploadCandidate = {
  uploadId: string;
  ageDays: number;
  sizeBytes: number;
  files: string[];
};

function groupChatUploads(root: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  if (!fs.existsSync(root)) return groups;

  const entries = fs.readdirSync(root);
  for (const name of entries) {
    // Los ids empiezan por "u-" y tras el hex va .ext, .meta.json o .txt
    const match = name.match(/^(u-[A-Za-z0-9]+)\./);
    if (!match) continue;
    const id = match[1];
    const list = groups.get(id) || [];
    list.push(name);
    groups.set(id, list);
  }
  return groups;
}

export function listExpiredChatUploads(maxAgeDays: number): ChatUploadCandidate[] {
  const root = getUploadsRoot();
  const groups = groupChatUploads(root);
  const out: ChatUploadCandidate[] = [];

  for (const [id, files] of groups.entries()) {
    const metaFile = files.find((f) => f.endsWith(".meta.json"));
    const referenceFile = metaFile || files[0];
    const referencePath = path.join(root, referenceFile);
    const age = ageDays(referencePath);
    if (age < maxAgeDays) continue;
    let size = 0;
    for (const f of files) {
      try {
        size += fs.statSync(path.join(root, f)).size;
      } catch {
        // si un fichero del grupo desapareció, seguimos con los demás
      }
    }
    out.push({
      uploadId: id,
      ageDays: Math.floor(age),
      sizeBytes: size,
      files,
    });
  }

  out.sort((a, b) => b.ageDays - a.ageDays);
  return out;
}

export function pruneChatUploads(options: {
  maxAgeDays?: number;
  dryRun?: boolean;
}): PruneResult {
  const maxAgeDays = options.maxAgeDays ?? RETENTION_DEFAULTS.chatUploadsDays;
  const dryRun = Boolean(options.dryRun);
  const root = getUploadsRoot();
  const candidates = listExpiredChatUploads(maxAgeDays);
  const details: PruneResult["details"] = [];
  let removed = 0;
  let bytesFreed = 0;

  for (const c of candidates) {
    if (dryRun) {
      details.push({
        name: c.uploadId + " (" + c.files.length + " ficheros)",
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
      });
      continue;
    }
    let groupErr = "";
    let actuallyFreed = 0;
    for (const f of c.files) {
      try {
        const full = path.join(root, f);
        const stat = fs.statSync(full);
        fs.unlinkSync(full);
        actuallyFreed += stat.size;
      } catch (err) {
        groupErr = err instanceof Error ? err.message : "error desconocido";
      }
    }
    if (groupErr) {
      details.push({
        name: c.uploadId,
        ageDays: c.ageDays,
        sizeBytes: c.sizeBytes,
        removed: false,
        error: groupErr,
      });
    } else {
      removed++;
      bytesFreed += actuallyFreed;
      details.push({
        name: c.uploadId + " (" + c.files.length + " ficheros)",
        ageDays: c.ageDays,
        sizeBytes: actuallyFreed,
        removed: true,
      });
    }
  }

  return {
    candidates: candidates.length,
    removed,
    totalBytesFreed: bytesFreed,
    details,
  };
}

// ---------------------------------------------------------------------------
// Snapshot agregado
// ---------------------------------------------------------------------------

export type RetentionSnapshot = {
  generatedAt: string;
  policy: typeof RETENTION_DEFAULTS;
  backupSnapshots: PruneResult;
  mailOutbox: PruneResult;
  chatUploads: PruneResult;
  totals: {
    candidates: number;
    removable: number;
    bytesReclaimable: number;
  };
};

export function buildRetentionSnapshot(options: {
  dryRun?: boolean;
  policy?: Partial<typeof RETENTION_DEFAULTS>;
}): RetentionSnapshot {
  const policy = { ...RETENTION_DEFAULTS, ...(options.policy || {}) };
  const dryRun = Boolean(options.dryRun);

  const backupSnapshots = pruneBackupSnapshots({
    maxAgeDays: policy.backupSnapshotDays,
    dryRun,
  });
  const mailOutbox = pruneMailOutbox({
    maxAgeDays: policy.mailOutboxDays,
    dryRun,
  });
  const chatUploads = pruneChatUploads({
    maxAgeDays: policy.chatUploadsDays,
    dryRun,
  });

  const totalCandidates = backupSnapshots.candidates + mailOutbox.candidates + chatUploads.candidates;
  const totalRemoved = backupSnapshots.removed + mailOutbox.removed + chatUploads.removed;
  const totalBytes =
    backupSnapshots.totalBytesFreed + mailOutbox.totalBytesFreed + chatUploads.totalBytesFreed;

  return {
    generatedAt: new Date().toISOString(),
    policy,
    backupSnapshots,
    mailOutbox,
    chatUploads,
    totals: {
      candidates: totalCandidates,
      removable: totalRemoved,
      bytesReclaimable: totalBytes,
    },
  };
}
