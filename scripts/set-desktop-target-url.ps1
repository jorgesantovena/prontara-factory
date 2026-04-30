[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Root "..\desktop-wrapper\app-config.json"
$ConfigPath = [System.IO.Path]::GetFullPath($ConfigPath)

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$config = [System.IO.File]::ReadAllText($ConfigPath, $utf8NoBom) | ConvertFrom-Json
$config.targetUrl = $TargetUrl
[System.IO.File]::WriteAllText($ConfigPath, ($config | ConvertTo-Json -Depth 10), $utf8NoBom)

Write-Host "Target URL actualizada:" -ForegroundColor Green
Write-Host $TargetUrl
