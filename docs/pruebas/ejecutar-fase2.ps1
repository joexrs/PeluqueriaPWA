# ejecutar-fase2.ps1 — Escalada de carga para la segunda fase (solo lectura).
#
# Uso:
#   ./ejecutar-fase2.ps1
#   ./ejecutar-fase2.ps1 -K6 "C:\ruta\k6.exe"
#
# Requiere SUPABASE_URL, ANON_KEY, TEST_EMAIL y TEST_PASS en el entorno.
# Esta fase tiene un tope fijo de 200 VUs; no lo aumentes sin revisar resultados.

param(
    [string]$K6 = "k6"
)

$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot

$requeridas = @("SUPABASE_URL", "ANON_KEY", "TEST_EMAIL", "TEST_PASS")
$faltantes = @()
foreach ($v in $requeridas) {
    if (-not [Environment]::GetEnvironmentVariable($v)) { $faltantes += $v }
}
if ($faltantes.Count -gt 0) {
    Write-Host "ERROR: faltan variables de entorno: $($faltantes -join ', ')" -ForegroundColor Red
    Write-Host "Defínelas en esta sesión de PowerShell; no las guardes en archivos."
    Pop-Location
    exit 1
}

if (-not (Get-Command $K6 -ErrorAction SilentlyContinue)) {
    $candidato = "C:\Program Files\k6\k6.exe"
    if (Test-Path $candidato) {
        $K6 = $candidato
        Write-Host "k6 no está en el PATH; se usará $candidato" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: no se encontró k6 ('$K6'). Instálalo o pásalo con -K6 <ruta>." -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

$escenarios = @(
    @{ nombre = "fase2_base";   vus = 10;  duracion = "1m"; salida = "fase2_base.json" },
    @{ nombre = "fase2_normal"; vus = 30;  duracion = "1m"; salida = "fase2_normal.json" },
    @{ nombre = "fase2_alto";   vus = 50;  duracion = "1m"; salida = "fase2_alto.json" },
    @{ nombre = "fase2_pico";   vus = 100; duracion = "1m"; salida = "fase2_pico.json" },
    @{ nombre = "fase2_estres"; vus = 150; duracion = "1m"; salida = "fase2_estres.json" },
    @{ nombre = "fase2_limite"; vus = 200; duracion = "1m"; salida = "fase2_limite.json" }
)

$ultimoCumplido = 0
$fallo = $false
foreach ($s in $escenarios) {
    Write-Host ""
    Write-Host "=== $($s.nombre): $($s.vus) VU(s) durante $($s.duracion) ===" -ForegroundColor Cyan
    & $K6 run `
        -e VUS=$($s.vus) `
        -e DURATION=$($s.duracion) `
        -e ESCENARIO=$($s.nombre) `
        -e FECHA=$($env:FECHA) `
        --summary-export $($s.salida) `
        carga.js

    if ($LASTEXITCODE -ne 0) {
        Write-Host "La prueba no cumplió los umbrales o no pudo ejecutarse. Se detiene la escalada." -ForegroundColor Yellow
        $fallo = $true
        break
    }
    $ultimoCumplido = $s.vus
}

Pop-Location
if ($fallo) {
    Write-Host "Último nivel que cumplió los umbrales: $ultimoCumplido VUs." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Máximo nivel validado en esta corrida: $ultimoCumplido VUs." -ForegroundColor Green
Write-Host "Consolida los resultados con: python resumen.py"
