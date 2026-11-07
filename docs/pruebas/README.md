# Pruebas de capacidad y rendimiento — Agenda del día

Evidencia de la subcategoría **Gestión de capacidad y rendimiento** del proyecto
PeluqueríaPWA. Se evalúa **una** operación crítica en **solo lectura**: la
**consulta de la agenda del día** (`GET /rest/v1/Cita` con las relaciones que usa
la aplicación).

---

## 1. Ambiente

| Elemento | Valor |
|---|---|
| Frontend | React + TypeScript desplegado en Vercel |
| Backend | Supabase (PostgREST sobre PostgreSQL) |
| Operación evaluada | `obtenerCitas({ fecha: hoy })` → `GET /rest/v1/Cita` (solo lectura) |
| Origen de la consulta | [citasService.ts](file:///c:/Users/LEnovo/Downloads/PeluqueriaPWA/frontend/src/pages/citas/citasService.ts#L95-L171) y, como referencia de la agenda, [dashboardService.ts](file:///c:/Users/LEnovo/Downloads/PeluqueriaPWA/frontend/src/pages/dashboard/dashboardService.ts#L80-L139) |
| Máquina generadora de carga | Equipo local del estudiante (la latencia de red influye en los tiempos) |
| Plan de Supabase | Plan gratuito (recursos y límites compartidos) |

Consulta equivalente a la que hace la app (incluye las relaciones `Cliente`,
`Cita_Servicio`, `Servicio` y `Trabajador_Servicio/Usuario`):

```
GET /rest/v1/Cita
  ?select=*,Cliente:Cliente!FK_Cita_Cliente(ID,Nombre,Apellido,Telefono),
          servicios:Cita_Servicio(...,Servicio:Servicio(...),
          Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio(...))
  &fecha_cita=eq.<AAAA-MM-DD>
  &Estado_Cita=neq.CANCELADA
  &Estado_Cita=neq.NO_SHOW
  &order=fecha_cita.asc,hora_inicio.asc
```

---

## 2. Herramienta y versión

- **Herramienta:** [k6](https://k6.io/) (código abierto, de Grafana Labs).
- **Versión usada:** k6 **v2.3.0** en Windows (instalada en `C:\Program Files\k6\k6.exe`).
- En k6 v2 el `--summary-export` usa un formato plano (`metrics.<m>.<estadístico>` y
  `value` para las tasas); `resumen.py` contempla tanto ese formato como el anterior.
- **Instalación (Windows):**
  ```powershell
  winget install k6 --source winget
  # alternativa: choco install k6
  ```

---

## 3. Escenarios de carga

### Fase 1 (corrida registrada)

| Escenario | Usuarios virtuales (VUs) | Duración | Archivo de salida |
|---|---|---|---|
| `base`   | 1  | 1 min | `base.json`   |
| `normal` | 10 | 2 min | `normal.json` |
| `pico`   | 30 | 2 min | `pico.json`   |

### Fase 2 (ampliación pendiente de ejecutar)

| Escenario | Usuarios virtuales (VUs) | Duración | Archivo de salida |
|---|---:|---|---|
| `fase2_base` | 10 | 1 min | `fase2_base.json` |
| `fase2_normal` | 30 | 1 min | `fase2_normal.json` |
| `fase2_alto` | 50 | 1 min | `fase2_alto.json` |
| `fase2_pico` | 100 | 1 min | `fase2_pico.json` |
| `fase2_estres` | 150 | 1 min | `fase2_estres.json` |
| `fase2_limite` | 200 | 1 min | `fase2_limite.json` |

La fase 1 está comprobada hasta **30 usuarios virtuales**. La fase 2 escala en el
orden indicado y se detiene si k6 no puede ejecutar un nivel o si incumple un
umbral. **200 es el tope autorizado para esta fase**; no se probarán cargas mayores
sin revisar antes los resultados. El mayor nivel que complete la prueba cumpliendo
los criterios será el máximo validado de esta corrida, no el límite absoluto del
sistema.

- Ejecutor: `constant-vus` (carga constante).
- Cada VU hace una petición de solo lectura y espera `sleep(1)` entre iteraciones.
- La sesión (`login`) se crea **una sola vez** en `setup()`; todos los VUs reutilizan
  el mismo `access_token`.
- **Fecha consultada en la corrida registrada:** `2026-10-21` (la única con más de
  una cita en la base de prueba: 5 citas). Por defecto el script consulta "hoy", pero
  ese día no había citas y la medición habría sido una consulta vacía. Se puede fijar
  con `$env:FECHA = "AAAA-MM-DD"`.

---

## 4. Métricas registradas

| Métrica | Descripción |
|---|---|
| `http_req_duration` | Latencia de la petición (avg, p(95), máx) |
| `http_req_failed` | Tasa de errores HTTP |
| `http_reqs` | Solicitudes por segundo (throughput) |
| `checks` | Resultado de las validaciones (`status 200` y arreglo JSON) |
| `agenda_filas` | Informativa: nº de citas devueltas por la agenda (confirma que la consulta trae datos) |

---

## 5. Criterios de aceptación (umbrales)

| Criterio | Umbral | Estado |
|---|---|---|
| p(95) de latencia | `< 1500 ms` | **Cumple** (base 179.3 / normal 148.7 / pico 153.9 ms) |
| Tasa de errores | `< 1 %` | **Cumple** (0 % en los 3 escenarios) |
| Validaciones (`checks`) | `> 99 %` | **Cumple** (100 % en los 3 escenarios) |

Estos umbrales están definidos en `options.thresholds` dentro de
[carga.js](file:///c:/Users/LEnovo/Downloads/PeluqueriaPWA/docs/pruebas/carga.js).
Los resultados consolidados de los escenarios ejecutados quedan en `resultados.csv`
y `grafico.png`.

---

## 6. Cómo reproducir la prueba

**Requisitos:** k6 instalado, Python 3 (`matplotlib` opcional para el gráfico) y un
usuario con rol **recepcionista** en Supabase.

### 6.1 Definir variables de entorno (sesión actual de PowerShell)

> No escribas credenciales en archivos ni en el repositorio.

```powershell
$env:SUPABASE_URL = "https://TU-PROYECTO.supabase.co"
$env:ANON_KEY     = "<anon key de tu proyecto>"     # NUNCA la service_role
$env:TEST_EMAIL   = "recepcionista@tu-dominio.com"
$env:TEST_PASS    = "<contraseña del usuario recepcionista>"
```

### 6.2 Ejecutar los escenarios progresivos

```powershell
cd docs/pruebas
./ejecutar.ps1
```

La primera fase reproduce los niveles de 1, 10 y 30 usuarios virtuales.

Para ejecutar la segunda fase, con tope de 200:

```powershell
./ejecutar-fase2.ps1
```

La segunda fase genera un resumen JSON separado por nivel y se detiene en el
primer nivel que no cumpla los umbrales.

### 6.3 Consolidar resultados

```powershell
python resumen.py          # -> resultados.csv  y  grafico.png
pip install matplotlib     # solo si falta el gráfico
```

---

## 7. Limitaciones

- **Una sola sesión de usuario:** el `login` se realiza una vez en `setup()` y todos
  los VUs comparten el mismo token. No se mide el costo del login concurrente.
- **Red del equipo de prueba:** la latencia incluye la red del estudiante hacia
  Supabase; los valores absolutos pueden variar entre ejecuciones y ubicaciones.
- **Plan gratuito de Supabase:** recursos compartidos y limitados (CPU/RAM del
  proyecto, límites de conexiones y de peticiones). Los resultados no representan un
  plan de producción dedicado.
- **Datos poco representativos:** si el día consultado tiene pocas citas, el escaneo
  es pequeño y los tiempos serán optimistas. Verifica con la métrica `agenda_filas`.
- **Solo lectura:** la prueba no incluye creación/edición de citas ni pagos.

> Nota de seguridad: la petición usa la **anon key** + token del usuario
> autenticado. Si el rol *recepcionista* no tuviera política RLS de `SELECT` sobre
> `Cita`/`Cita_Servicio`/`Cliente`/`Servicio`, PostgREST devolvería `200` con un
> arreglo vacío (`[]`). Por eso `carga.js` registra `agenda_filas`: si el promedio es
> `0`, la prueba mide una consulta sin datos y debe revisarse la política antes de
> reportar los tiempos.
