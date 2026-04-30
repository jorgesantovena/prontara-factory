function Normalize-ProntaraBusinessText([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $value = $text.ToLowerInvariant().Trim()
  $value = $value.Normalize([Text.NormalizationForm]::FormD)
  $value = [regex]::Replace($value, '\p{Mn}', '')
  $value = [regex]::Replace($value, '\s+', ' ')
  return $value
}

function Resolve-ProntaraBusinessType([string]$text) {
  $normalized = Normalize-ProntaraBusinessText $text

  if ($normalized.Contains("taller de coches")) { return "taller-auto" }
  if ($normalized.Contains("taller mecanico")) { return "taller-auto" }
  if ($normalized.Contains("taller de vehiculos")) { return "taller-auto" }
  if ($normalized.Contains("mecanica")) { return "taller-auto" }
  if ($normalized.Contains("automocion")) { return "taller-auto" }
  if ($normalized.Contains("taller auto")) { return "taller-auto" }

  if ($normalized.Contains("software factory")) { return "software-factory" }
  if ($normalized.Contains("fabrica de software")) { return "software-factory" }
  if ($normalized.Contains("empresa de software")) { return "software-factory" }
  if ($normalized.Contains("empresa de desarrollo")) { return "software-factory" }
  if ($normalized.Contains("consultora de software")) { return "software-factory" }
  if ($normalized.Contains("desarrollo de software")) { return "software-factory" }
  if ($normalized.Contains("estudio de software")) { return "software-factory" }

  if ($normalized.Contains("clinica dental")) { return "clinica-dental" }
  if ($normalized.Contains("dentista")) { return "clinica-dental" }
  if ($normalized.Contains("dental")) { return "clinica-dental" }
  if ($normalized.Contains("odontologia")) { return "clinica-dental" }

  if ($normalized.Contains("panaderia")) { return "panaderia" }
  if ($normalized.Contains("obrador")) { return "panaderia" }
  if ($normalized.Contains("pasteleria")) { return "panaderia" }

  $registry = Get-ProntaraBusinessRegistry

  foreach ($item in $registry) {
    foreach ($alias in $item.Aliases) {
      $aliasNormalized = Normalize-ProntaraBusinessText $alias
      if (-not [string]::IsNullOrWhiteSpace($aliasNormalized)) {
        if ($normalized.Contains($aliasNormalized)) {
          return $item.Key
        }
      }
    }
  }

  return "general"
}