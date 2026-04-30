import fs from "node:fs";
import path from "node:path";
import { readFactoryDiskHistory } from "@/lib/factory/factory-disk-history";

export type FactoryHardeningReport = {
  ok: boolean;
  cleanedClients: string[];
  fixedTextFiles: string[];
  warnings: string[];
  summary: {
    totalClients: number;
    healthyClients: number;
    partialClients: number;
    corruptClients: number;
  };
};

function safeReadText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function fixMojibake(input: string): string {
  return String(input || "")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/Â·/g, "·");
}

function tryFixJsonFile(filePath: string): boolean {
  const raw = safeReadText(filePath);
  if (raw == null) {
    return false;
  }

  const fixed = fixMojibake(raw);
  if (fixed === raw) {
    return false;
  }

  try {
    JSON.parse(fixed);
    fs.writeFileSync(filePath, fixed, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function runFactoryHardening(): FactoryHardeningReport {
  const root = /*turbopackIgnore: true*/ process.cwd();
  const clientsRoot = path.join(root, ".prontara", "clients");
  const report: FactoryHardeningReport = {
    ok: true,
    cleanedClients: [],
    fixedTextFiles: [],
    warnings: [],
    summary: {
      totalClients: 0,
      healthyClients: 0,
      partialClients: 0,
      corruptClients: 0,
    },
  };

  const history = readFactoryDiskHistory();
  report.summary.totalClients = history.length;
  report.summary.healthyClients = history.filter((item) => item.state === "healthy").length;
  report.summary.partialClients = history.filter((item) => item.state === "partial").length;
  report.summary.corruptClients = history.filter((item) => item.state === "corrupt").length;

  for (const item of history) {
    const tenantFile = path.join(clientsRoot, item.clientId, "tenant.json");
    const brandingFile = path.join(clientsRoot, item.clientId, "branding.json");
    const artifactsFile = path.join(clientsRoot, item.clientId, "artifacts.json");

    for (const filePath of [tenantFile, brandingFile, artifactsFile]) {
      if (fs.existsSync(filePath) && (tryFixJsonFile(filePath))) {
        report.fixedTextFiles.push(filePath);
      }
    }

    if (item.state === "corrupt") {
      report.warnings.push("Cliente potencialmente corrupto: " + item.clientId);
    }

    if (item.state !== "corrupt") {
      report.cleanedClients.push(item.clientId);
    }
  }

  return report;
}