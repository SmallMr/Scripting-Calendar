$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'Scripting-Calendar.scripting'
$files = @(
  'script.json',
  'index.tsx',
  'widget.tsx',
  'app_intents.tsx',
  'app/preferences.tsx',
  'core/calendar.ts',
  'core/holidays.ts',
  'core/monthState.ts',
  'core/settings.ts',
  'ui/calendarWidget.tsx',
  'ui/theme.ts',
  'vendor/solarlunar.js'
)

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open(
  $output,
  [System.IO.Compression.ZipArchiveMode]::Create
)

try {
  foreach ($relativePath in $files) {
    $source = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $source)) {
      throw "Missing package file: $relativePath"
    }
    $entryName = $relativePath.Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $source,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $archive.Dispose()
}

Write-Output ("Packaged {0} ({1} bytes)" -f $output, (Get-Item -LiteralPath $output).Length)
