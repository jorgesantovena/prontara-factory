[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RequirementsText,

    [string]$RequestedName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-ReqText([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) {
        return ""
    }

    $value = $text.ToLowerInvariant().Trim()
    $value = $value.Normalize([Text.NormalizationForm]::FormD)
    $value = [regex]::Replace($value, '\p{Mn}', '')
    $value = [regex]::Replace($value, '\s+', ' ')
    return $value
}

function Add-UniqueItems {
    param(
        [System.Collections.Generic.List[string]]$List,
        [string[]]$Items
    )

    foreach ($item in $Items) {
        if (-not [string]::IsNullOrWhiteSpace($item)) {
            if (-not $List.Contains($item)) {
                $List.Add($item)
            }
        }
    }
}

function Resolve-BusinessTypeFromRequirements([string]$normalizedText) {
    if ($normalizedText -match 'software factory|fabrica de software|empresa de software|desarrollo de software|consultora de software') {
        return "software-factory"
    }

    if ($normalizedText -match 'peluqueria|salon de belleza|barberia|barber shop|estetica capilar') {
        return "peluqueria"
    }

    if ($normalizedText -match 'tienda de deportes|tienda deportiva|material deportivo|articulos deportivos') {
        return "tienda-deportes"
    }

    if ($normalizedText -match 'despacho de abogados|bufete|abogados|asesoria juridica') {
        return "despacho-abogados"
    }

    if ($normalizedText -match 'clinica dental|dentista|odontologia|clinica') {
        return "clinica-dental"
    }

    if ($normalizedText -match 'panaderia|obrador|pasteleria') {
        return "panaderia"
    }

    if ($normalizedText -match 'taller de coches|taller mecanico|automocion|taller auto') {
        return "taller-auto"
    }

    return "general"
}

function Resolve-DisplayName([string]$businessType, [string]$requestedName) {
    if (-not [string]::IsNullOrWhiteSpace($requestedName)) {
        return $requestedName.Trim()
    }

    switch ($businessType) {
        "software-factory"   { return "Prontara Software Factory" }
        "peluqueria"         { return "Prontara Peluquería" }
        "tienda-deportes"    { return "Prontara Tienda Deportes" }
        "despacho-abogados"  { return "Prontara Despacho Abogados" }
        "clinica-dental"     { return "Prontara Clínica" }
        "panaderia"          { return "Prontara Panadería" }
        "taller-auto"        { return "Prontara Taller Auto" }
        default              { return "Prontara ERP" }
    }
}

function Resolve-CompanySize([string]$normalizedText) {
    if ($normalizedText -match '5 a 20 empleados|5-20 empleados|entre 5 y 20 empleados') {
        return "5-20"
    }

    if ($normalizedText -match '1 a 3 empleados|1-3 empleados|entre 1 y 3 empleados') {
        return "1-3"
    }

    if ($normalizedText -match '4 a 10 empleados|4-10 empleados|entre 4 y 10 empleados') {
        return "4-10"
    }

    if ($normalizedText -match '10 a 50 empleados|10-50 empleados|entre 10 y 50 empleados') {
        return "10-50"
    }

    return ""
}

function Resolve-BaseModules([string]$businessType) {
    switch ($businessType) {
        "software-factory" {
            return @(
                "clientes",
                "crm",
                "presupuestos",
                "proyectos",
                "timesheets",
                "planificacion_recursos",
                "facturacion",
                "finanzas",
                "rrhh",
                "documentos",
                "ajustes"
            )
        }

        "peluqueria" {
            return @(
                "clientes",
                "citas",
                "ventas",
                "facturacion",
                "caja",
                "empleados",
                "servicios",
                "productos",
                "documentos",
                "ajustes"
            )
        }

        "tienda-deportes" {
            return @(
                "clientes",
                "productos",
                "ventas",
                "compras",
                "almacen",
                "proveedores",
                "facturacion",
                "documentos",
                "ajustes"
            )
        }

        "despacho-abogados" {
            return @(
                "clientes",
                "expedientes",
                "actuaciones",
                "agenda",
                "timesheets",
                "facturacion",
                "documentos",
                "rrhh",
                "ajustes"
            )
        }

        default {
            return @(
                "clientes",
                "ventas",
                "facturacion",
                "documentos",
                "ajustes"
            )
        }
    }
}

function Resolve-BaseEntities([string]$businessType) {
    switch ($businessType) {
        "software-factory" {
            return @(
                "clientes",
                "leads",
                "oportunidades",
                "propuestas",
                "proyectos",
                "fases",
                "hitos",
                "tareas",
                "horas",
                "facturas",
                "gastos",
                "empleados",
                "tickets"
            )
        }

        "peluqueria" {
            return @(
                "clientes",
                "citas",
                "empleados",
                "servicios",
                "bonos",
                "ventas",
                "productos",
                "caja"
            )
        }

        "tienda-deportes" {
            return @(
                "clientes",
                "productos",
                "categorias",
                "tallas",
                "stock",
                "ventas",
                "compras",
                "proveedores"
            )
        }

        "despacho-abogados" {
            return @(
                "clientes",
                "expedientes",
                "actuaciones",
                "tiempos",
                "minutas",
                "facturas",
                "documentos",
                "agenda"
            )
        }

        default {
            return @(
                "clientes",
                "ventas",
                "facturas",
                "documentos"
            )
        }
    }
}

function Resolve-BaseWorkflows([string]$businessType) {
    switch ($businessType) {
        "software-factory" {
            return @(
                "oportunidad-a-propuesta",
                "propuesta-a-proyecto",
                "proyecto-a-imputacion",
                "horas-a-factura",
                "factura-a-margen"
            )
        }

        "peluqueria" {
            return @(
                "cita-a-servicio",
                "servicio-a-cobro",
                "venta-de-producto",
                "gestion-de-bonos"
            )
        }

        "tienda-deportes" {
            return @(
                "compra-a-stock",
                "stock-a-venta",
                "venta-a-factura"
            )
        }

        "despacho-abogados" {
            return @(
                "cliente-a-expediente",
                "expediente-a-actuacion",
                "tiempo-a-minuta",
                "minuta-a-factura"
            )
        }

        default {
            return @(
                "venta-a-factura"
            )
        }
    }
}

function Resolve-ModuleSignals([string]$normalizedText) {
    $core = New-Object System.Collections.Generic.List[string]
    $optional = New-Object System.Collections.Generic.List[string]
    $entities = New-Object System.Collections.Generic.List[string]
    $workflows = New-Object System.Collections.Generic.List[string]
    $reporting = New-Object System.Collections.Generic.List[string]
    $notes = New-Object System.Collections.Generic.List[string]

    if ($normalizedText -match 'crm|leads|oportunidades|pipeline comercial|pipeline') {
        Add-UniqueItems $core @("crm")
        Add-UniqueItems $entities @("leads","oportunidades")
        Add-UniqueItems $reporting @("pipeline-comercial")
    }

    if ($normalizedText -match 'presupuestos|cotizaciones|propuestas') {
        Add-UniqueItems $core @("presupuestos")
        Add-UniqueItems $entities @("propuestas","presupuestos")
        Add-UniqueItems $workflows @("presupuesto-a-proyecto")
    }

    if ($normalizedText -match 'proyectos|fases|hitos|sprints|entregables') {
        Add-UniqueItems $core @("proyectos")
        Add-UniqueItems $entities @("proyectos","fases","hitos","sprints")
    }

    if ($normalizedText -match 'timesheets|imputacion de horas|imputacion|horas facturables|horas no facturables') {
        Add-UniqueItems $core @("timesheets")
        Add-UniqueItems $entities @("horas","imputaciones")
        Add-UniqueItems $workflows @("registro-y-aprobacion-de-horas")
        Add-UniqueItems $reporting @("horas-imputadas")
    }

    if ($normalizedText -match 'planificacion y asignacion de recursos|planificacion de recursos|staffing|capacidad|disponible|carga de trabajo') {
        Add-UniqueItems $core @("planificacion_recursos")
        Add-UniqueItems $entities @("recursos","capacidades","asignaciones")
        Add-UniqueItems $reporting @("utilizacion-del-equipo")
    }

    if ($normalizedText -match 'contratos|bolsas de horas|sla|renovaciones|contrato marco') {
        Add-UniqueItems $optional @("contratos")
        Add-UniqueItems $entities @("contratos")
    }

    if ($normalizedText -match 'facturacion|facturas|suscripciones|rectificativas|notas de credito') {
        Add-UniqueItems $core @("facturacion")
        Add-UniqueItems $entities @("facturas","abonos")
        Add-UniqueItems $workflows @("facturacion")
        Add-UniqueItems $reporting @("facturacion-mensual")
    }

    if ($normalizedText -match 'finanzas|tesoreria|cuentas a cobrar|cuentas a pagar|prevision de caja|margenes|centros de coste') {
        Add-UniqueItems $core @("finanzas")
        Add-UniqueItems $entities @("cobros","pagos","gastos","tesoreria")
        Add-UniqueItems $reporting @("prevision-de-caja","margen-por-proyecto","cobros-pendientes")
    }

    if ($normalizedText -match 'compras|proveedores|freelancers|partners|ordenes de compra') {
        Add-UniqueItems $optional @("compras","proveedores")
        Add-UniqueItems $entities @("proveedores","compras")
    }

    if ($normalizedText -match 'rr\.?\s*hh|rrhh|empleados|vacaciones|ausencias|costes salariales|documentos laborales') {
        Add-UniqueItems $core @("rrhh")
        Add-UniqueItems $entities @("empleados","ausencias","vacaciones")
    }

    if ($normalizedText -match 'tickets|incidencias|mesa de ayuda|soporte|base de conocimiento') {
        Add-UniqueItems $optional @("soporte")
        Add-UniqueItems $entities @("tickets","incidencias")
        Add-UniqueItems $workflows @("gestion-de-soporte")
        Add-UniqueItems $reporting @("tickets-y-sla")
    }

    if ($normalizedText -match 'documentacion|contratos|anexos|facturas|actas|repositorio administrativo') {
        Add-UniqueItems $core @("documentos")
        Add-UniqueItems $entities @("documentos")
    }

    if ($normalizedText -match 'dashboard|reporting|proyectos en riesgo|cobros pendientes|utilizacion del equipo') {
        Add-UniqueItems $optional @("reporting")
        Add-UniqueItems $reporting @(
            "pipeline-comercial",
            "facturacion-mensual",
            "utilizacion-del-equipo",
            "proyectos-en-riesgo",
            "cobros-pendientes"
        )
    }

    if ($normalizedText -match 'mvp') {
        Add-UniqueItems $notes @("El texto incluye una priorizacion tipo MVP.")
    }

    if ($normalizedText -match 'segunda fase|fase 2') {
        Add-UniqueItems $notes @("El texto incluye una segunda fase funcional.")
    }

    return [pscustomobject]@{
        CoreModules     = @($core)
        OptionalModules = @($optional)
        Entities        = @($entities)
        Workflows       = @($workflows)
        ReportingNeeds  = @($reporting)
        Notes           = @($notes)
    }
}

$normalized = Normalize-ReqText $RequirementsText
$businessType = Resolve-BusinessTypeFromRequirements $normalized
$displayName = Resolve-DisplayName $businessType $RequestedName
$companySize = Resolve-CompanySize $normalized

$coreModules = New-Object System.Collections.Generic.List[string]
$optionalModules = New-Object System.Collections.Generic.List[string]
$entities = New-Object System.Collections.Generic.List[string]
$workflows = New-Object System.Collections.Generic.List[string]
$reportingNeeds = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]
$coreFlow = New-Object System.Collections.Generic.List[string]

