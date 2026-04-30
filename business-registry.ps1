# -----------------------------------------------------------------------------
# DEPRECATED (F-09) — este script se conserva solo para compatibilidad.
# Reemplazo canónico:
#   node scripts/ts/prontara.mjs list-business
# Implementación de referencia: scripts/ts/business-registry.mjs
# Ver docs/scripts-migration-plan.md para el plan de jubilación.
# -----------------------------------------------------------------------------
function Get-ProntaraBusinessRegistry {
  return @(
    @{
      Key = "general"
      Name = "ERP General"
      LegacySector = "estandar"
      SuggestedName = "Prontara ERP"
      Aliases = @(
        "erp",
        "empresa",
        "negocio",
        "pyme",
        "gestion",
        "gestión"
      )
      Modules = @(
        "clientes",
        "ventas",
        "facturacion",
        "ajustes"
      )
    },
    @{
      Key = "clinica-dental"
      Name = ("Cl{0}nica Dental" -f [char]0x00ED)
      LegacySector = "clinica"
      SuggestedName = ("Prontara Cl{0}nica" -f [char]0x00ED)
      Aliases = @(
        "clinica dental",
        ("cl{0}nica dental" -f [char]0x00ED),
        "dentista",
        "dental",
        "odontologia",
        ("odontolog{0}a" -f [char]0x00ED)
      )
      Modules = @(
        "clientes",
        "citas",
        "documentos",
        "facturacion",
        "ajustes"
      )
    },
    @{
      Key = "software-factory"
      Name = "Software Factory"
      LegacySector = "estandar"
      SuggestedName = "Prontara Software Factory"
      Aliases = @(
        "software factory",
        "fabrica de software",
        "fábrica de software",
        "empresa de software",
        "empresa de desarrollo",
        "consultora de software",
        "desarrollo de software",
        "estudio de software"
      )
      Modules = @(
        "clientes",
        "ventas",
        "facturacion",
        "ajustes",
        "documentos",
        "proyectos",
        "tareas"
      )
    },
    @{
      Key = "taller-auto"
      Name = "Taller Auto"
      LegacySector = "taller-auto"
      SuggestedName = "Prontara Taller Auto"
      Aliases = @(
        "taller de coches",
        "taller mecanico",
        "taller mecánico",
        "taller de vehiculos",
        "taller de vehículos",
        "mecanica",
        "mecánica",
        "automocion",
        "automoción",
        "taller auto"
      )
      Modules = @(
        "clientes",
        "vehiculos",
        "ordenes_trabajo",
        "citas",
        "facturacion",
        "cobros",
        "ajustes"
      )
    },
    @{
      Key = "panaderia"
      Name = ("Panader{0}a" -f [char]0x00ED)
      LegacySector = "panaderia"
      SuggestedName = ("Prontara Panader{0}a" -f [char]0x00ED)
      Aliases = @(
        "panaderia",
        ("panader{0}a" -f [char]0x00ED),
        "obrador",
        "pasteleria",
        ("pasteler{0}a" -f [char]0x00ED)
      )
      Modules = @(
        "productos",
        "compras",
        "ventas",
        "pedidos",
        "almacen",
        "facturacion",
        "ajustes"
      )
    },
    @{
      Key = "gimnasio"
      Name = "Gimnasio"
      LegacySector = "gimnasio"
      SuggestedName = "Prontara Gym"
      Aliases = @(
        "gimnasio",
        "gym",
        "centro deportivo",
        "fitness",
        "box",
        "estudio de fitness",
        "crossfit"
      )
      Modules = @(
        "clientes",
        "crm",
        "proyectos",
        "presupuestos",
        "facturacion",
        "documentos",
        "ajustes"
      )
    },
    @{
      Key = "peluqueria"
      Name = ("Peluquer{0}a" -f [char]0x00ED)
      LegacySector = "peluqueria"
      SuggestedName = ("Prontara Sal{0}n" -f [char]0x00F3)
      Aliases = @(
        "peluqueria",
        ("peluquer{0}a" -f [char]0x00ED),
        "peluquero",
        "peluquera",
        "barberia",
        ("barber{0}a" -f [char]0x00ED),
        "barber shop",
        ("sal{0}n de belleza" -f [char]0x00F3),
        "salon de belleza",
        ("est{0}tica" -f [char]0x00E9),
        "estetica"
      )
      Modules = @(
        "clientes",
        "crm",
        "proyectos",
        "presupuestos",
        "facturacion",
        "documentos",
        "ajustes"
      )
    },
    @{
      Key = "colegio"
      Name = "Colegio"
      LegacySector = "colegio"
      SuggestedName = "Prontara Educa"
      Aliases = @(
        "colegio",
        "escuela",
        "centro educativo",
        ("centro de ense{0}anza" -f [char]0x00F1),
        "academia",
        "instituto",
        "guarderia",
        ("guarder{0}a" -f [char]0x00ED)
      )
      Modules = @(
        "clientes",
        "crm",
        "proyectos",
        "presupuestos",
        "facturacion",
        "documentos",
        "ajustes"
      )
    }
  )
}

function Get-ProntaraBusinessByKey([string]$key) {
  $registry = Get-ProntaraBusinessRegistry
  foreach ($item in $registry) {
    if ($item.Key -eq $key) {
      return $item
    }
  }
  return $null
}