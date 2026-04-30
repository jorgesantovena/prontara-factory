[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BlueprintJson,

    [Parameter(Mandatory = $true)]
    [string]$InstancesDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-ClientId([string]$sector) {
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    return "$sector-$stamp"
}

function Resolve-LegacySector([string]$businessType) {
    switch ($businessType) {
        "software-factory"  { return "estandar" }
        "clinica-dental"    { return "clinica" }
        "panaderia"         { return "panaderia" }
        "taller-auto"       { return "taller-auto" }
        "peluqueria"        { return "peluqueria" }
        "tienda-deportes"   { return "retail" }
        "despacho-abogados" { return "despacho" }
        default             { return "estandar" }
    }
}

$blueprint = $BlueprintJson | ConvertFrom-Json

$sector = Resolve-LegacySector $blueprint.businessType
$clientId = New-ClientId $sector
$instancePath = Join-Path $InstancesDir $clientId

New-Item -ItemType Directory -Force $instancePath | Out-Null

$coreModules = @()
if ($blueprint.PSObject.Properties.Name -contains 'coreModules') {
    $coreModules = @($blueprint.coreModules)
}

$branding = [pscustomobject]@{
    appName  = $blueprint.displayName
    logoText = $blueprint.displayName
}

if ($blueprint.PSObject.Properties.Name -contains 'branding' -and $null -ne $blueprint.branding) {
    if ($blueprint.branding.PSObject.Properties.Name -contains 'appName') {
        $branding.appName = $blueprint.branding.appName
    }
    if ($blueprint.branding.PSObject.Properties.Name -contains 'logoText') {
        $branding.logoText = $blueprint.branding.logoText
    }
}

$client = [pscustomobject]@{
    clientId         = $clientId
    displayName      = $blueprint.displayName
    rawText          = if ($blueprint.PSObject.Properties.Name -contains 'sourceText') { $blueprint.sourceText } else { "" }
    updates          = @()
    renameMap        = [pscustomobject]@{}
    sampleData       = [pscustomobject]@{}
    status           = "created"
    sector           = $sector
    businessType     = $blueprint.businessType
    blueprintVersion = $blueprint.blueprintVersion
    modules          = @($coreModules)
    instancePath     = $instancePath
    createdAt        = (Get-Date).ToString("s")
    version          = "0.1.0"
    runtime          = "web"
    desktop          = "pending"
    backend          = "pending"
    branding         = $branding
    blueprintMeta    = [pscustomobject]@{
        companyProfile = if ($blueprint.PSObject.Properties.Name -contains 'companyProfile') { $blueprint.companyProfile } else { $null }
        coreFlow       = if ($blueprint.PSObject.Properties.Name -contains 'coreFlow') { @($blueprint.coreFlow) } else { @() }
        optionalModules= if ($blueprint.PSObject.Properties.Name -contains 'optionalModules') { @($blueprint.optionalModules) } else { @() }
        entities       = if ($blueprint.PSObject.Properties.Name -contains 'entities') { @($blueprint.entities) } else { @() }
        workflows      = if ($blueprint.PSObject.Properties.Name -contains 'workflows') { @($blueprint.workflows) } else { @() }
        reportingNeeds = if ($blueprint.PSObject.Properties.Name -contains 'reportingNeeds') { @($blueprint.reportingNeeds) } else { @() }
        notes          = if ($blueprint.PSObject.Properties.Name -contains 'notes') { @($blueprint.notes) } else { @() }
    }
}

$client | ConvertTo-Json -Depth 40
