param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet("new","update","status","clients","dev","generate","use","current","clone","delete","export","rename","help","open","start","release","build-client")]
  [string]$Command,

  [Parameter(Position=1)]
  [string]$Text,

  [Parameter(Position=2)]
  [string]$Text2
)

[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "scripts\lib\active-client-registry.ps1")
. (Join-Path $Root "scripts\lib\tenant-context.ps1")
$RegistryDir = Get-ProntaraClientsRoot -Root $Root
$InstancesDir = Join-Path $Root ".prontara\instances"
$GeneratorScript = Join-Path $Root "generate-prontara.ps1"
$ReleaseScript = Join-Path $Root "build-prontara-release.ps1"
$CurrentFile = Get-ProntaraLegacyCurrentClientPath -Root $Root

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8File([string]$path) {
  return [System.IO.File]::ReadAllText($path, $Utf8NoBom)
}

function Write-Utf8File([string]$path, [string]$content) {
  [System.IO.File]::WriteAllText($path, $content, $Utf8NoBom)
}

function Read-JsonFile([string]$path) {
  $raw = Read-Utf8File $path
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  return ($raw | ConvertFrom-Json)
}

New-Item -ItemType Directory -Force $RegistryDir, $InstancesDir | Out-Null

. "$Root\business-registry.ps1"
. "$Root\resolve-business-type.ps1"
. "$Root\build-blueprint.ps1"
. "$Root\resolve-explicit-modules.ps1"
. "$Root\resolve-business-name.ps1"

function Normalize-Text([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return "" }
  return $s.Trim().ToLowerInvariant()
}

function Get-CurrentClientId {
  if (Test-Path $CurrentFile) {
    $id = (Read-Utf8File $CurrentFile).Trim()
    if (-not [string]::IsNullOrWhiteSpace($id)) { return $id }
  }
  return $null
}

function Detect-Sector([string]$s) {
  if ($s -match "taller de barcos|taller n?utico|taller nautico|nautica|n?utica|embarcaciones|barcos") { return "taller-nautico" }
  if ($s -match "taller de coches|taller mec?nico|taller mecanico|automoci?n|automocion|veh?culos|vehiculos") { return "taller-auto" }
  if ($s -match "cl?nica|clinica|dental|fisioterapia|podolog?a|podologia") { return "clinica" }
  if ($s -match "distribuidora|mayorista|reparto|almac?n|almacen") { return "distribucion" }
  if ($s -match "panader?a|panaderia|obrador|pasteler?a|pasteleria") { return "panaderia" }
  if ($s -match "retail|tienda|comercio") { return "retail" }
  if ($s -match "taller|reparaci?n|reparacion|mantenimiento|servicio t?cnico|servicio tecnico") { return "taller" }
  return "estandar"
}

