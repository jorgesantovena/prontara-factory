Set-StrictMode -Version Latest

function Get-ProntaraRoot {
    param(
        [string]$StartPath
    )

    $current = if ([string]::IsNullOrWhiteSpace($StartPath)) {
        (Get-Location).Path
    } else {
        $StartPath
    }

    if (Test-Path -LiteralPath $current -PathType Leaf) {
        $current = Split-Path -Parent $current
    }

    while (-not [string]::IsNullOrWhiteSpace($current)) {
        $dataDir = Join-Path $current "data"
        $prontaraDir = Join-Path $current ".prontara"
        if ((Test-Path -LiteralPath $dataDir) -or (Test-Path -LiteralPath $prontaraDir)) {
            return $current
        }

        $parent = Split-Path -Parent $current
        if ($parent -eq $current) {
            break
        }
        $current = $parent
    }

    throw "No se ha podido resolver la raíz de Prontara."
}

function Get-ActiveClientRegistryPaths {
    param(
        [string]$Root
    )

    if ([string]::IsNullOrWhiteSpace($Root)) {
        $Root = Get-ProntaraRoot
    }

    return [pscustomobject]@{
        Root = $Root
        RegistryFile = Join-Path $Root "data\factory\active-client.json"
        LegacyFile   = Join-Path $Root ".prontara\current-client.txt"
    }
}

function Write-FileUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Text
    )

    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir) -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -ItemType Directory -Force | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Write-JsonUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Object,
        [int]$Depth = 20
    )

    $json = $Object | ConvertTo-Json -Depth $Depth
    Write-FileUtf8NoBom -Path $Path -Text $json
}

function Get-ActiveClientId {
    param(
        [string]$Root
    )

    $paths = Get-ActiveClientRegistryPaths -Root $Root

    if (-not (Test-Path -LiteralPath $paths.RegistryFile)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $paths.RegistryFile -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }

        $obj = $raw | ConvertFrom-Json -ErrorAction Stop

        if ($null -eq $obj) {
            return $null
        }

        if ($obj.PSObject.Properties.Name -contains "clientId") {
            $clientId = [string]$obj.clientId
            if (-not [string]::IsNullOrWhiteSpace($clientId)) {
                return $clientId.Trim()
            }
        }
    }
    catch {
        throw "No se pudo leer data/factory/active-client.json: $($_.Exception.Message)"
    }

    return $null
}

function Set-ActiveClientId {
    param(
        [Parameter(Mandatory = $true)][string]$ClientId,
        [string]$Root,
        [switch]$MirrorLegacy
    )

    if ([string]::IsNullOrWhiteSpace($ClientId)) {
        throw "ClientId no puede estar vacío."
    }

    $paths = Get-ActiveClientRegistryPaths -Root $Root
    $now = (Get-Date).ToString("s")

    $payload = [ordered]@{
        clientId  = $ClientId.Trim()
        updatedAt = $now
    }

    Write-JsonUtf8NoBom -Path $paths.RegistryFile -Object $payload -Depth 5

    if ($MirrorLegacy) {
        Write-FileUtf8NoBom -Path $paths.LegacyFile -Text ($ClientId.Trim() + [Environment]::NewLine)
    }

    return $payload.clientId
}

function Clear-ActiveClientId {
    param(
        [string]$Root,
        [switch]$MirrorLegacy
    )

    $paths = Get-ActiveClientRegistryPaths -Root $Root

    $payload = [ordered]@{
        clientId  = $null
        updatedAt = (Get-Date).ToString("s")
    }

    Write-JsonUtf8NoBom -Path $paths.RegistryFile -Object $payload -Depth 5

    if ($MirrorLegacy -and (Test-Path -LiteralPath $paths.LegacyFile)) {
        Remove-Item -LiteralPath $paths.LegacyFile -Force
    }
}

function Get-LegacyCurrentClientId {
    param(
        [string]$Root
    )

    $paths = Get-ActiveClientRegistryPaths -Root $Root

    if (Test-Path -LiteralPath $paths.LegacyFile) {
        $id = (Get-Content -LiteralPath $paths.LegacyFile -Raw).Trim()
        if (-not [string]::IsNullOrWhiteSpace($id)) {
            return $id
        }
    }

    return $null
}