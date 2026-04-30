function Clean-ProntaraBusinessName([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $value = $text.Trim()
  $value = $value -replace '^[\s"''`]+', ''
  $value = $value -replace '[\s"''`]+$', ''
  $value = $value -replace '\s+con\s+.+$', ''
  $value = $value -replace '\s+y\s+.+$', ''
  $value = $value.Trim()

  if ($value.Length -gt 80) {
    $value = $value.Substring(0,80).Trim()
  }

  return $value
}

function Resolve-ProntaraBusinessName([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $patterns = @(
    'llamad[oa]\s+(.+)$',
    'nombre\s+(.+)$'
  )

  foreach ($pattern in $patterns) {
    if ($text -match $pattern) {
      $candidate = Clean-ProntaraBusinessName $Matches[1]
      if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        return $candidate
      }
    }
  }

  return ""
}
