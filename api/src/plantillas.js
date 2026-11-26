/**
 * Configuración de plantillas: quiénes firman las constancias (Secretaria
 * Administrativa y Director) y las iniciales del C.c.p. Se guarda en la
 * tabla configuracion, clave 'plantillas' (la misma del calendario, ver
 * supabase/migrations/20261125030000_calendario.sql), para que cambiarlos
 * no requiera tocar el código.
 *
 * Se monta en /plantillas (ver server.js). Todo pasa por requireAuth.
 * Mientras nadie la haya guardado, GET responde null y el frontend usa los
 * firmantes originales (frontend/src/data/firmantesIniciales.js).
 */
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { getSupabase } from './supabase.js';

export const plantillasRouter = Router();
plantillasRouter.use(requireAuth);

const CLAVE = 'plantillas';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function falloDeBase(res, error, contexto) {
  console.error(`${contexto}:`, error.code ?? '', error.message);
  return res.status(503).json({ error: 'La base de datos no respondió. Intenta de nuevo.' });
}

/** Texto recortado; null si es obligatorio y viene vacío o si no es texto. */
function texto(valor, max, { obligatorio = false } = {}) {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  if (obligatorio && !limpio) return null;
  return limpio.length > max ? null : limpio;
}

function limpiarFirmante(f, { conArticulo = false } = {}) {
  if (!f || typeof f !== 'object') return null;
  const nombre = texto(f.nombre, 150, { obligatorio: true });
  const cargo = texto(f.cargo, 200, { obligatorio: true });
  const email = texto(f.email, 120);
  if (nombre === null || cargo === null || email === null) return null;
  if (email && !EMAIL_RE.test(email)) return null;
  const limpio = { nombre, cargo, email };
  if (conArticulo) {
    if (!['El', 'La'].includes(f.articulo)) return null;
    limpio.articulo = f.articulo;
  }
  return limpio;
}

/** Solo los campos que usa el frontend; null si algo no es válido. */
function limpiarPlantillas(entrada) {
  if (!entrada || typeof entrada !== 'object') return null;
  const secretaria = limpiarFirmante(entrada.secretaria);
  const director = limpiarFirmante(entrada.director, { conArticulo: true });
  const ccpIniciales = texto(entrada.ccpIniciales, 40);
  if (!secretaria || !director || ccpIniciales === null) return null;
  return { secretaria, director, ccpIniciales };
}

plantillasRouter.get('/', async (_req, res) => {
  const { data, error } = await getSupabase().from('configuracion').select('valor').eq('clave', CLAVE).maybeSingle();
  if (error) return falloDeBase(res, error, 'No se pudo leer la configuración de plantillas');
  return res.json({ plantillas: data?.valor ?? null });
});

plantillasRouter.put('/', async (req, res) => {
  const limpias = limpiarPlantillas(req.body?.plantillas);
  if (!limpias) {
    return res.status(400).json({
      error: 'Revisa los datos: nombre y cargo son obligatorios y el correo, si se pone, debe ser válido.',
    });
  }

  const valor = { ...limpias, actualizado: new Date().toISOString() };
  const { data, error } = await getSupabase()
    .from('configuracion')
    .upsert({ clave: CLAVE, valor, actualizado_en: valor.actualizado, actualizado_por: req.user.email })
    .select('valor')
    .single();
  if (error) return falloDeBase(res, error, 'No se pudo guardar la configuración de plantillas');

  return res.json({ plantillas: data.valor });
});