function Detect-Modules([string]$s, [string]$sector) {
  $mods = New-Object System.Collections.Generic.List[string]

  $map = [ordered]@{
    "clientes" = "clientes|cliente|pacientes|paciente"
    "proveedores" = "proveedores|proveedor"
    "productos" = "productos|producto|art?culos|articulos|catalogo|cat?logo"
    "compras" = "compras|aprovisionamiento"
    "ventas" = "ventas|comercial"
    "pedidos" = "pedidos|encargos"
    "facturacion" = "facturaci?n|facturacion|facturas"
    "almacen" = "almac?n|almacen|stock|inventario"
    "taller" = "taller|reparaciones|mantenimiento|servicio t?cnico|servicio tecnico"
    "ordenes_trabajo" = "?rdenes de trabajo|ordenes de trabajo|?rdenes de servicio|ordenes de servicio|partes de trabajo|intervenciones"
    "vehiculos" = "veh?culos|vehiculos|coches|autom?viles|automoviles"
    "embarcaciones" = "embarcaciones|barcos|yates"
    "citas" = "citas|agenda|reservas|turnos"
    "documentos" = "documentos|archivos|consentimientos"
    "crm" = "crm|oportunidades|pipeline"
    "web" = "web|p?gina web|pagina web|sitio web"
    "ajustes" = "ajustes|configuraci?n|configuracion"
    "presupuestos" = "presupuestos|presupuesto"
    "cobros" = "cobros|cobro|pagos recibidos|pago recibido"
    "pagos" = "pagos|pago|pagos emitidos|pago emitido"
    "tesoreria" = "tesorer?a|tesoreria|movimientos de tesorer?a|movimientos de tesoreria"
  }

  foreach ($key in $map.Keys) {
    if ($s -match $map[$key]) { $mods.Add($key) }
  }

  switch ($sector) {
    "taller-nautico" {
      foreach ($m in "clientes","proveedores","compras","ventas","taller","facturacion","pedidos","embarcaciones","ordenes_trabajo","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "taller-auto" {
      foreach ($m in "clientes","proveedores","compras","ventas","taller","facturacion","vehiculos","ordenes_trabajo","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "clinica" {
      foreach ($m in "clientes","citas","documentos","facturacion","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "distribucion" {
      foreach ($m in "clientes","proveedores","productos","compras","ventas","pedidos","almacen","facturacion","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "panaderia" {
      foreach ($m in "productos","compras","ventas","pedidos","almacen","facturacion","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "retail" {
      foreach ($m in "clientes","productos","compras","ventas","almacen","facturacion","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    "taller" {
      foreach ($m in "clientes","proveedores","compras","ventas","taller","facturacion","ordenes_trabajo","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
    default {
      foreach ($m in "clientes","ventas","facturacion","ajustes") {
        if (-not $mods.Contains($m)) { $mods.Add($m) }
      }
    }
  }

  return @($mods)
}

function New-ClientId([string]$sector) {
  $stamp = Get-Date -Format "yyyyMMddHHmmss"
  return "$sector-$stamp"
}

function New-ProntaraClientFromPrompt([string]$text, [string]$instancesDir) {
  $businessType = Resolve-ProntaraBusinessType $text
  $requestedName = Resolve-ProntaraBusinessName $text
  $blueprint = New-ProntaraBlueprint $businessType $requestedName
  $explicitModules = Resolve-ProntaraExplicitModules $text
  $finalModules = Merge-ProntaraModules $blueprint.Modules $explicitModules

  $clientId = New-ClientId $blueprint.LegacySector
  $instancePath = Join-Path $instancesDir $clientId
  New-Item -ItemType Directory -Force $instancePath | Out-Null

  return [pscustomobject]@{
    clientId = $clientId
    displayName = $blueprint.BusinessName
    rawText = $text
    updates = @()
    renameMap = @{}
    sampleData = [pscustomobject]@{}
    status = "created"
    sector = $blueprint.LegacySector
    businessType = $blueprint.BusinessType
    blueprintVersion = $blueprint.BlueprintVersion
    modules = @($finalModules)
    instancePath = $instancePath
    createdAt = (Get-Date).ToString("s")
    version = "0.1.0"
    runtime = "web"
    desktop = "pending"
    backend = "pending"
  }
}

function Save-Client($obj, $path) {
  $obj | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $path
}

function Display-NameForSector([string]$sector) {
  switch ($sector) {
    "taller-nautico" { "Prontara Taller Náutico" }
    "taller-auto"    { "Prontara Taller Auto" }
    "clinica"        { "Prontara Clínica" }
    "distribucion"   { "Prontara Distribución" }
    "panaderia"      { "Prontara Panadería" }
    "retail"         { "Prontara Retail" }
    "taller"         { "Prontara Taller" }
    default          { "Prontara ERP" }
  }
}

function Run-Generator([string]$clientId) {
  if (Test-Path $GeneratorScript) {
    & $GeneratorScript -ClientId $clientId
  } else {
    Write-Host "No se encontr? generate-prontara.ps1" -ForegroundColor Yellow
  }
}

function Get-ModuleAliasMap {
  return @{
    "clientes" = "clientes"
    "cliente" = "clientes"
    "pacientes" = "clientes"
    "paciente" = "clientes"
    "proveedores" = "proveedores"
    "proveedor" = "proveedores"
    "productos" = "productos"
    "producto" = "productos"
    "compras" = "compras"
    "ventas" = "ventas"
    "pedidos" = "pedidos"
    "facturacion" = "facturacion"
    "facturaci?n" = "facturacion"
    "almacen" = "almacen"
    "almac?n" = "almacen"
    "taller" = "taller"
    "ordenes de trabajo" = "ordenes_trabajo"
    "?rdenes de trabajo" = "ordenes_trabajo"
    "ordenes de servicio" = "ordenes_trabajo"
    "?rdenes de servicio" = "ordenes_trabajo"
    "embarcaciones" = "embarcaciones"
    "barcos" = "embarcaciones"
    "vehiculos" = "vehiculos"
    "veh?culos" = "vehiculos"
    "citas" = "citas"
    "documentos" = "documentos"
    "crm" = "crm"
    "web" = "web"
    "ajustes" = "ajustes"
    "presupuestos" = "presupuestos"
    "cobros" = "cobros"
    "pagos" = "pagos"
    "tesoreria" = "tesoreria"
  }
}

function New-SampleRows([string]$moduleKey, [int]$count, [string]$sector) {
  $rows = @()
  for ($i = 1; $i -le $count; $i++) {
    switch ("$sector|$moduleKey") {
      "clinica|clientes" { $rows += "Paciente $i" }
      "clinica|citas" { $rows += "Cita $i" }
      "clinica|documentos" { $rows += "Documento cl?nico $i" }
      default {
        switch ($moduleKey) {
          "clientes" { $rows += "Cliente $i" }
          "proveedores" { $rows += "Proveedor $i" }
          "productos" { $rows += "Producto $i" }
          "compras" { $rows += "Compra $i" }
          "ventas" { $rows += "Venta $i" }
          "pedidos" { $rows += "Pedido $i" }
          "facturacion" { $rows += "Factura $i" }
          "almacen" { $rows += "Movimiento $i" }
          "taller" { $rows += "Trabajo $i" }
          "ordenes_trabajo" { $rows += "Orden $i" }
          "vehiculos" { $rows += "Veh?culo $i" }
          "embarcaciones" { $rows += "Embarcaci?n $i" }
          "citas" { $rows += "Cita $i" }
          "documentos" { $rows += "Documento $i" }
          "crm" { $rows += "Oportunidad $i" }
          "web" { $rows += "P?gina $i" }
          "ajustes" { $rows += "Ajuste $i" }
          "presupuestos" { $rows += "Presupuesto $i" }
          "cobros" { $rows += "Cobro $i" }
          "pagos" { $rows += "Pago $i" }
          "tesoreria" { $rows += "Movimiento tesorer?a $i" }
          default { $rows += "Elemento $i" }
        }
      }
    }
  }
  return ,$rows
}

switch ($Command) {
  "release" {
    if (-not (Test-Path $ReleaseScript)) {
      Write-Host "No se encontr? build-prontara-release.ps1" -ForegroundColor Red
      exit 1
    }

    if ([string]::IsNullOrWhiteSpace($Text)) {
      & $ReleaseScript
    } else {
      & $ReleaseScript $Text
    }

    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }

  "build-client" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      & (Join-Path $Root "build-prontara-client.ps1")
    } else {
      & (Join-Path $Root "build-prontara-client.ps1") $Text
    }
  }

  "start" {
    $active = Get-CurrentClientId
    if ([string]::IsNullOrWhiteSpace($active)) {
      Write-Host "No hay cliente activo. Usa primero: prontara use <clientId>" -ForegroundColor Yellow
      exit 1
    }

    Run-Generator $active

    $cmd = "Set-Location 'C:\ProntaraFactory\prontara-factory'; pnpm dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3000"

    Write-Host ""
    Write-Host "ERP arrancado para el cliente activo: $active" -ForegroundColor Green
    Write-Host "Abriendo navegador en http://localhost:3000"
    Write-Host ""
  }
  "open" {
    $url = "http://localhost:3000"
    Start-Process $url
    Write-Host ""
    Write-Host "Abriendo: $url" -ForegroundColor Green
    Write-Host ""
  }
  "help" {
    Write-Host ""
    $active = Get-CurrentClientId
    if ($active) { Write-Host "Cliente activo: $active" -ForegroundColor Cyan; Write-Host "" }
    Write-Host "Comandos disponibles:" -ForegroundColor Green
    Write-Host "  .\prontara.ps1 new ""hazme un ERP para una cl?nica dental con citas, documentos y facturaci?n"""
    Write-Host "  .\prontara.ps1 use <clientId>"
    Write-Host "  .\prontara.ps1 current"
    Write-Host "  .\prontara.ps1 update ""a?ade web"""
    Write-Host "  .\prontara.ps1 update ""a?ade 5 pacientes de ejemplo"""
    Write-Host "  .\prontara.ps1 update ""a?ade un m?dulo de presupuestos"""
    Write-Host "  .\prontara.ps1 update ""a?ade 4 presupuestos de ejemplo"""
    Write-Host "  .\prontara.ps1 update ""quita los datos de ejemplo de citas"""
    Write-Host "  .\prontara.ps1 update ""quita todos los datos de ejemplo"""
    Write-Host "  .\prontara.ps1 status <clientId>"
    Write-Host "  .\prontara.ps1 clients"
    Write-Host "  .\prontara.ps1 clone <clientId> ""Nuevo nombre"""
    Write-Host "  .\prontara.ps1 rename <clientId> ""Nuevo nombre comercial"""
    Write-Host "  .\prontara.ps1 export <clientId>"
    Write-Host "  .\prontara.ps1 delete <clientId>"
    Write-Host "  .\prontara.ps1 dev"
    Write-Host "  .\prontara.ps1 open"
    Write-Host "  .\prontara.ps1 start"
    Write-Host ""
  }
  "new" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      Write-Host "Falta el texto." -ForegroundColor Yellow
      exit 1
    }

    $client = New-ProntaraClientFromPrompt $Text $InstancesDir

    $clientFile = Join-Path $RegistryDir "$($client.clientId).json"
    Save-Client $client $clientFile
    Write-Utf8File $CurrentFile $client.clientId

    Write-Host ""
    Write-Host "ERP registrado correctamente." -ForegroundColor Green
    Write-Host "Cliente: $($client.displayName)"
    Write-Host "ID: $($client.clientId)"
    Write-Host "Sector detectado: $($client.sector)"
    Write-Host "BusinessType: $($client.businessType)"
    Write-Host "BlueprintVersion: $($client.blueprintVersion)"
    Write-Host "Módulos: $($client.modules -join ', ')"
    Write-Host "Cliente activo: $($client.clientId)"
    Write-Host ""

    Run-Generator $client.clientId
  }

  "clone" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      Write-Host 'Usa: .\prontara.ps1 clone <clientId> "<Nuevo nombre>"' -ForegroundColor Yellow
      exit 1
    }
    if ([string]::IsNullOrWhiteSpace($Text2)) {
      Write-Host 'Falta el nuevo nombre. Usa: .\prontara.ps1 clone <clientId> "<Nuevo nombre>"' -ForegroundColor Yellow
      exit 1
    }

    $sourceFile = Join-Path $RegistryDir "$Text.json"
    if (-not (Test-Path $sourceFile)) {
      Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
      exit 1
    }

    $source = Read-JsonFile $sourceFile
    $newClientId = New-ClientId $source.sector
    $newInstancePath = Join-Path $InstancesDir $newClientId
    New-Item -ItemType Directory -Force $newInstancePath | Out-Null

    $clone = [pscustomobject]@{
      clientId = $newClientId
      displayName = $Text2
      rawText = $source.rawText
      updates = @()
      renameMap = $source.renameMap
      sampleData = $source.sampleData
      status = "cloned"
      sector = $source.sector
      modules = @($source.modules)
      instancePath = $newInstancePath
      createdAt = (Get-Date).ToString("s")
      version = "0.1.0"
      runtime = "web"
      desktop = "pending"
      backend = "pending"
    }

    $newFile = Join-Path $RegistryDir "$newClientId.json"
    Save-Client $clone $newFile
    Write-Utf8File $CurrentFile $newClientId

    Write-Host ""
    Write-Host "ERP clonado correctamente." -ForegroundColor Green
    Write-Host "Origen: $($source.clientId)"
    Write-Host "Nuevo cliente: $Text2"
    Write-Host "Nuevo ID: $newClientId"
    Write-Host "Cliente activo: $newClientId"
    Write-Host ""

    Run-Generator $newClientId
  }

  "update" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      Write-Host 'Usa: .\prontara.ps1 update "<cambio>" o ".\prontara.ps1 update "<clientId>: <cambio>""' -ForegroundColor Yellow
      exit 1
    }

    $clientId = $null
    $changeText = $null

    if ($Text -match "^\s*([^:]+)\s*:\s*(.+)$") {
      $clientId = $matches[1].Trim()
      $changeText = $matches[2].Trim()
    } else {
      $clientId = Get-CurrentClientId
      $changeText = $Text.Trim()
    }

    if ([string]::IsNullOrWhiteSpace($clientId)) {
      Write-Host "No hay cliente activo. Usa primero: .\prontara.ps1 use <clientId>" -ForegroundColor Red
      exit 1
    }

    $clientFile = Join-Path $RegistryDir "$clientId.json"
    if (-not (Test-Path $clientFile)) {
      Write-Host "No existe ese cliente: $clientId" -ForegroundColor Red
      exit 1
    }

    $client = Read-JsonFile $clientFile

    if (-not ($client.PSObject.Properties.Name -contains "updates")) {
      $client | Add-Member -NotePropertyName updates -NotePropertyValue @()
    }
    if (-not ($client.PSObject.Properties.Name -contains "renameMap")) {
      $client | Add-Member -NotePropertyName renameMap -NotePropertyValue ([pscustomobject]@{})
    }
    if (-not ($client.PSObject.Properties.Name -contains "sampleData")) {
      $client | Add-Member -NotePropertyName sampleData -NotePropertyValue ([pscustomobject]@{})
    }

    $normalized = Normalize-Text $changeText
    $newModules = Detect-Modules $normalized $client.sector
    $aliasMap = Get-ModuleAliasMap

    $removeKey = $null
    if ($normalized -match "quita\s+(.+)$") {
      $toRemoveText = $matches[1].Trim()
      if ($aliasMap.ContainsKey($toRemoveText)) {
        $removeKey = $aliasMap[$toRemoveText]
      }
    }

    $allModules = New-Object System.Collections.Generic.List[string]
    foreach ($m in $client.modules) {
      if (($removeKey -eq $null) -or ($m -ne $removeKey)) {
        if (-not $allModules.Contains($m)) { $allModules.Add($m) }
      }
    }
    foreach ($m in $newModules) {
      if (($removeKey -eq $null) -or ($m -ne $removeKey)) {
        if (-not $allModules.Contains($m)) { $allModules.Add($m) }
      }
    }

    if ($normalized -match "cambia\s+(.+?)\s+por\s+(.+)$") {
      $from = $matches[1].Trim()
      $to = $matches[2].Trim()
      if ($aliasMap.ContainsKey($from)) {
        $key = $aliasMap[$from]
        $client.renameMap | Add-Member -NotePropertyName $key -NotePropertyValue $to -Force
      }
    }

    if ($normalized -match "a?ade\s+(\d+)\s+(.+?)\s+de ejemplo$") {
      $count = [int]$matches[1]
      $targetText = $matches[2].Trim()
      if ($aliasMap.ContainsKey($targetText)) {
        $sampleKey = $aliasMap[$targetText]
        $rows = New-SampleRows $sampleKey $count $client.sector
        $client.sampleData | Add-Member -NotePropertyName $sampleKey -NotePropertyValue $rows -Force
        if (-not $allModules.Contains($sampleKey)) { $allModules.Add($sampleKey) }
      }
    }

    if ($normalized -match "quita\s+los\s+datos\s+de\s+ejemplo\s+de\s+(.+)$") {
      $targetText = $matches[1].Trim()
      if ($aliasMap.ContainsKey($targetText)) {
        $sampleKey = $aliasMap[$targetText]
        if ($client.sampleData.PSObject.Properties.Name -contains $sampleKey) {
          $client.sampleData.PSObject.Properties.Remove($sampleKey)
        }
      }
    }

    if ($normalized -eq "quita todos los datos de ejemplo") {
      $client.sampleData = [pscustomobject]@{}
    }

    $updates = @()
    if ($client.updates) { $updates += $client.updates }
    $updates += [pscustomobject]@{
      at = (Get-Date).ToString("s")
      text = $changeText
      detectedModules = $newModules
      removedModule = $removeKey
    }

    $client.modules = @($allModules)
    $client.updates = $updates
    $client.status = "updated"

    Save-Client $client $clientFile

    Write-Host ""
    Write-Host "Actualizaci?n aplicada." -ForegroundColor Green
    Write-Host "Cliente: $($client.displayName)"
    Write-Host "ID: $clientId"
    Write-Host "Cambio: $changeText"
    Write-Host "M?dulos actuales: $($client.modules -join ', ')"
    Write-Host ""

    Run-Generator $clientId
  }

  "generate" {
    $clientId = $Text
    if ([string]::IsNullOrWhiteSpace($clientId)) {
      $clientId = Get-CurrentClientId
    }

    if ([string]::IsNullOrWhiteSpace($clientId)) {
      Write-Host "No hay cliente activo. Usa primero: prontara use <clientId>" -ForegroundColor Yellow
      exit 1
    }

    $jsonPath = Join-Path $RegistryDir "$clientId.json"
    if (-not (Test-Path $jsonPath)) {
      Write-Host "No existe el cliente: $clientId" -ForegroundColor Red
      exit 1
    }

    Run-Generator $clientId
  }

  "use" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      Write-Host "Indica el clientId." -ForegroundColor Yellow
      exit 1
    }
        $file = Join-Path $RegistryDir "$Text.json"
    $resolvedId = $Text

    if (-not (Test-Path $file)) {
      $match = $null
      $files = Get-ChildItem $RegistryDir -Filter *.json
      foreach ($f in $files) {
        $client = Read-JsonFile $f.FullName
        if ($client.displayName -eq $Text) {
          $match = $client
          break
        }
      }

      if ($match) {
        $resolvedId = $match.clientId
        $file = Join-Path $RegistryDir "$resolvedId.json"
      } else {
        Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
        exit 1
      }
    }

    Write-Utf8File $CurrentFile $resolvedId
    Write-Host ""
    Write-Host "Cliente activo: $resolvedId" -ForegroundColor Green
    Write-Host ""
    Run-Generator $resolvedId
  }

  "delete" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      $Text = Get-CurrentClientId
      if ([string]::IsNullOrWhiteSpace($Text)) {
        Write-Host "No hay cliente activo y no has indicado un clientId." -ForegroundColor Yellow
        exit 1
      }
    }

        $file = Join-Path $RegistryDir "$Text.json"

    if (-not (Test-Path $file)) {
      $match = $null
      $files = Get-ChildItem $RegistryDir -Filter *.json
      foreach ($f in $files) {
        $candidate = Read-JsonFile $f.FullName
        if ($candidate.displayName -eq $Text) {
          $match = $candidate
          break
        }
      }

      if ($match) {
        $client = $match
      } else {
        Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
        exit 1
      }
    } else {
      $client = Read-JsonFile $file
    }

    Remove-Item $file -Force

    if ($client.instancePath -and (Test-Path $client.instancePath)) {
      Remove-Item $client.instancePath -Recurse -Force
    }

    $current = Get-CurrentClientId
    if ($current -eq $Text -and (Test-Path $CurrentFile)) {
      Remove-Item $CurrentFile -Force
    }

    Write-Host ""
    Write-Host "Cliente borrado correctamente." -ForegroundColor Green
    Write-Host "ID: $Text"
    Write-Host "Nombre: $($client.displayName)"
    Write-Host ""
  }

