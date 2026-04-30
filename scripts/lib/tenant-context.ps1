function Get-ProntaraProjectRoot {
    param(
        [string]$Root
    )

    if (-not [string]::IsNullOrWhiteSpace($Root)) {
        return $Root
    }

    return (Get-Location).Path
}

function Get-ProntaraClientsRoot {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\clients")
}

function Get-ProntaraDataRoot {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\data")
}

function Get-ProntaraArtifactsRoot {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\artifacts")
}

function Get-ProntaraExportsRoot {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\exports")
}

function Get-ProntaraDeploymentsRoot {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\deployments")
}

function Get-ProntaraLegacyCurrentClientPath {
    param(
        [string]$Root
    )

    return (Join-Path (Get-ProntaraProjectRoot -Root $Root) ".prontara\current-client.txt")
}

function Get-ProntaraTenantContext {
    param(
        [Parameter(Mandatory = $true)][string]$ClientId,
        [string]$Root
    )

    $normalized = $ClientId.Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        throw "clientId cannot be empty"
    }

    $projectRoot = Get-ProntaraProjectRoot -Root $Root

    return [pscustomobject]@{
        clientId         = $normalized
        projectRoot      = $projectRoot
        definitionPath   = Join-Path (Get-ProntaraClientsRoot -Root $projectRoot) "$normalized.json"
        dataRoot         = Join-Path (Get-ProntaraDataRoot -Root $projectRoot) $normalized
        artifactsRoot    = Join-Path (Get-ProntaraArtifactsRoot -Root $projectRoot) $normalized
        exportsRoot      = Get-ProntaraExportsRoot -Root $projectRoot
        deploymentsRoot  = Join-Path (Get-ProntaraDeploymentsRoot -Root $projectRoot) $normalized
        legacyCurrentTxt = Get-ProntaraLegacyCurrentClientPath -Root $projectRoot
    }
}