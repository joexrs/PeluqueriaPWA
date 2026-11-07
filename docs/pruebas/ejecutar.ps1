# ejecutar.ps1 — Ejecuta la primera fase de carga con k6 (solo lectura).
#
# Uso:
#   ./ejecutar.ps1                 # usa "k6" del PATH (o la ruta por defecto de Windows)
#   ./ejecutar.ps1 -K6 "C:\ruta\k6.exe"
#
# Requiere las variables de entorno (definidas en tu sesión, NUNCA en archivos):
#   SUPABASE_URL, ANON_KEY, TEST_EMAIL, TEST_PASS
# Opcional:
#   $env:FECHA = "AAAA-MM-DD"      # fecha a consultar (por defecto: hoy)
#
# Salidas (en esta carpeta): base.json, normal.json, pico.json

param(
    [string]$K6 = "k6"
)

$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot

# ── 1. Validar variables de entorno ───────────────────────────────────────────
$requeridas = @("SUPABASE_URL", "ANON_KEY", "TEST_EMAIL", "TEST_PASS")
$faltantes = @()
foreach ($v in $requeridas) {
    if (-not [Environment]::GetEnvironmentVariable($v)) { $faltantes += $v }
}
if ($faltantes.Count -gt 0) {
    Write-Host "ERROR: faltan variables de entorno: $($faltantes -join ', ')" -ForegroundColor Red
    Write-Host "Defínelas primero. Ejemplo en PowerShell (sesión actual):" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_URL = ""'
    Write-Host '  $env:ANON_KEY     = ""'
    Write-Host '  $env:TEST_EMAIL   = ""'
    Write-Host '  $env:TEST_PASS    = ""'
    Pop-Location
    exit 1
}

# ── 2. Verificar k6 ───────────────────────────────────────────────────────────
if (-not (Get-Command $K6 -ErrorAction SilentlyContinue)) {
    # Fallback: ruta por defecto de la instalación con winget/MSI en Windows.
    $candidato = "C:\Program Files\k6\k6.exe"
    if (Test-Path $candidato) {
        $K6 = $candidato
        Write-Host "k6 no está en el PATH; se usará $candidato" -ForegroundColor Yellow
        Write-Host "(reinicia la terminal si quieres invocarlo como 'k6')" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: no se encontró k6 ('$K6'). Instálalo o pásalo con -K6 <ruta>." -ForegroundColor Red
        Write-Host "Instalación en Windows: winget install k6 --source winget   (o: choco install k6)" -ForegroundColor Yellow
        Pop-Location
        exit 1
    }
}

# ── 3. Definición de escenarios ───────────────────────────────────────────────
$escenarios = @(
    @{ nombre = "base";   vus = 1;  duracion = "1m"; salida = "base.json"   },
    @{ nombre = "normal"; vus = 10; duracion = "2m"; salida = "normal.json" },
    @{ nombre = "pico";   vus = 30; duracion = "2m"; salida = "pico.json"   }
)

foreach ($s in $escenarios) {
    Write-Host ""
    Write-Host "=== Escenario '$($s.nombre)': $($s.vus) VU(s) durante $($s.duracion) ===" -ForegroundColor Cyan
    & $K6 run `
        -e VUS=$($s.vus) `
        -e DURATION=$($s.duracion) `
        -e ESCENARIO=$($s.nombre) `
        -e FECHA=$($env:FECHA) `
        --summary-export $($s.salida) `
        carga.js

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Aviso: '$($s.nombre)' terminó con código $LASTEXITCODE (k6 devuelve !=0 si se supera algún umbral)." -ForegroundColor Yellow
    }
}

Pop-Location
Write-Host ""
Write-Host "Listo. Resúmenes generados en docs/pruebas: base.json, normal.json, pico.json" -ForegroundColor Green
Write-Host "Siguiente paso: python resumen.py" -ForegroundColor Green
