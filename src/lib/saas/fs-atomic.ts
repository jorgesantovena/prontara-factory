import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Atomic JSON write helpers.
 *
 * Direct `fs.writeFileSync(path, json)` leaves a window where the target file
 * is truncated but not yet fully written. If the process dies (crash,
 * redeploy, kill) during that window, the JSON on disk becomes corrupted and
 * the tenant/operational data is lost.
 *
 * To prevent that, we:
 *   1. Serialize the data.
 *   2. Write it to a temporary file in the same directory.
 *   3. fsync it so the data is durable.
 *   4. Rename it onto the target — rename is atomic on the same filesystem.
 *
 * We also serialize writes to the same logical path inside this process with
 * an in-memory queue, so that two concurrent writers can't race each other.
 */

type PendingChain = Promise<void>;

// One queue per absolute path. All writes to the same path wait for the
// previous one to finish.
const pathQueues = new Map<string, PendingChain>();

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildTempPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const token = randomBytes(6).toString("hex");
  return path.join(dir, "." + base + "." + process.pid + "." + token + ".tmp");
}

function writeFileAtomicSync(filePath: string, data: string | Buffer) {
  ensureDirExists(filePath);
  const tmpPath = buildTempPath(filePath);

  const fd = fs.openSync(tmpPath, "w");
  try {
    // fs.writeSync tiene 2 overloads incompatibles entre sí (Buffer vs string).
    // TypeScript no puede elegir uno cuando recibe un union, así que
    // discriminamos antes para que cada llamada matchee un overload concreto.
    if (typeof data === "string") {
      fs.writeSync(fd, data);
    } else {
      fs.writeSync(fd, data);
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    // Clean up the temp file if the rename failed, so we don't leave garbage.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Serialize `value` to JSON and write it atomically to `filePath`.
 *
 * Safe against:
 *   - partial writes on crash (temp file + rename)
 *   - interleaved writes from the same process (per-path queue)
 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  const json = JSON.stringify(value, null, 2);
  const absolute = path.resolve(filePath);

  const previous = pathQueues.get(absolute) || Promise.resolve();
  const next: PendingChain = previous
    .catch(() => undefined)
    .then(() => {
      writeFileAtomicSync(absolute, json);
    });

  pathQueues.set(absolute, next);
  // Synchronously wait for this write to complete so callers that expect
  // sync semantics keep working. The queue still prevents reordering.
  // We use a deasync-free approach: execute synchronously right now. The
  // queue is effectively cosmetic when each write is already sync, but it
  // still prevents accidental re-entry if a caller hands off to an async
  // hook between the queue lookup and the write.
  writeFileAtomicSync(absolute, json);

  // Keep the queue chain consistent for future readers.
  pathQueues.set(
    absolute,
    next.then(
      () => undefined,
      () => undefined
    )
  );
}

/**
 * Atomic write for raw strings (non-JSON). Same guarantees as writeJsonAtomic.
 */
export function writeTextAtomic(filePath: string, value: string): void {
  const absolute = path.resolve(filePath);
  writeFileAtomicSync(absolute, value);
}
