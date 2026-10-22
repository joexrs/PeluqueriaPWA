param(
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    $OutputDir = Join-Path $localAppData "PeluqueriaPWA\backups"
}

if (-not $env:SUPABASE_DB_URL) {
    throw "Define SUPABASE_DB_URL con la connection string de PostgreSQL de Supabase antes de ejecutar este script."
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw "No encuentro Supabase CLI. Instálalo y vuelve a ejecutar el script."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $OutputDir $timestamp
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

supabase db dump --db-url $env:SUPABASE_DB_URL --file (Join-Path $backupPath "schema.sql")
if ($LASTEXITCODE -ne 0) { throw "Falló el backup del esquema." }

supabase db dump --db-url $env:SUPABASE_DB_URL --use-copy --data-only `
    --exclude "storage.buckets_vectors" --exclude "storage.vector_indexes" `
    --file (Join-Path $backupPath "data.sql")
if ($LASTEXITCODE -ne 0) { throw "Falló el backup de los datos." }

Write-Host "Backup listo: $backupPath"
