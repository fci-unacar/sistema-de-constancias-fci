/**
 * Bandeja de solicitudes de los alumnos, del lado de Secretaría.
 *
 * Las solicitudes las crean los alumnos desde su portal (ver alumnos.js).
 * Aquí Secretaría las lista, ve el voucher de pago, las "toma" para que
 * nadie más las atienda al mismo tiempo, y las marca como "lista" (al
 * generar la constancia, que queda ligada) o "rechazada" (con un motivo
 * que el alumno ve en su panel). Tomar y cerrar los hacen funciones de la
 * base en un solo UPDATE (ver migración 20261128000000), así que dos
 * clics simultáneos no pueden atender la misma solicitud dos veces.
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

/** Igual que el intervalo de las funciones de la base (migración 20261128000000). */
const VIGENCIA_TOMA_MS = 60 * 60 * 1000;

function tomaVigente(fila) {
  return (
    fila.estado === 'pendiente' &&
    Boolean(fila.tomada_por) &&
    Date.now() - new Date(fila.tomada_en).getTime() < VIGENCIA_TOMA_MS
  );
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
    // Quién la tiene tomada, solo si la toma no ha vencido (misma regla que la base).
    tomadaPor: tomaVigente(fila) ? fila.tomada_por : null,
    tomadaEn: tomaVigente(fila) ? fila.tomada_en : null,
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
 * Relee la solicitud con el folio de su constancia, después de que una
 * función de la base la modificó (las funciones no traen el join).
 */
async function leerSolicitud(id) {
  const { data, error } = await getSupabase()
    .from('solicitudes')
    .select('*, constancias(folio)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Cuando una función de la base no modificó nada, explica por qué: ya no
 * está pendiente, la tiene otra persona o no existe.
 */
async function responderConflicto(res, id) {
  const fila = await leerSolicitud(id);
  if (!fila) return noEncontrada(res);
  const solicitud = aFrontend(fila);
  if (fila.estado !== 'pendiente') {
    const quien = fila.atendida_por ? ` por ${fila.atendida_por}` : '';
    return res.status(409).json({
      error: `Esta solicitud ya fue atendida${quien} (${fila.estado}).`,
      solicitud,
    });
  }
  return res.status(409).json({
    error: `Esta solicitud la está atendiendo ${fila.tomada_por}. Se libera sola si pasa una hora sin que la termine.`,
    solicitud,
  });
}

/** Ejecuta una función de la base sobre una solicitud y responde con la fila actualizada o el conflicto. */
async function ejecutar(res, id, funcion, parametros, contexto) {
  try {
    const { data, error } = await getSupabase().rpc(funcion, parametros);
    if (error) {
      // 23503: la constancia indicada no existe.
      if (error.code === '23503') return res.status(400).json({ error: 'La constancia indicada no existe.' });
      return falloDeBase(res, error, contexto);
    }
    if (!data?.length) return await responderConflicto(res, id);
    return res.json({ solicitud: aFrontend(await leerSolicitud(id)) });
  } catch (error) {
    return falloDeBase(res, error, contexto);
  }
}

/** Aparta la solicitud a nombre de quien la va a atender (ver migración 20261128000000). */
solicitudesRouter.post('/:id/tomar', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return noEncontrada(res);
  return ejecutar(
    res,
    req.params.id,
    'tomar_solicitud',
    { p_id: req.params.id, p_email: req.user.email },
    'No se pudo tomar la solicitud',
  );
});

/** La libera sin atenderla (solo quien la tomó). */
solicitudesRouter.delete('/:id/tomar', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return noEncontrada(res);
  try {
    const { error } = await getSupabase().rpc('soltar_solicitud', {
      p_id: req.params.id,
      p_email: req.user.email,
    });
    if (error) return falloDeBase(res, error, 'No se pudo soltar la solicitud');
    const fila = await leerSolicitud(req.params.id);
    if (!fila) return noEncontrada(res);
    return res.json({ solicitud: aFrontend(fila) });
  } catch (error) {
    return falloDeBase(res, error, 'No se pudo soltar la solicitud');
  }
});

/**
 * Cambia el estado:
 * - { estado: 'lista', constanciaId? }: atendida; constanciaId liga la constancia generada.
 * - { estado: 'rechazada', motivo }: el motivo es obligatorio y lo ve el alumno.
 * - { estado: 'pendiente' }: regresar a la bandeja una que se rechazó por error.
 *
 * Lista y rechazada solo se aplican si la solicitud sigue pendiente y nadie
 * más la tiene tomada; si no, responde 409 con la solicitud como está.
 */
solicitudesRouter.patch('/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return noEncontrada(res);

  const { estado, motivo, constanciaId } = req.body ?? {};
  if (!ESTADOS.has(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  if (estado === 'pendiente') {
    // Solo una rechazada regresa a la bandeja: una lista ya tiene folio.
    const { data, error } = await getSupabase()
      .from('solicitudes')
      .update({
        estado: 'pendiente',
        motivo_rechazo: null,
        atendida_por: null,
        tomada_por: null,
        tomada_en: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('estado', 'rechazada')
      .select('id');
    if (error) return falloDeBase(res, error, 'No se pudo regresar la solicitud');
    if (!data.length) return responderConflicto(res, id);
    return res.json({ solicitud: aFrontend(await leerSolicitud(id)) });
  }

  let motivoLimpio = null;
  if (estado === 'rechazada') {
    motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (!motivoLimpio || motivoLimpio.length > 500) {
      return res.status(400).json({ error: 'Escribe el motivo del rechazo (máximo 500 caracteres).' });
    }
  }
  let constancia = null;
  if (estado === 'lista' && constanciaId !== undefined && constanciaId !== null) {
    if (typeof constanciaId !== 'string' || !UUID_RE.test(constanciaId)) {
      return res.status(400).json({ error: 'La constancia indicada no es válida.' });
    }
    constancia = constanciaId;
  }

  return ejecutar(
    res,
    id,
    'cerrar_solicitud',
    { p_id: id, p_email: req.user.email, p_estado: estado, p_motivo: motivoLimpio, p_constancia_id: constancia },
    'No se pudo actualizar la solicitud',
  );
});
