function Normalize-ProntaraModuleText([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $value = $text.ToLowerInvariant().Trim()
  $value = $value.Replace("?","a").Replace("?","e").Replace("?","i").Replace("?","o").Replace("?","u").Replace("?","u").Replace("?","n")
  $value = [regex]::Replace($value, "\s+", " ")
  return $value
}

function Resolve-ProntaraExplicitModules([string]$text) {
  $normalized = Normalize-ProntaraModuleText $text
  $modules = New-Object System.Collections.Generic.List[string]

  $map = [ordered]@{
    "clientes" = @("clientes","cliente","pacientes","paciente")
    "proveedores" = @("proveedores","proveedor")
    "productos" = @("productos","producto","articulos","articulo","catalogo")
    "compras" = @("compras","aprovisionamiento")
    "ventas" = @("ventas","comercial")
    "pedidos" = @("pedidos","encargos")
    "facturacion" = @("facturacion","factura","facturas")
    "almacen" = @("almacen","stock","inventario")
    "taller" = @("taller","reparaciones","mantenimiento","servicio tecnico")
    "ordenes_trabajo" = @("ordenes de trabajo","orden de trabajo","ordenes de servicio","partes de trabajo","intervenciones")
    "vehiculos" = @("vehiculos","coches","automoviles")
    "embarcaciones" = @("embarcaciones","barcos","yates")
    "citas" = @("citas","agenda","reservas","turnos")
    "documentos" = @("documentos","archivos","consentimientos")
    "crm" = @("crm","oportunidades","pipeline")
    "proyectos" = @("proyectos","proyecto","project","projects")
    "tareas" = @("tareas","tarea","task","tasks")
    "web" = @("web","pagina web","sitio web")
    "ajustes" = @("ajustes","configuracion")
    "presupuestos" = @("presupuestos","presupuesto")
    "cobros" = @("cobros","cobro","pagos recibidos","pago recibido")
    "pagos" = @("pagos","pago","pagos emitidos","pago emitido")
    "tesoreria" = @("tesoreria","movimientos de tesoreria")
  }

  foreach ($key in $map.Keys) {
    foreach ($alias in $map[$key]) {
      if ($normalized.Contains($alias)) {
        if (-not $modules.Contains($key)) {
          $modules.Add($key)
        }
      }
    }
  }

  return @($modules)
}

function Merge-ProntaraModules([object[]]$baseModules, [object[]]$extraModules) {
  $all = New-Object System.Collections.Generic.List[string]

  foreach ($m in $baseModules) {
    if (-not [string]::IsNullOrWhiteSpace($m) -and -not $all.Contains([string]$m)) {
      $all.Add([string]$m)
    }
  }

  foreach ($m in $extraModules) {
    if (-not [string]::IsNullOrWhiteSpace($m) -and -not $all.Contains([string]$m)) {
      $all.Add([string]$m)
    }
  }

  return @($all)
}


