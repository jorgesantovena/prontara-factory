#!/usr/bin/env node
// Herramienta idempotente de limpieza del repositorio.
// Aplica la política de retención definida en docs/retention-policy.md.
//
// Modo dry-run por defecto (solo lista). Para ejecutar de verdad:
//   node scripts/cleanup-repo.mjs --apply
//
// Qué hace:
//   1. Borra ficheros *.bak y *.bak-* en la raíz (cierra F-17).
//   2. Borra `.prontara/current-client.txt` si existe (cierra F-14 físico).
//   3. Archiva el contenido de `backups/` en `backups/archive-<fecha>.tar.gz`
//      y borra las carpetas originales (cierra F-15 backups).
//   4. Deja `_audit/` como está pero mueve informes antiguos a `_audit/archive/`,
//      manteniendo los 5 más recientes en la raíz (cierra F-15 auditorías).

import { readdirSync, statSync, renameSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, basename } from "node:path";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const LOG = (msg) => console.log((APPLY ? "[apply] " : "[dry-run] ") + msg);

function removeFile(path) {
  if (!existsSync(path)) return;
  LOG("rm " + path);
  if (APPLY) unlinkSync(path);
}

function removeDir(path) {
  if (!existsSync(path)) return;
  LOG("rm -rf " + path);
  if (APPLY) rmSync(path, { recursive: true, force: true });
}

function cleanupBakFiles() {
  const entries = readdirSync(ROOT, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (name.endsWith(".bak") || /\.bak-/.test(name) || /\.bak[.-]/.test(name)) {
      removeFile(join(ROOT, name));
      count++;
    }
  }
  LOG("ficheros .bak eliminados: " + count);
}

function cleanupLegacyActiveClient() {
  const legacy = join(ROOT, ".prontara", "current-client.txt");
  if (existsSync(legacy)) {
    removeFile(legacy);
  } else {
    LOG("legacy current-client.txt ya no existe");
  }
}

function archiveBackupsFolder() {
  const backups = join(ROOT, "backups");
  if (!existsSync(backups)) {
    LOG("backups/ no existe");
    return;
  }
  const entries = readdirSync(backups).filter((n) => !n.startsWith("archive-"));
  if (entries.length === 0) {
    LOG("backups/ ya está archivado");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const archive = join(backups, "archive-" + stamp + ".tar.gz");
  LOG("tar -czf " + archive + " " + entries.length + " carpetas");
  if (APPLY) {
    execSync("tar -czf " + JSON.stringify(archive) + " " + entries.map((n) => JSON.stringify(n)).join(" "), {
      cwd: backups,
      stdio: "inherit",
    });
    for (const name of entries) {
      removeDir(join(backups, name));
    }
  }
}

function archiveOldAuditReports() {
  const audit = join(ROOT, "_audit");
  if (!existsSync(audit)) {
    LOG("_audit/ no existe");
    return;
  }
  const files = readdirSync(audit, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => ({ name: e.name, mtime: statSync(join(audit, e.name)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length <= 5) {
    LOG("_audit/ tiene " + files.length + " informes; nada que archivar");
    return;
  }
  const archiveDir = join(audit, "archive");
  if (!existsSync(archiveDir)) {
    LOG("mkdir " + archiveDir);
    if (APPLY) mkdirSync(archiveDir, { recursive: true });
  }
  const toArchive = files.slice(5);
  LOG("mover " + toArchive.length + " informes a _audit/archive/");
  for (const f of toArchive) {
    const src = join(audit, f.name);
    const dst = join(archiveDir, f.name);
    LOG("mv " + basename(src) + " -> archive/" + basename(dst));
    if (APPLY) renameSync(src, dst);
  }
}

console.log("== cleanup-repo ==");
console.log("Modo: " + (APPLY ? "APPLY" : "DRY-RUN (usa --apply para ejecutar)"));
cleanupBakFiles();
cleanupLegacyActiveClient();
archiveBackupsFolder();
archiveOldAuditReports();
console.log("hecho");