"export" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      $Text = Get-CurrentClientId
      if ([string]::IsNullOrWhiteSpace($Text)) {
        Write-Host "No hay cliente activo y no has indicado un clientId." -ForegroundColor Yellow
        exit 1
      }
    }

        $file = Join-Path $RegistryDir "$Text.json"

    if (-not (Test-Path $file)) {
      $match = $null
      $files = Get-ChildItem $RegistryDir -Filter *.json
      foreach ($f in $files) {
        $candidate = Read-JsonFile $f.FullName
        if ($candidate.displayName -eq $Text) {
          $match = $candidate
          break
        }
      }

      if ($match) {
        $client = $match
      } else {
        Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
        exit 1
      }
    } else {
      $client = Read-JsonFile $file
    }
    $exportDir = Get-ProntaraExportsRoot -Root $Root
    New-Item -ItemType Directory -Force $exportDir | Out-Null
    $exportPath = Join-Path $exportDir "$($client.clientId).txt"

    $lines = @()
    $lines += "Cliente: $($client.displayName)"
    $lines += "ID: $($client.clientId)"
    $lines += "Estado: $($client.status)"
    $lines += "Sector: $($client.sector)"
    $lines += "Version: $($client.version)"
    $lines += "Runtime: $($client.runtime)"
    $lines += "Desktop: $($client.desktop)"
    $lines += "Backend: $($client.backend)"
    $lines += "Instancia: $($client.instancePath)"
    $lines += "Creado: $($client.createdAt)"
    $lines += "Módulos: $($client.modules -join ', ')"

    if ($client.sampleData) {
      $sampleProps = $client.sampleData.PSObject.Properties
      if ($sampleProps.Count -gt 0) {
        $lines += ""
        $lines += "Datos de ejemplo:"
        foreach ($p in $sampleProps) {
          $count = @($p.Value).Count
          $lines += "  $($p.Name): $count"
        }
      }
    }

    if ($client.updates -and $client.updates.Count -gt 0) {
      $lines += ""
      $lines += "Últimos cambios:"
      foreach ($u in @($client.updates) | Select-Object -Last 10) {
        $lines += "  [$($u.at)] $($u.text)"
      }
    }

    $lines | Set-Content -Encoding UTF8 $exportPath

    Write-Host ""
    Write-Host "Cliente exportado correctamente." -ForegroundColor Green
    Write-Host "Archivo: $exportPath"
    Write-Host ""
  }

