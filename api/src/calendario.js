/**
 * Calendario escolar compartido: las fechas de cada semestre (tabla
 * configuracion, clave 'calendario') y el PDF oficial (bucket privado
 * "archivos" de Supabase Storage). Ver
 * supabase/migrations/20261125030000_calendario.sql.
 *
 * Se monta en /calendario (ver server.js). Todo pasa por requireAuth. El PDF nunca es público: el navegador lo pide
 * aquí con su sesión y la API lo saca de Storage con la llave service_role.
 */
import express, { Router } from 'express';
import { requireAuth } from './auth.js';
import { getSupabase } from './supabase.js';

export const calendarioRouter = Router();
calendarioRouter.use(requireAuth);

const CLAVE = 'calendario';
const BUCKET = 'archivos';
const RUTA_PDF = 'calendario/calendario.pdf';
/** Igual que el límite del bucket. */
const MAX_PDF = 20 * 1024 * 1024;
const FECHA_RE = /^(\d{4}-\d{2}-\d{2})?$/;
const CAMPOS_FECHA = ['periodoInicio', 'periodoFin', 'vacacionesInicio', 'vacacionesFin'];

function falloDeBase(res, error, contexto) {
  console.error(`${contexto}:`, error.code ?? error.statusCode ?? '', error.message);
  return res.status(503).json({ error: 'El servidor de datos no respondió. Intenta de nuevo.' });
}

async function leerCalendario() {
  const { data, error } = await getSupabase().from('configuracion').select('valor').eq('clave', CLAVE).maybeSingle();
  if (error) throw error;
  return data?.valor ?? null;
}

async function guardarCalendario(valor, email) {
  const { data, error } = await getSupabase()
    .from('configuracion')
    .upsert({ clave: CLAVE, valor, actualizado_en: new Date().toISOString(), actualizado_por: email })
    .select('valor')
    .single();
  if (error) throw error;
  return data.valor;
}

/**
 * Solo se aceptan los campos que usa el frontend, con fechas "AAAA-MM-DD"
 * (o vacías mientras se capturan). Devuelve null si la forma no es válida.
 */
function limpiarFechas(entrada) {
  if (!entrada || typeof entrada !== 'object' || !Array.isArray(entrada.semestres)) return null;
  if (entrada.semestres.length === 0 || entrada.semestres.length > 10) return null;

  const semestres = [];
  for (const s of entrada.semestres) {
    if (!s || typeof s.id !== 'string' || typeof s.nombre !== 'string') return null;
    const limpio = { id: s.id.slice(0, 20), nombre: s.nombre.slice(0, 200) };
    for (const campo of CAMPOS_FECHA) {
      const valor = s[campo] ?? '';
      if (typeof valor !== 'string' || !FECHA_RE.test(valor)) return null;
      limpio[campo] = valor;
    }
    semestres.push(limpio);
  }
  return { ciclo: String(entrada.ciclo ?? '').slice(0, 20), semestres };
}

calendarioRouter.get('/', async (_req, res) => {
  try {
    return res.json({ calendario: await leerCalendario() });
  } catch (error) {
    return falloDeBase(res, error, 'No se pudo leer el calendario');
  }
});

/** Guarda las fechas. Conserva los datos del PDF, que solo cambian al subir uno nuevo. */
calendarioRouter.put('/', async (req, res) => {
  const fechas = limpiarFechas(req.body?.calendario);
  if (!fechas) return res.status(400).json({ error: 'Las fechas del calendario no tienen el formato esperado.' });

  try {
    const anterior = (await leerCalendario()) ?? {};
    const valor = {
      ...fechas,
      pdfNombre: anterior.pdfNombre,
      pdfSubido: anterior.pdfSubido,
      actualizado: new Date().toISOString(),
    };
    return res.json({ calendario: await guardarCalendario(valor, req.user.email) });
  } catch (error) {
    return falloDeBase(res, error, 'No se pudo guardar el calendario');
  }
});

/**
 * Sube (o reemplaza) el PDF oficial. El cuerpo es el archivo tal cual
 * (Content-Type: application/pdf) y el nombre viaja en X-Nombre-Archivo,
 * codificado con encodeURIComponent.
 */
calendarioRouter.put(
  '/pdf',
  express.raw({ type: 'application/pdf', limit: MAX_PDF }),
  async (req, res) => {
    const archivo = req.body;
    // Todo PDF empieza con "%PDF"; así no se guarda cualquier cosa con la extensión cambiada.
    if (!Buffer.isBuffer(archivo) || archivo.length < 5 || archivo.subarray(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ error: 'El archivo no es un PDF válido.' });
    }

    let nombre = 'calendario.pdf';
    try {
      nombre = decodeURIComponent(req.get('X-Nombre-Archivo') ?? nombre).slice(0, 200) || nombre;
    } catch {
      // Nombre mal codificado: se queda el genérico.
    }

    const { error: errorSubida } = await getSupabase()
      .storage.from(BUCKET)
      .upload(RUTA_PDF, archivo, { contentType: 'application/pdf', upsert: true });
    if (errorSubida) return falloDeBase(res, errorSubida, 'No se pudo subir el PDF del calendario');

    try {
      const anterior = (await leerCalendario()) ?? {};
      const valor = { ...anterior, pdfNombre: nombre, pdfSubido: new Date().toISOString() };
      return res.json({ calendario: await guardarCalendario(valor, req.user.email) });
    } catch (error) {
      return falloDeBase(res, error, 'No se pudo registrar el PDF del calendario');
    }
  },
);

calendarioRouter.get('/pdf', async (_req, res) => {
  const { data, error } = await getSupabase().storage.from(BUCKET).download(RUTA_PDF);
  if (error) {
    // Storage responde 400/404 cuando el archivo todavía no existe.
    if ([400, 404].includes(Number(error.statusCode ?? error.status))) {
      return res.status(404).json({ error: 'Todavía no se ha subido el PDF del calendario.' });
    }
    return falloDeBase(res, error, 'No se pudo leer el PDF del calendario');
  }

  res.set('Content-Type', 'application/pdf');
  res.set('Cache-Control', 'private, no-store');
  return res.send(Buffer.from(await data.arrayBuffer()));
});