Add-UniqueItems $coreModules (Resolve-BaseModules $businessType)
Add-UniqueItems $entities (Resolve-BaseEntities $businessType)
Add-UniqueItems $workflows (Resolve-BaseWorkflows $businessType)

$signals = Resolve-ModuleSignals $normalized

Add-UniqueItems $coreModules $signals.CoreModules
Add-UniqueItems $optionalModules $signals.OptionalModules
Add-UniqueItems $entities $signals.Entities
Add-UniqueItems $workflows $signals.Workflows
Add-UniqueItems $reportingNeeds $signals.ReportingNeeds
Add-UniqueItems $notes $signals.Notes

if ($businessType -eq "software-factory") {
    Add-UniqueItems $coreFlow @("oportunidad","propuesta","proyecto","horas","factura","margen")
}
elseif ($businessType -eq "despacho-abogados") {
    Add-UniqueItems $coreFlow @("cliente","expediente","actuacion","tiempo","minuta","factura")
}
elseif ($businessType -eq "peluqueria") {
    Add-UniqueItems $coreFlow @("cita","servicio","cobro")
}
elseif ($businessType -eq "tienda-deportes") {
    Add-UniqueItems $coreFlow @("compra","stock","venta","factura")
}

$blueprint = [pscustomobject]@{
    businessType     = $businessType
    displayName      = $displayName
    blueprintVersion = "0.1.0"
    companyProfile   = [pscustomobject]@{
        size = $companySize
    }
    branding         = [pscustomobject]@{
        appName  = $displayName
        logoText = $displayName
    }
    coreFlow         = @($coreFlow)
    coreModules      = @($coreModules)
    optionalModules  = @($optionalModules)
    entities         = @($entities)
    workflows        = @($workflows)
    reportingNeeds   = @($reportingNeeds)
    notes            = @($notes)
    sourceText       = $RequirementsText
}

$blueprint | ConvertTo-Json -Depth 30