"rename" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      Write-Host "Indica el clientId a renombrar." -ForegroundColor Yellow
      exit 1
    }
    if ([string]::IsNullOrWhiteSpace($Text2)) {
      Write-Host "Indica el nuevo nombre comercial." -ForegroundColor Yellow
      exit 1
    }

        $file = Join-Path $RegistryDir "$Text.json"

    if (-not (Test-Path $file)) {
      $match = $null
      $files = Get-ChildItem $RegistryDir -Filter *.json
      foreach ($f in $files) {
        $candidate = Read-JsonFile $f.FullName
        if ($candidate.displayName -eq $Text) {
          $match = $candidate
          break
        }
      }

      if ($match) {
        $client = $match
      } else {
        Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
        exit 1
      }
    } else {
      $client = Read-JsonFile $file
    }
    $client.displayName = $Text2
    $client.status = "renamed"

    Save-Client $client $file

    Write-Host ""
    Write-Host "Cliente renombrado correctamente." -ForegroundColor Green
    Write-Host "ID: $Text"
    Write-Host "Nuevo nombre: $Text2"
    Write-Host ""

    Run-Generator $resolvedId
  }

"current" {
    $current = Get-CurrentClientId
    if ($current) {
      Write-Host ""
      Write-Host "Cliente activo: $current" -ForegroundColor Green
      Write-Host ""
    } else {
      Write-Host "No hay cliente activo." -ForegroundColor Yellow
    }
  }

  "status" {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      $Text = Get-CurrentClientId
      if ([string]::IsNullOrWhiteSpace($Text)) {
        Write-Host "No hay cliente activo y no has indicado un clientId." -ForegroundColor Yellow
        exit 1
      }
    }
        $file = Join-Path $RegistryDir "$Text.json"

    if (-not (Test-Path $file)) {
      $match = $null
      $files = Get-ChildItem $RegistryDir -Filter *.json
      foreach ($f in $files) {
        $candidate = Read-JsonFile $f.FullName
        if ($candidate.displayName -eq $Text) {
          $match = $candidate
          break
        }
      }

      if ($match) {
        $client = $match
      } else {
        Write-Host "No existe ese cliente: $Text" -ForegroundColor Red
        exit 1
      }
    } else {
      $client = Read-JsonFile $file
    }

    Write-Host ""
    Write-Host "Cliente: $($client.displayName)" -ForegroundColor Green
    Write-Host "ID: $($client.clientId)"
    Write-Host "Estado: $($client.status)"
    Write-Host "Sector: $($client.sector)"
    if ($client.PSObject.Properties.Name -contains "businessType") {
      Write-Host "BusinessType: $($client.businessType)"
    }
    if ($client.PSObject.Properties.Name -contains "blueprintVersion") {
      Write-Host "BlueprintVersion: $($client.blueprintVersion)"
    }
    Write-Host "Versión: $($client.version)"
    Write-Host "Runtime: $($client.runtime)"
    Write-Host "Desktop: $($client.desktop)"
    Write-Host "Backend: $($client.backend)"
    Write-Host "Instancia: $($client.instancePath)"
    Write-Host "Creado: $($client.createdAt)"
    Write-Host "Módulos: $($client.modules -join ', ')"

    if ($client.renameMap) {
      $renameProps = $client.renameMap.PSObject.Properties
      if ($renameProps.Count -gt 0) {
        Write-Host "Renombres:"
        foreach ($p in $renameProps) {
          Write-Host "  $($p.Name) -> $($p.Value)"
        }
      }
    }

    if ($client.sampleData) {
      $sampleProps = $client.sampleData.PSObject.Properties
      if ($sampleProps.Count -gt 0) {
        Write-Host "Datos de ejemplo:"
        foreach ($p in $sampleProps) {
          $count = @($p.Value).Count
          Write-Host "  $($p.Name): $count"
        }
      }
    }

    if ($client.updates -and $client.updates.Count -gt 0) {
      Write-Host "Últimos cambios:"
      $recent = @($client.updates) | Select-Object -Last 5
      foreach ($u in $recent) {
        Write-Host "  $u"
      }
    }

    Write-Host ""
  }

  "clients" {
    Write-Host ""
    $files = Get-ChildItem $RegistryDir -Filter *.json | Sort-Object LastWriteTime
    foreach ($f in $files) {
      $client = Read-JsonFile $f.FullName
      $marker = " "
      $active = Get-CurrentClientId
      if ($active -eq $client.clientId) { $marker = "*" }
      Write-Host "$marker $($client.clientId) | $($client.displayName) | $($client.sector) | $($client.status)"
    }
    Write-Host ""
  }

  "dev" {
    $active = Get-CurrentClientId
    if ($active) {
      Run-Generator $active
      Write-Host ""
      Write-Host "Arrancando cliente activo: $active" -ForegroundColor Green
      Write-Host ""
    }
    pnpm dev
  }
}






























