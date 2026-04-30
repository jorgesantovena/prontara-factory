#!/usr/bin/env node
// CLI unificada de Prontara Factory (F-09).
//
// Reemplaza progresivamente los scripts PowerShell de la raíz. Uso:
//
//   node scripts/ts/prontara.mjs <subcomando> [opciones]
//
// Subcomandos soportados hoy:
//   list-business                 Muestra el registro de tipos de negocio.
//   blueprint <business-type>     Imprime el blueprint resuelto (JSON).
//                                 Flags: --name "<nombre>"
//
// Subcomandos planificados (ver docs/scripts-migration-plan.md):
//   generate-client               Port de generate-prontara.ps1.
//   build-client                  Port de build-prontara-client.ps1.
//   build-release                 Port de build-prontara-release.ps1.
//   deploy-release                Port de deploy-prontara-release.ps1.
//   export-package                Port de export-prontara-package.ps1.
//   apply-database                Port de apply-prontara-database.ps1.
//   generate-database             Port de generate-prontara-database.ps1.
//   init-database                 Port de init-prontara-database.ps1.

import { BUSINESS_REGISTRY } from "./business-registry.mjs";
import { buildBlueprint } from "./build-blueprint.mjs";

const args = process.argv.slice(2);
const subcommand = args[0];

function printUsage() {
  console.error(`prontara — CLI unificada (F-09)

Uso:
  node scripts/ts/prontara.mjs <subcomando> [opciones]

Subcomandos:
  list-business              Listar tipos de negocio
  blueprint <businessType>   Resolver blueprint (flag --name "<nombre>")
  help                       Esta ayuda

Planificados (ver docs/scripts-migration-plan.md):
  generate-client, build-client, build-release, deploy-release,
  export-package, apply-database, generate-database, init-database
`);
}

function parseFlag(name) {
  const idx = args.indexOf("--" + name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

async function main() {
  switch (subcommand) {
    case undefined:
    case "help":
    case "--help":
    case "-h": {
      printUsage();
      if (!subcommand) process.exit(1);
      return;
    }

    case "list-business": {
      for (const b of BUSINESS_REGISTRY) {
        console.log(b.key.padEnd(20) + " " + b.name);
      }
      return;
    }

    case "blueprint": {
      const businessType = args[1];
      if (!businessType) {
        console.error("falta <businessType>. Usa `prontara list-business` para ver las opciones.");
        process.exit(1);
      }
      const requestedName = parseFlag("name");
      const blueprint = buildBlueprint(businessType, requestedName);
      console.log(JSON.stringify(blueprint, null, 2));
      return;
    }

    case "generate-client":
    case "build-client":
    case "build-release":
    case "deploy-release":
    case "export-package":
    case "apply-database":
    case "generate-database":
    case "init-database": {
      console.error(
        "Subcomando `" + subcommand + "` aún no portado desde PowerShell.\n" +
        "Ver estado en docs/scripts-migration-plan.md. Mientras tanto usa el .ps1 equivalente."
      );
      process.exit(2);
      return;
    }

    default: {
      console.error("Subcomando desconocido: " + subcommand);
      printUsage();
      process.exit(1);
    }
  }
}

await main();
