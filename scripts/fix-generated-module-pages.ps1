[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $directory = Split-Path -Path $Path -Parent
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function New-ModulePageContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ModuleKey
    )

    return @"
import Link from "next/link";
import {
  getRuntimeProntaraConfig,
  getModuleRecommendations,
  getModuleFocusSummary,
} from "@/lib/factory/active-client-runtime";

export default function ModulePage() {
  const runtimeConfig = getRuntimeProntaraConfig();
  const moduleData = runtimeConfig.modules.find((m) => m.key === "$ModuleKey");
  const moduleActions: string[] =
    moduleData && Array.isArray((moduleData as any).simulatedActions)
      ? (moduleData as any).simulatedActions.map(String)
      : [];
  const recommendations = getModuleRecommendations("$ModuleKey", runtimeConfig);
  const focusSummary = getModuleFocusSummary("$ModuleKey", runtimeConfig);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>&lt;- Volver al dashboard</Link>
      </div>

      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{moduleData?.label || "$ModuleKey"}</h1>
      <p style={{ marginBottom: 24 }}>
        {moduleData?.description || "Módulo del ERP activo."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
            <strong>Registros del módulo</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>Estado</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>Detalle</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #ddd", background: "#fafafa" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Elemento 1</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Activo</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Registro de ejemplo</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>2026-04-20</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Elemento 2</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Pendiente</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Registro de ejemplo</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>2026-04-19</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Elemento 3</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Revisión</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>Registro de ejemplo</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>2026-04-18</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Contexto del ERP</h3>
            <p><strong>Cliente:</strong> {runtimeConfig.displayName}</p>
            <p><strong>Cliente activo:</strong> {runtimeConfig.clientId}</p>
            <p><strong>Área:</strong> {moduleData?.area || "General"}</p>
            <p><strong>Sector:</strong> {runtimeConfig.sector}</p>
            <p><strong>BusinessType:</strong> {runtimeConfig.businessType || "general"}</p>
            <p><strong>Tamaño:</strong> {runtimeConfig.blueprintMeta.companySize || "No definido"}</p>
            <p>
              <strong>Flujo principal:</strong>{" "}
              {runtimeConfig.blueprintMeta.coreFlow.length > 0
                ? runtimeConfig.blueprintMeta.coreFlow.join(" > ")
                : "No definido"}
            </p>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Enfoque sugerido</h3>
            <p style={{ marginTop: 0 }}>{focusSummary}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {recommendations.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>{item}</li>
              ))}
            </ul>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>Acciones simuladas</h3>
            {moduleActions.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {moduleActions.map((actionLabel) => (
                  <li key={actionLabel}>{actionLabel}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, opacity: 0.7 }}>
                No hay acciones simuladas definidas para este módulo.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
"@
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "No existe la ruta del proyecto: $ProjectRoot"
}

Set-Location -LiteralPath $ProjectRoot

$appRoot = Join-Path $ProjectRoot "src\app"
$excludedDirs = @("api", "factory", "_not-found", "site")

$modulePages = Get-ChildItem -LiteralPath $appRoot -Directory | Where-Object {
    $_.Name -notin $excludedDirs
} | ForEach-Object {
    $pagePath = Join-Path $_.FullName "page.tsx"
    if (Test-Path -LiteralPath $pagePath) {
        [PSCustomObject]@{
            ModuleKey = $_.Name
            Path      = $pagePath
        }
    }
} | Where-Object {
    $_.ModuleKey -ne "" -and $_.ModuleKey -ne "page"
}

foreach ($target in $modulePages) {
    $content = New-ModulePageContent -ModuleKey $target.ModuleKey
    Write-FileUtf8NoBom -Path $target.Path -Content $content
}

Write-Host "Fix de páginas generado correctamente." -ForegroundColor Green
foreach ($target in $modulePages) {
    Write-Host (" - " + $target.Path)
}