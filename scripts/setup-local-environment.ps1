$ErrorActionPreference = "Stop"

function New-RandomHex([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return ([BitConverter]::ToString($buffer) -replace "-", "").ToLowerInvariant()
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$dockerEnvPath = Join-Path $projectDirectory ".env.docker"
$appEnvPath = Join-Path $projectDirectory ".env"

if (Test-Path -LiteralPath $dockerEnvPath) {
  throw ".env.docker already exists. It was not overwritten."
}

$databasePassword = New-RandomHex 24
$authSecret = New-RandomHex 32

$dockerEnvironment = @(
  "POSTGRES_DB=arremataflow"
  "POSTGRES_USER=arremataflow_app"
  "POSTGRES_PASSWORD=$databasePassword"
) -join [Environment]::NewLine

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($dockerEnvPath, $dockerEnvironment + [Environment]::NewLine, $utf8WithoutBom)

$existingAppEnvironment = if (Test-Path -LiteralPath $appEnvPath) {
  Get-Content -LiteralPath $appEnvPath -Raw
} else {
  ""
}

$requiredValues = [ordered]@{
  "DATABASE_URL" = "postgresql://arremataflow_app:${databasePassword}@127.0.0.1:5432/arremataflow"
  "DATABASE_SSL" = "false"
  "BETTER_AUTH_SECRET" = $authSecret
  "BETTER_AUTH_URL" = "http://127.0.0.1:8081"
  "AUTH_ENFORCEMENT_ENABLED" = "true"
}

$linesToAppend = @()
foreach ($entry in $requiredValues.GetEnumerator()) {
  if ($existingAppEnvironment -notmatch "(?m)^$([Regex]::Escape($entry.Key))=") {
    $linesToAppend += "$($entry.Key)=$($entry.Value)"
  }
}

if ($linesToAppend.Count -gt 0) {
  $separator = if ($existingAppEnvironment.Length -gt 0 -and -not $existingAppEnvironment.EndsWith([Environment]::NewLine)) {
    [Environment]::NewLine
  } else {
    ""
  }
  [IO.File]::AppendAllText(
    $appEnvPath,
    $separator + ($linesToAppend -join [Environment]::NewLine) + [Environment]::NewLine,
    $utf8WithoutBom
  )
}

Write-Host "Local environment created. Secrets were written only to ignored .env files."
