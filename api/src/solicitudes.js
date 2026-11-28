/**
 * Bandeja de solicitudes de los alumnos, del lado de Secretaría.
 *
 * Las solicitudes las crean los alumnos desde su portal (ver alumnos.js).
 * Aquí Secretaría las lista, ve el voucher de pago y las marca como
 * "lista" (al generar la constancia, que queda ligada) o "rechazada" (con
 * un motivo que el alumno ve en su panel).
 *
 * Se monta en /solicitudes (ver server.js). Todo pasa por requireAuth:
 * solo el personal autorizado.
 */
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { getSupabase } from './supabase.js';
import { BUCKET_VOUCHERS } from './alumnos.js';
import { UUID_RE } from './validacion.js';

export const solicitudesRouter = Router();
solicitudesRouter.use(requireAuth);

const ESTADOS = new Set(['pendiente', 'lista', 'rechazada']);
/** Más que suficiente para la bandeja; las más viejas se consultan en Supabase. */
const MAX_LISTA = 1000;

function falloDeBase(res, error, contexto) {
  console.error(`${contexto}:`, error.code ?? error.statusCode ?? '', error.message);
  return res.status(503).json({ error: 'El servidor de datos no respondió. Intenta de nuevo.' });
}

function noEncontrada(res) {
  return res.status(404).json({ error: 'Esa solicitud no existe.' });
}

/** Fila de la tabla → objeto que espera el frontend. */
function aFrontend(fila) {
  return {
    id: fila.id,
    alumnoEmail: fila.alumno_email,
    nombre: fila.nombre,
    matricula: fila.matricula,
    programa: fila.programa,
    tipo: fila.tipo,
    voucherNombre: fila.voucher_nombre,
    voucherTipo: fila.voucher_tipo,
    estado: fila.estado,
    motivoRechazo: fila.motivo_rechazo,
    constanciaId: fila.constancia_id,
    folio: fila.constancias?.folio ?? null,
    atendidaPor: fila.atendida_por,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

solicitudesRouter.get('/', async (_req, res) => {
  const { data, error } = await getSupabase()
    .from('solicitudes')
    .select('*, constancias(folio)')
    .order('creado_en', { ascending: false })
    .limit(MAX_LISTA);
  if (error) return falloDeBase(res, error, 'No se pudieron leer las solicitudes');
  return res.json({ solicitudes: data.map(aFrontend) });
});

solicitudesRouter.get('/:id/voucher', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return noEncontrada(res);

  const supabase = getSupabase();
  const { data: fila, error } = await supabase
    .from('solicitudes')
    .select('voucher_ruta, voucher_tipo')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return falloDeBase(res, error, 'No se pudo leer la solicitud');
  if (!fila) return noEncontrada(res);

  const { data: archivo, error: errorDescarga } = await supabase.storage
    .from(BUCKET_VOUCHERS)
    .download(fila.voucher_ruta);
  if (errorDescarga) {
    if ([400, 404].includes(Number(errorDescarga.statusCode ?? errorDescarga.status))) {
      return res.status(404).json({ error: 'No se encontró el voucher de esta solicitud.' });
    }
    return falloDeBase(res, errorDescarga, 'No se pudo leer el voucher');
  }

  res.set('Content-Type', fila.voucher_tipo);
  res.set('Cache-Control', 'private, no-store');
  return res.send(Buffer.from(await archivo.arrayBuffer()));
});

/**
 * Cambia el estado:
 * - { estado: 'lista', constanciaId? }: atendida; constanciaId liga la constancia generada.
 * - { estado: 'rechazada', motivo }: el motivo es obligatorio y lo ve el alumno.
 * - { estado: 'pendiente' }: regresarla a la bandeja (p. ej. si se rechazó por error).
 */
solicitudesRouter.patch('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return noEncontrada(res);

  const { estado, motivo, constanciaId } = req.body ?? {};
  if (!ESTADOS.has(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  const cambios = {
    estado,
    motivo_rechazo: null,
    atendida_por: estado === 'pendiente' ? null : req.user.email,
    actualizado_en: new Date().toISOString(),
  };
  if (estado === 'rechazada') {
    const limpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (!limpio || limpio.length > 500) {
      return res.status(400).json({ error: 'Escribe el motivo del rechazo (máximo 500 caracteres).' });
    }
    cambios.motivo_rechazo = limpio;
  }
  if (estado === 'lista' && constanciaId !== undefined && constanciaId !== null) {
    if (typeof constanciaId !== 'string' || !UUID_RE.test(constanciaId)) {
      return res.status(400).json({ error: 'La constancia indicada no es válida.' });
    }
    cambios.constancia_id = constanciaId;
  }

  const { data, error } = await getSupabase()
    .from('solicitudes')
    .update(cambios)
    .eq('id', req.params.id)
    .select('*, constancias(folio)')
    .maybeSingle();
  if (error) {
    // 23503: la constancia indicada no existe.
    if (error.code === '23503') return res.status(400).json({ error: 'La constancia indicada no existe.' });
    return falloDeBase(res, error, 'No se pudo actualizar la solicitud');
  }
  if (!data) return noEncontrada(res);
  return res.json({ solicitud: aFrontend(data) });
});
