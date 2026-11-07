/**
 * carga.js — Prueba de carga (SOLO LECTURA) de la operación crítica:
 * "agenda del día": GET /rest/v1/Cita con las mismas relaciones que consulta
 * la aplicación (frontend/src/pages/citas/citasService.ts -> obtenerCitas()).
 *
 * No escribe, modifica ni borra datos. No usa la service_role key.
 *
 * Escenarios (se inyectan desde ejecutar.ps1 mediante -e):
 *   base   -> 1  VU  durante 1m
 *   normal -> 10 VU  durante 2m
 *   pico   -> 30 VU  durante 2m
 *
 * Variables de entorno requeridas (NUNCA se escriben en el código):
 *   SUPABASE_URL, ANON_KEY, TEST_EMAIL, TEST_PASS
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// ── Configuración del escenario (inyectada por -e) ────────────────────────────
const VUS = Number(__ENV.VUS || 1);
const DURATION = __ENV.DURATION || '1m';
const ESCENARIO = __ENV.ESCENARIO || 'base';
// Fecha a consultar (AAAA-MM-DD). Si no se define, se usa "hoy" como la app.
const FECHA = __ENV.FECHA || '';

// ── Credenciales / endpoint (solo desde el entorno) ───────────────────────────
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASS = __ENV.TEST_PASS;

// Métrica informativa: filas devueltas por la agenda en cada iteración.
const filasAgenda = new Trend('agenda_filas');

// select equivalente al de la app (se omiten espacios, PostgREST los ignora).
const SELECT_AGENDA = [
  '*',
  'Cliente:Cliente!FK_Cita_Cliente(ID,Nombre,Apellido,Telefono)',
  'servicios:Cita_Servicio(ID,cita_id,servicio_id,trabajador_id,orden,Cantidad,' +
    'Servicio:Servicio(ID,Nombre,Precio,Duracion_minutos),' +
    'Trabajador:Trabajador_Servicio!FK_CitaServ_Trabajador_Servicio(' +
    'Usuario:Usuario!FK_TrabajadorServicio_Usuario(ID,Nombre,Apellido,Color_agenda)))',
].join(',');

export const options = {
  scenarios: {
    agenda_del_dia: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      gracefulStop: '10s',
    },
  },
  // Criterios de aceptación (umbrales)
  thresholds: {
    http_req_duration: ['p(95)<1500'], // p(95) < 1500 ms
    http_req_failed: ['rate<0.01'],    // tasa de errores < 1 %
    checks: ['rate>0.99'],             // todas las validaciones deben pasar
  },
};

export function setup() {
  if (!SUPABASE_URL || !ANON_KEY || !TEST_EMAIL || !TEST_PASS) {
    throw new Error(
      'Faltan variables de entorno. Define SUPABASE_URL, ANON_KEY, TEST_EMAIL y TEST_PASS.'
    );
  }

  // Login único contra Supabase Auth (password grant).
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    {
      headers: {
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
      },
      tags: { nombre: 'login_setup' },
    }
  );

  const loginOk = check(res, {
    'login responde 200': (r) => r.status === 200,
    'login devuelve access_token': (r) => {
      try {
        return !!r.json('access_token');
      } catch (e) {
        return false;
      }
    },
  });

  if (!loginOk) {
    throw new Error(
      `Login falló en setup() (status ${res.status}). Verifica TEST_EMAIL/TEST_PASS y ANON_KEY.`
    );
  }

  const token = res.json('access_token');
  // Si se definió FECHA se usa esa; si no, "hoy" como la app:
  // obtenerCitasDeHoy() -> new Date().toISOString().split('T')[0]
  const fecha = FECHA || new Date().toISOString().split('T')[0];
  console.log(`Agenda consultada: fecha=${fecha}`);

  return { token, fecha };
}

export default function (data) {
  const url =
    `${SUPABASE_URL}/rest/v1/Cita` +
    `?select=${encodeURIComponent(SELECT_AGENDA)}` +
    `&fecha_cita=eq.${data.fecha}` +
    `&Estado_Cita=neq.CANCELADA` +
    `&Estado_Cita=neq.NO_SHOW` +
    `&order=fecha_cita.asc,hora_inicio.asc`;

  const res = http.get(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${data.token}`,
      Accept: 'application/json',
    },
    tags: { operacion: 'agenda_dia', escenario: ESCENARIO },
  });

  check(res, {
    'agenda responde 200': (r) => r.status === 200,
    'agenda devuelve un arreglo': (r) => {
      try {
        return Array.isArray(r.json());
      } catch (e) {
        return false;
      }
    },
  });

  // Métrica informativa: número de citas devueltas para el día consultado.
  try {
    const filas = res.json();
    if (Array.isArray(filas)) {
      filasAgenda.add(filas.length);
    }
  } catch (e) {
    // Respuesta no JSON: se refleja en los checks anteriores.
  }

  sleep(1);
}
