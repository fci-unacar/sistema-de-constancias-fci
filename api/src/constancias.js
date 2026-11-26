/**
 * Historial de constancias y catálogo de programas, en la base de datos.
 *
 * Todo pasa por requireAuth: son datos de alumnos. El folio lo asigna la
 * base (función registrar_constancia, ver
 * supabase/migrations/20261125010000_funciones_api.sql), no el navegador,
 * para que dos equipos no puedan repetirlo.
 *
 * Las respuestas usan la misma forma que el frontend ya manejaba en
 * localStorage (isExample, fechaGeneracion, ...), así los componentes no
 * cambian.
 */
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { getSupabase } from './supabase.js';
import { esFechaValida } from './validacion.js';

export const datosRouter = Router();
datosRouter.use(requireAuth);

// Igual que frontend/src/constants/tipos.js y el check de la tabla.
const TIPOS = new Set(['normal', 'promedio', 'buena-conducta', 'terminacion']);
const ESTADOS = new Set(['vigente', 'anulada']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un respaldo grande del navegador cabe de sobra; esto solo frena abusos. */
const MAX_IMPORTAR = 5000;

/** Fila de la tabla → objeto que espera el frontend. */
function aFrontend(fila) {
  return {
    id: fila.id,
    folio: fila.folio,
    tipo: fila.tipo,
    isExample: fila.es_ejemplo,
    estado: fila.estado,
    descargas: fila.descargas,
    fechaGeneracion: fila.fecha_generacion,
    data: fila.data,
  };
}

/**
 * Una entrada de respaldo se puede importar si sus campos opcionales, de
 * venir, tienen valores que la tabla acepta.
 */
function entradaImportable(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (e.estado !== undefined && !ESTADOS.has(e.estado)) return false;
  if (e.fechaGeneracion !== undefined && e.fechaGeneracion !== null && !esFechaValida(e.fechaGeneracion)) return false;
  if (e.descargas !== undefined && e.descargas !== null && !(Number.isInteger(e.descargas) && e.descargas >= 0)) {
    return false;
  }
  return true;
}

function falloDeBase(res, error, contexto) {
  console.error(`${contexto}:`, error.code ?? '', error.message);
  return res.status(503).json({ error: 'La base de datos no respondió. Intenta de nuevo.' });
}

function noEncontrada(res) {
  return res.status(404).json({ error: 'Esa constancia no existe.' });
}

function idValido(req, res) {
  if (UUID_RE.test(req.params.id)) return true;
  noEncontrada(res);
  return false;
}

// ---------------------------------------------------------------------
// Constancias
// ---------------------------------------------------------------------

datosRouter.get('/constancias', async (_req, res) => {
  const { data, error } = await getSupabase()
    .from('constancias')
    .select('*')
    .order('fecha_generacion', { ascending: false })
    .order('creado_en', { ascending: false });
  if (error) return falloDeBase(res, error, 'No se pudo leer el historial');

  const { data: siguiente, error: errorFolio } = await getSupabase().rpc('folio_siguiente_vista');
  if (errorFolio) return falloDeBase(res, errorFolio, 'No se pudo leer el folio siguiente');

  return res.json({ constancias: data.map(aFrontend), siguienteFolio: siguiente });
});

datosRouter.post('/constancias', async (req, res) => {
  const { tipo, data } = req.body ?? {};
  if (!TIPOS.has(tipo) || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Faltan el tipo o los datos de la constancia.' });
  }

  const { data: filas, error } = await getSupabase().rpc('registrar_constancia', { p_tipo: tipo, p_data: data });
  if (error) return falloDeBase(res, error, 'No se pudo registrar la constancia');

  return res.status(201).json({ constancia: aFrontend(filas[0]) });
});

datosRouter.patch('/constancias/:id', async (req, res) => {
  if (!idValido(req, res)) return;
  const { estado } = req.body ?? {};
  if (!ESTADOS.has(estado)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  const { data, error } = await getSupabase()
    .from('constancias')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .maybeSingle();
  if (error) return falloDeBase(res, error, 'No se pudo cambiar el estado');
  if (!data) return noEncontrada(res);

  return res.json({ constancia: aFrontend(data) });
});

datosRouter.post('/constancias/:id/descargas', async (req, res) => {
  if (!idValido(req, res)) return;

  const { data, error } = await getSupabase().rpc('incrementar_descarga', { p_id: req.params.id });
  if (error) return falloDeBase(res, error, 'No se pudo registrar la descarga');
  if (!data?.length) return noEncontrada(res);

  return res.json({ constancia: aFrontend(data[0]) });
});

/** Importa un respaldo descargado de la versión que guardaba en el navegador. */
datosRouter.post('/constancias/importar', async (req, res) => {
  const entradas = req.body?.constancias;
  if (!Array.isArray(entradas) || entradas.length > MAX_IMPORTAR) {
    return res.status(400).json({ error: 'El respaldo no tiene el formato esperado.' });
  }

  // Un registro malformado no debe tumbar todo el respaldo (Postgres
  // rechazaría la importación completa): se descartan aquí y se importan
  // los demás. El resto de los filtros (folio, tipo, ejemplos, duplicados)
  // los aplica importar_constancias() en la base.
  const validas = entradas.filter(entradaImportable);

  const { data: agregadas, error } = await getSupabase().rpc('importar_constancias', { p_entradas: validas });
  if (error) return falloDeBase(res, error, 'No se pudo importar el respaldo');

  return res.json({ agregadas, descartadas: entradas.length - validas.length });
});

// ---------------------------------------------------------------------
// Programas educativos (solo lectura: el sistema aún no tiene pantalla
// para editarlos; se cambian desde el SQL Editor de Supabase).
// ---------------------------------------------------------------------

datosRouter.get('/programas', async (_req, res) => {
  const { data, error } = await getSupabase().from('programas').select('nombre').order('creado_en');
  if (error) return falloDeBase(res, error, 'No se pudieron leer los programas');

  return res.json({ programas: data.map((p) => p.nombre) });
});
