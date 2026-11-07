#!/usr/bin/env python3
"""
resumen.py — Consolida los resúmenes JSON de k6 (fase 1 y fase 2) y genera:
  - resultados.csv : tabla lista para el informe.
  - grafico.png    : p(95) y promedio por escenario (requiere matplotlib).

Uso:
  python resumen.py

Si matplotlib no está instalado, igualmente se genera el CSV:
  pip install matplotlib
"""

import csv
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Los escenarios no ejecutados se omiten.
ESCENARIOS = [
    ("base",   1,  "base.json"),
    ("normal", 10, "normal.json"),
    ("pico",   30, "pico.json"),
    ("fase2_base", 10, "fase2_base.json"),
    ("fase2_normal", 30, "fase2_normal.json"),
    ("fase2_alto", 50, "fase2_alto.json"),
    ("fase2_pico", 100, "fase2_pico.json"),
    ("fase2_estres", 150, "fase2_estres.json"),
    ("fase2_limite", 200, "fase2_limite.json"),
]


def leer_metricas(ruta: Path) -> dict:
    with ruta.open(encoding="utf-8") as f:
        datos = json.load(f)
    return datos.get("metrics", {})


def valor(metricas: dict, nombre: str, claves):
    """Lee metrics[nombre].values[<clave>] de forma tolerante a variantes de k6.

    k6 antiguo:    metrics[m].values.<clave>
    k6 v1.5+/v2:   metrics[m].<clave>   (las tasas usan 'value' en vez de 'rate')
    """
    metrica = metricas.get(nombre)
    if not metrica:
        return None
    valores = metrica.get("values", metrica)
    for clave in claves:
        if clave in valores:
            return valores[clave]
    return None


def main() -> int:
    filas = []
    faltantes = []

    for escenario, vus, archivo in ESCENARIOS:
        ruta = BASE_DIR / archivo
        if not ruta.exists():
            faltantes.append(archivo)
            continue

        m = leer_metricas(ruta)

        avg = valor(m, "http_req_duration", ("avg",))
        p95 = valor(m, "http_req_duration", ("p(95)",))
        maximo = valor(m, "http_req_duration", ("max",))
        error_rate = valor(m, "http_req_failed", ("value", "rate"))
        rps = valor(m, "http_reqs", ("rate",))

        filas.append({
            "escenario": escenario,
            "vus": vus,
            "avg_ms": round(avg, 2) if avg is not None else "",
            "p95_ms": round(p95, 2) if p95 is not None else "",
            "max_ms": round(maximo, 2) if maximo is not None else "",
            "tasa_errores_pct": round(error_rate * 100, 3) if error_rate is not None else "",
            "rps": round(rps, 2) if rps is not None else "",
        })

    if not filas:
        print("No se encontraron resúmenes JSON de k6. Ejecuta primero un script de prueba.")
        return 1

    if faltantes:
        print(f"Aviso: faltan resúmenes -> {', '.join(faltantes)}")

    # ── resultados.csv ────────────────────────────────────────────────────────
    csv_path = BASE_DIR / "resultados.csv"
    campos = ["escenario", "vus", "avg_ms", "p95_ms", "max_ms", "tasa_errores_pct", "rps"]
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=campos)
        writer.writeheader()
        writer.writerows(filas)
    print(f"CSV generado: {csv_path.name}")

    # ── grafico.png ───────────────────────────────────────────────────────────
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib no está instalado: no se generó grafico.png.")
        print("Instálalo con:  pip install matplotlib")
        return 0

    etiquetas = [f"{f['escenario']}\n({f['vus']} VU)" for f in filas]
    promedio = [f["avg_ms"] for f in filas]
    p95 = [f["p95_ms"] for f in filas]

    x = list(range(len(filas)))
    ancho = 0.38

    fig, ax = plt.subplots(figsize=(8, 5))
    b1 = ax.bar([i - ancho / 2 for i in x], promedio, ancho, label="Promedio")
    b2 = ax.bar([i + ancho / 2 for i in x], p95, ancho, label="p(95)")
    ax.axhline(1500, color="red", linestyle="--", linewidth=1,
               label="Umbral p(95) = 1500 ms")

    ax.set_title("Latencia de la agenda del día por escenario")
    ax.set_ylabel("Latencia (ms)")
    ax.set_xticks(x)
    ax.set_xticklabels(etiquetas)
    ax.legend()
    ax.bar_label(b1, fmt="%.0f ms", padding=2, fontsize=8)
    ax.bar_label(b2, fmt="%.0f ms", padding=2, fontsize=8)
    ax.grid(axis="y", alpha=0.3)

    fig.tight_layout()
    png_path = BASE_DIR / "grafico.png"
    fig.savefig(png_path, dpi=150)
    print(f"Gráfico generado: {png_path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
