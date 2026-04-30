[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("clients","current","status","generate","use","new","update")]
  [string]$Action,

  [string]$Prompt,
  [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$Prontara = Join-Path $Root "prontara.ps1"
$Generator = Join-Path $Root "generate-prontara.ps1"
$NewFromRequirements = Join-Path $Root "scripts\new-client-from-requirements.ps1"
$CurrentFile = Join-Path $Root ".prontara\current-client.txt"

function Read-Utf8File([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  return [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
}

function Get-CurrentClientId {
  $value = Read-Utf8File $CurrentFile
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return $value.Trim()
}

function Invoke-ScriptDirect {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath,

    [object[]]$ArgumentList = @()
  )

  $allOutput = & $ScriptPath @ArgumentList 2>&1
  $text = ""

  if ($null -ne $allOutput) {
    $text = (($allOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
  }

  return [pscustomobject]@{
    ExitCode = 0
    Output   = $text
  }
}

function Invoke-GeneratorDirect {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ResolvedClientId
  )

  $allOutput = & $Generator -ClientId $ResolvedClientId 2>&1
  $text = ""

  if ($null -ne $allOutput) {
    $text = (($allOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
  }

  return [pscustomobject]@{
    ExitCode = 0
    Output   = $text
  }
}

$result = $null
$resolvedClientId = $ClientId

switch ($Action) {
  "clients" {
    $result = Invoke-ScriptDirect -ScriptPath $Prontara -ArgumentList @("clients")
  }

  "current" {
    $resolvedClientId = Get-CurrentClientId
    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      throw "No hay cliente activo."
    }

    $result = [pscustomobject]@{
      ExitCode = 0
      Output   = "Cliente activo: $resolvedClientId"
    }
  }

  "status" {
    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      $resolvedClientId = Get-CurrentClientId
    }

    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      throw "No hay cliente activo para consultar status."
    }

    $result = Invoke-ScriptDirect -ScriptPath $Prontara -ArgumentList @("status", $resolvedClientId)
  }

  "generate" {
    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      $resolvedClientId = Get-CurrentClientId
    }

    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      throw "No hay cliente activo para regenerar."
    }

    $result = Invoke-GeneratorDirect -ResolvedClientId $resolvedClientId
  }

  "use" {
    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      throw "Falta ClientId para la accion use."
    }

    $result = Invoke-ScriptDirect -ScriptPath $Prontara -ArgumentList @("use", $resolvedClientId)
  }

  "new" {
    if ([string]::IsNullOrWhiteSpace($Prompt)) {
      throw "Falta Prompt para la accion new."
    }

    if (-not (Test-Path $NewFromRequirements)) {
      throw "No se encontro scripts\new-client-from-requirements.ps1"
    }

    $beforeClient = Get-CurrentClientId
    $create = Invoke-ScriptDirect -ScriptPath $NewFromRequirements -ArgumentList @("-RequirementsText", $Prompt)
    $afterClient = Get-CurrentClientId

    if ([string]::IsNullOrWhiteSpace($afterClient)) {
      $afterClient = $beforeClient
    }

    if ([string]::IsNullOrWhiteSpace($afterClient)) {
      throw "No se pudo resolver el cliente activo despues del alta."
    }

    $resolvedClientId = $afterClient
    $gen = Invoke-GeneratorDirect -ResolvedClientId $resolvedClientId

    $joinedOutputParts = @()
    if (-not [string]::IsNullOrWhiteSpace($create.Output)) { $joinedOutputParts += $create.Output }
    if (-not [string]::IsNullOrWhiteSpace($gen.Output)) { $joinedOutputParts += $gen.Output }

    $result = [pscustomobject]@{
      ExitCode = 0
      Output   = ($joinedOutputParts -join [Environment]::NewLine + [Environment]::NewLine)
    }
  }

  "update" {
    if ([string]::IsNullOrWhiteSpace($Prompt)) {
      throw "Falta Prompt para la accion update."
    }

    $result = Invoke-ScriptDirect -ScriptPath $Prontara -ArgumentList @("update", $Prompt)
    if ([string]::IsNullOrWhiteSpace($resolvedClientId)) {
      $resolvedClientId = Get-CurrentClientId
    }
  }

  default {
    throw "Accion no soportada: $Action"
  }
}

$response = [pscustomobject]@{
  ok       = $true
  action   = $Action
  clientId = $resolvedClientId
  output   = $result.Output
}

$response | ConvertTo-Json -Depth 10
